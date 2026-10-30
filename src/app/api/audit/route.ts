import { requireSession } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { mongo } from "@/lib/db";

export const GET = handler(async (req: Request) => {
  await requireSession(["ADMIN"]);
  const sp = new URL(req.url).searchParams;
  const filter: any = {};
  for (const k of ["action", "entity"]) { const v = sp.get(k); if (v) filter[k] = v; }
  const u = (sp.get("q") || "").trim();
  if (u) filter.$or = [{ "actor.username": { $regex: u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }, { entityId: { $regex: u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }];
  const pageSize = Math.min(parseInt(sp.get("pageSize") || "15", 10) || 15, 100);
  const page = Math.max(parseInt(sp.get("page") || "1", 10) || 1, 1);
  const db = await mongo();
  const total = await db.collection("audit_logs").countDocuments(filter);
  const rows = await db.collection("audit_logs").find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray();
  const entities = await db.collection("audit_logs").distinct("entity");
  return ok({ rows: rows.map((r: any) => ({ ...r, _id: String(r._id), __id: String(r._id) })), total, page, pageSize, entities });
});
