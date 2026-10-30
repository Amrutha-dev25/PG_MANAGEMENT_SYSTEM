import { requireSession } from "@/lib/auth";
import { handler, ok, readJson, HttpError } from "@/lib/http";
import { query, mongo } from "@/lib/db";
import { audit } from "@/lib/audit";
import { COMPLAINT_STATUSES, PRIORITIES } from "@/lib/resources";

type Ctx = { params: Promise<{ no: string }> };

async function load(no: string, s: any) {
  const [c] = await query(
    `SELECT t.*, CONCAT(r.FirstName, ' ', r.LastName) AS Resident_Name, va.Property_Name, va.Room_No
       FROM COMPLAINT t JOIN RESIDENT r ON r.Resident_ID = t.Resident_ID
       LEFT JOIN vw_active_allocations va ON va.Resident_ID = t.Resident_ID WHERE t.Complaint_No = ?`, [no]);
  if (!c || (s.role === "RESIDENT" && c.Resident_ID !== s.residentId)) throw new HttpError(404, "Complaint not found.");
  return c;
}

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession(); const { no } = await params;
  const complaint = await load(no, s);
  const db = await mongo();
  const filter: any = { complaintNo: no };
  if (s.role === "RESIDENT") filter.internal = { $ne: true };
  const timeline = await db.collection("complaint_updates").find(filter).sort({ createdAt: 1 }).toArray();
  return ok({ complaint, timeline: timeline.map((t: any) => ({ ...t, _id: String(t._id) })) });
});

// Staff/Admin: change status and/or priority (MySQL) and log the change on the MongoDB timeline
export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const s = await requireSession(["ADMIN", "STAFF"]); const { no } = await params;
  const b = await readJson(req);
  const current = await load(no, s);
  const sets: string[] = []; const vals: any[] = [];
  if (b.Status && b.Status !== current.Status) {
    if (!COMPLAINT_STATUSES.includes(b.Status)) throw new HttpError(400, "Invalid status.");
    sets.push("Status = ?"); vals.push(b.Status);
  }
  if (b.Priority && b.Priority !== current.Priority) {
    if (!PRIORITIES.includes(b.Priority)) throw new HttpError(400, "Invalid priority.");
    sets.push("Priority = ?"); vals.push(b.Priority);
  }
  if (!sets.length) throw new HttpError(400, "Nothing to change.");
  await query(`UPDATE COMPLAINT SET ${sets.join(", ")} WHERE Complaint_No = ?`, [...vals, no]);

  const db = await mongo();
  const note = String(b.note || "").trim().slice(0, 2000);
  const statusChanged = b.Status && b.Status !== current.Status;
  const priorityNote = b.Priority && b.Priority !== current.Priority ? `Priority changed ${current.Priority} → ${b.Priority}. ` : "";
  const isResolution = statusChanged && ["RESOLVED", "CLOSED"].includes(b.Status);
  await db.collection("complaint_updates").insertOne({
    complaintNo: no, type: isResolution ? "RESOLUTION" : statusChanged ? "STATUS_CHANGE" : "COMMENT",
    message: (priorityNote + (note || (statusChanged ? `Status changed to ${b.Status}.` : ""))).trim() || "Updated.",
    ...(statusChanged ? { fromStatus: current.Status, toStatus: b.Status } : {}),
    author: { username: s.username, role: s.role }, createdAt: new Date(),
  });
  await audit(s, "UPDATE", "COMPLAINT", no, { Status: b.Status, Priority: b.Priority });
  return ok(await load(no, s));
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession(["ADMIN"]); const { no } = await params;
  await load(no, s);
  await query("DELETE FROM COMPLAINT WHERE Complaint_No = ?", [no]);
  const db = await mongo();
  await db.collection("complaint_updates").deleteMany({ complaintNo: no });
  await audit(s, "DELETE", "COMPLAINT", no);
  return ok({ deleted: no });
});
