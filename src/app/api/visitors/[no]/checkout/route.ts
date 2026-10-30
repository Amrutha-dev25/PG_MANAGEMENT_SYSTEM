import { requireSession } from "@/lib/auth";
import { handler, ok, HttpError } from "@/lib/http";
import { pool } from "@/lib/db";
import { audit } from "@/lib/audit";

export const POST = handler(async (_req: Request, { params }: { params: Promise<{ no: string }> }) => {
  const s = await requireSession(["ADMIN", "STAFF"]); const { no } = await params;
  const [r]: any = await pool().query("UPDATE VISITOR_LOG SET Out_Time = GREATEST(CURTIME(), In_Time) WHERE Log_No = ? AND Out_Time IS NULL", [no]);
  if (!r.affectedRows) throw new HttpError(409, "This visitor has already left or the log does not exist.");
  await audit(s, "ACTION", "VISITOR_LOG", no, { op: "checkout" });
  return ok({ ok: true });
});
