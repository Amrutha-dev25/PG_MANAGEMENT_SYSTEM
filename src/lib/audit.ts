// Audit trail in MongoDB (audit_logs). Never blocks the main operation.
import { mongo } from "./db";
import type { Session } from "./auth";

export async function audit(
  s: Pick<Session, "username" | "role"> | null,
  action: "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT" | "LOGIN_FAILED" | "ACTION",
  entity: string, entityId?: string, details?: Record<string, any>,
) {
  try {
    const db = await mongo();
    await db.collection("audit_logs").insertOne({
      actor: { username: s?.username ?? "anonymous", role: s?.role ?? "STAFF" },
      action, entity, ...(entityId ? { entityId: String(entityId) } : {}),
      ...(details ? { details } : {}), createdAt: new Date(),
    });
  } catch (e) {
    console.error("[audit] failed:", (e as Error).message);
  }
}
