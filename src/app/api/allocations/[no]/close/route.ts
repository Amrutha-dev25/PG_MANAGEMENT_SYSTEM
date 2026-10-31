import { requireSession } from "@/lib/auth";
import { handler, ok, readJson, HttpError } from "@/lib/http";
import { callProc } from "@/lib/db";
import { audit } from "@/lib/audit";

// Check a resident out (COMPLETED) or cancel the allocation (CANCELLED).
// Runs the atomic MySQL procedure sp_close_allocation; trg_allocation_au frees the bed.
export const POST = handler(async (req: Request, { params }: { params: Promise<{ no: string }> }) => {
  const s = await requireSession(["ADMIN", "STAFF"]);
  const { no } = await params;
  const b = await readJson(req);
  const status = String(b.status || "COMPLETED").toUpperCase();
  if (!["COMPLETED", "CANCELLED"].includes(status)) throw new HttpError(400, "Status must be COMPLETED or CANCELLED.");
  const date = String(b.date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, "Date is invalid.");
  const rows = await callProc("sp_close_allocation", [no, status, date]);
  await audit(s, "ACTION", "ALLOCATION", no, { op: "sp_close_allocation", status, date });
  return ok(rows[0] ?? { Allocation_No: no, Allocation_Status: status });
});
