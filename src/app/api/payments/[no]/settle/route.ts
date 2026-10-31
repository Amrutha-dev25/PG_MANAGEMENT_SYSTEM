import { requireSession } from "@/lib/auth";
import { handler, ok, readJson, HttpError } from "@/lib/http";
import { callProc } from "@/lib/db";
import { audit } from "@/lib/audit";

// Mark a PENDING / FAILED payment as PAID (atomic MySQL procedure sp_settle_payment).
export const POST = handler(async (req: Request, { params }: { params: Promise<{ no: string }> }) => {
  const s = await requireSession(["ADMIN", "STAFF"]);
  const { no } = await params;
  const b = await readJson(req).catch(() => ({}));
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const paidOn = String(b?.paidOn || today);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) throw new HttpError(400, "Payment date is invalid.");
  const rows = await callProc("sp_settle_payment", [decodeURIComponent(no), paidOn]);
  await audit(s, "ACTION", "PAYMENT", decodeURIComponent(no), { op: "sp_settle_payment", paidOn });
  return ok(rows[0] ?? { Payment_No: no, Payment_Status: "PAID" });
});
