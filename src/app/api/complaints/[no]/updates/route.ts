import { requireSession } from "@/lib/auth";
import { handler, ok, readJson, HttpError } from "@/lib/http";
import { query, mongo } from "@/lib/db";

// Add a comment to the MongoDB timeline of a complaint
export const POST = handler(async (req: Request, { params }: { params: Promise<{ no: string }> }) => {
  const s = await requireSession(); const { no } = await params;
  const b = await readJson(req);
  const [c] = await query("SELECT Complaint_No, Resident_ID FROM COMPLAINT WHERE Complaint_No = ?", [no]);
  if (!c || (s.role === "RESIDENT" && c.Resident_ID !== s.residentId)) throw new HttpError(404, "Complaint not found.");
  const message = String(b.message || "").trim();
  if (!message) throw new HttpError(400, "Write a message first.");
  if (message.length > 2000) throw new HttpError(400, "Message is too long.");
  const doc: any = { complaintNo: no, type: "COMMENT", message, author: { username: s.username, role: s.role }, createdAt: new Date() };
  if (b.internal === true && s.role !== "RESIDENT") doc.internal = true;
  const db = await mongo();
  await db.collection("complaint_updates").insertOne(doc);
  return ok({ ok: true }, 201);
});
