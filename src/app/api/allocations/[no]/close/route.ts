import { requireSession } from "@/lib/auth";
import { handler, ok, readJson, HttpError } from "@/lib/http";
import { callProc } from "@/lib/db";
import { audit } from "@/lib/audit";

export const POST = handler(async (req: Request, { params }: { params: Promise<{ no: string }> }) => {
  const s = await requireSession(["ADMIN", "STAFF"]);
  const { no } = await params;
  const b = await readJson(req);
  const status = b.status === "CANCELLED" ? "CANCELLED" : "COMPLETED";
  const date = b.date || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, "Date is invalid.");
  const rows = await callProc("sp_close_allocation", [no, status, date]);
  await audit(s, "ACTION", "ALLOCATION", no, { op: "sp_close_allocation", status, date });
  return ok(rows[0]);
});
