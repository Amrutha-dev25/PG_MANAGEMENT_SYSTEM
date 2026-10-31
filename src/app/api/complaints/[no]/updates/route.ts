import { requireSession } from "@/lib/auth";
import { handler, ok, readJson, HttpError } from "@/lib/http";
import { query, mongo } from "@/lib/db";
import { audit } from "@/lib/audit";

// Add a comment to a complaint's MongoDB timeline.
// Residents may comment on their own complaints; only staff/admin can write internal notes.
export const POST = handler(async (req: Request, { params }: { params: Promise<{ no: string }> }) => {
  const s = await requireSession();
  const { no } = await params;
  const b = await readJson(req);
  const [c] = await query("SELECT Complaint_No, Resident_ID FROM COMPLAINT WHERE Complaint_No = ?", [no]);
  if (!c || (s.role === "RESIDENT" && c.Resident_ID !== s.residentId)) throw new HttpError(404, "Complaint not found.");
  const message = String(b.message || "").trim();
  if (!message) throw new HttpError(400, "Write a comment first.");
  if (message.length > 2000) throw new HttpError(400, "Comment is too long (max 2000 characters).");
  const internal = s.role !== "RESIDENT" && b.internal === true;

  const db = await mongo();
  await db.collection("complaint_updates").insertOne({
    complaintNo: no, type: "COMMENT", message, ...(internal ? { internal: true } : {}),
    author: { username: s.username, role: s.role }, createdAt: new Date(),
  });
  await audit(s, "UPDATE", "COMPLAINT", no, { comment: true, internal });
  return ok({ added: true }, 201);
});
