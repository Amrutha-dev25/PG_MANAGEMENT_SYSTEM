import { requireSession } from "@/lib/auth";
import { handler, ok, HttpError } from "@/lib/http";
import { pool } from "@/lib/db";
import { audit } from "@/lib/audit";

export const DELETE = handler(async (_req: Request, { params }: { params: Promise<{ no: string }> }) => {
  const s = await requireSession(["ADMIN"]); const { no } = await params;
  const [r]: any = await pool().query("DELETE FROM VISITOR_LOG WHERE Log_No = ?", [no]);
  if (!r.affectedRows) throw new HttpError(404, "Log not found.");
  await audit(s, "DELETE", "VISITOR_LOG", no);
  return ok({ deleted: no });
});
