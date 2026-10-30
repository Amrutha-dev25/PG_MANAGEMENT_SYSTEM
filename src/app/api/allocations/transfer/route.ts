import { requireSession } from "@/lib/auth";
import { handler, ok, readJson, HttpError } from "@/lib/http";
import { callProc, pool } from "@/lib/db";
import { nextId } from "@/lib/crud";
import { audit } from "@/lib/audit";

export const POST = handler(async (req: Request) => {
  const s = await requireSession(["ADMIN", "STAFF"]);
  const b = await readJson(req);
  for (const k of ["Allocation_No", "Room_ID", "Bed_No", "Date"]) if (!b[k]) throw new HttpError(400, `${k.replace(/_/g, " ")} is required.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.Date)) throw new HttpError(400, "Date is invalid.");
  const newNo = await nextId(pool() as any, "ALLOCATION", "Allocation_No", "AL", 3);
  const rows = await callProc("sp_transfer_resident", [b.Allocation_No, newNo, b.Room_ID, Number(b.Bed_No), b.Date, (b.Remarks || "").slice(0, 500) || null]);
  await audit(s, "ACTION", "ALLOCATION", newNo, { op: "sp_transfer_resident", from: b.Allocation_No });
  return ok(rows[0], 201);
});
