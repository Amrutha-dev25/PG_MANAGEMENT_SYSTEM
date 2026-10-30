import { requireSession } from "@/lib/auth";
import { handler, ok, readJson, HttpError } from "@/lib/http";
import { callProc } from "@/lib/db";
import { audit } from "@/lib/audit";

export const POST = handler(async (req: Request) => {
  const s = await requireSession(["ADMIN", "STAFF"]);
  const b = await readJson(req);
  if (!b.Property_ID) throw new HttpError(400, "Choose a property.");
  if (!/^\d{4}-\d{2}$/.test(b.month || "")) throw new HttpError(400, "Choose a month.");
  const rows = await callProc("sp_generate_monthly_rent", [b.Property_ID, `${b.month}-01`]);
  const created = Number(rows[0]?.Created ?? 0);
  await audit(s, "ACTION", "PAYMENT", `RENT-${b.month.replace("-", "")}`, { op: "sp_generate_monthly_rent", property: b.Property_ID, created });
  return ok({ created });
});
