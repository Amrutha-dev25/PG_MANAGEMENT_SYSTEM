import { requireSession } from "@/lib/auth";
import { handler, ok, HttpError } from "@/lib/http";
import { pool } from "@/lib/db";
import { audit } from "@/lib/audit";

// Stamp Out_Time on an open visitor log (only if the visitor is still inside).
export const POST = handler(async (_req: Request, { params }: { params: Promise<{ no: string }> }) => {
  const s = await requireSession(["ADMIN", "STAFF"]);
  const { no } = await params;
  // GREATEST() keeps Out_Time >= In_Time so the chk_visitor_time constraint can never fail
  const [r]: any = await pool().query(
    "UPDATE VISITOR_LOG SET Out_Time = GREATEST(CURTIME(), In_Time) WHERE Log_No = ? AND Out_Time IS NULL", [no]);
  if (!r.affectedRows) throw new HttpError(409, "This visitor is not inside (already checked out or log not found).");
  await audit(s, "ACTION", "VISITOR_LOG", no, { op: "checkout" });
  return ok({ Log_No: no, checkedOut: true });
});
