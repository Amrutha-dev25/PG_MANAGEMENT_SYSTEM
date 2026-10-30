// SERVER-ONLY generic CRUD engine driven by resources.ts (fields/permissions) + resource-sql.ts (SQL).
import type { PoolConnection } from "mysql2/promise";
import { query, withTransaction, mongo } from "./db";
import { HttpError } from "./http";
import { audit } from "./audit";
import { RESOURCES, can, idOf, type Field, type Resource } from "./resources";
import { SQL, type SqlCfg } from "./resource-sql";
import type { Session } from "./auth";

const q = (name: string) => "`" + name.replace(/`/g, "") + "`";
const isEmpty = (v: any) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

function resolve(key: string): { res: Resource; cfg: SqlCfg } {
  const res = RESOURCES[key]; const cfg = SQL[key];
  if (!res || !cfg) throw new HttpError(404, "Unknown resource.");
  return { res, cfg };
}

function authorize(res: Resource, op: keyof Resource["perms"], s: Session) {
  if (!can(res, op, s.role)) throw new HttpError(403, "You do not have permission for this action.");
}

/** Extra WHERE for the RESIDENT role: they only ever see their own rows. */
function scopeClause(cfg: SqlCfg, s: Session): { sql: string; params: any[] } | null {
  if (s.role !== "RESIDENT") return null;
  if (!cfg.scope || !s.residentId) throw new HttpError(403, "You do not have permission for this action.");
  return { sql: `${cfg.scope} = ?`, params: [s.residentId] };
}

const stripAdminOnly = (res: Resource, row: any, s: Session) => {
  if (s.role === "ADMIN") return row;
  for (const f of res.fields) if (f.adminOnly) delete row[f.name];
  for (const c of res.columns) if (c.adminOnly) delete row[c.key];
  return row;
};

function pkWhere(res: Resource, id: string): { sql: string; params: any[] } {
  const parts = id.split("~");
  if (parts.length !== res.pk.length) throw new HttpError(400, "Invalid record id.");
  return { sql: res.pk.map((k) => `t.${q(k)} = ?`).join(" AND "), params: parts };
}

// ------------------------------------------------------------------ LIST
export async function listResource(key: string, s: Session, sp: URLSearchParams) {
  const { res, cfg } = resolve(key);
  authorize(res, "read", s);
  const where: string[] = []; const params: any[] = [];
  const sc = scopeClause(cfg, s); if (sc) { where.push(sc.sql); params.push(...sc.params); }

  const text = (sp.get("q") || "").trim();
  if (text && cfg.search.length) {
    where.push("(" + cfg.search.map((c) => `${c} LIKE ?`).join(" OR ") + ")");
    cfg.search.forEach(() => params.push(`%${text}%`));
  }
  for (const [name, col] of Object.entries(cfg.filters)) {
    const v = sp.get(name);
    if (v) { where.push(`${col} = ?`); params.push(v); }
  }
  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

  const sortKey = sp.get("sort") || "";
  const dir = sp.get("dir") === "desc" ? "DESC" : "ASC";
  const orderSql = cfg.sort[sortKey] ? `${cfg.sort[sortKey]} ${dir}, ${cfg.defaultSort}` : cfg.defaultSort;

  const pageSize = Math.min(Math.max(parseInt(sp.get("pageSize") || "10", 10) || 10, 1), 100);
  const page = Math.max(parseInt(sp.get("page") || "1", 10) || 1, 1);

  const [{ n }] = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${cfg.from} ${whereSql}`, params);
  const rows = await query(`SELECT ${cfg.select} FROM ${cfg.from} ${whereSql} ORDER BY ${orderSql} LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize]);
  return { rows: rows.map((r: any) => ({ ...stripAdminOnly(res, r, s), __id: idOf(res, r) })), total: n, page, pageSize };
}

// ------------------------------------------------------------------ GET ONE (for edit forms)
export async function getResource(key: string, s: Session, id: string, conn?: PoolConnection) {
  const { res, cfg } = resolve(key);
  authorize(res, "read", s);
  const w = pkWhere(res, id);
  const where = [w.sql]; const params = [...w.params];
  const sc = scopeClause(cfg, s); if (sc) { where.push(sc.sql); params.push(...sc.params); }
  const [row] = await query(`SELECT ${cfg.select} FROM ${cfg.from} WHERE ${where.join(" AND ")}`, params, conn);
  if (!row) throw new HttpError(404, "Record not found.");
  for (const ch of cfg.children ?? []) {
    const vals = await query(`SELECT ${q(ch.valueCol)} AS v FROM ${q(ch.table)} WHERE ${q(ch.parentCol)} = ? ORDER BY 1`, [row[res.pk[0]]], conn);
    row[ch.field] = vals.map((x: any) => x.v);
  }
  return { ...stripAdminOnly(res, row, s), __id: idOf(res, row) };
}

// ------------------------------------------------------------------ VALIDATION
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}(:\d{2})?$/;
const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const PHONE = /^([+]91)?[0-9]{10}$/;

function validate(res: Resource, body: any, mode: "create" | "update", s: Session) {
  const values: Record<string, any> = {}; const virtuals: Record<string, any> = {};
  for (const f of res.fields) {
    if (mode === "update" && (f.readOnlyOnEdit || f.createOnly)) continue;
    if (f.adminOnly && s.role !== "ADMIN") continue;
    const target = f.virtual ? virtuals : values;
    let v = body?.[f.name];

    if (f.type === "tags" || f.type === "multiref") {
      const arr = Array.isArray(v) ? v.map((x: any) => String(x).trim()).filter(Boolean) : [];
      if (f.required && !arr.length) throw new HttpError(400, `${f.label} is required.`);
      if (f.type === "tags" && f.name === "phones") for (const p of arr) if (!PHONE.test(p)) throw new HttpError(400, `Invalid phone number '${p}' (use 10 digits).`);
      if (Array.isArray(v) || mode === "create") target[f.name] = [...new Set(arr)];
      continue;
    }
    if (f.type === "boolean") { target[f.name] = v === true || v === "true"; continue; }

    if (isEmpty(v)) {
      if (f.required) throw new HttpError(400, `${f.label} is required.`);
      if (mode === "update" && body && !(f.name in body)) continue;
      target[f.name] = null; continue;
    }
    if (typeof v === "string") v = v.trim();
    switch (f.type) {
      case "number": case "money": {
        const n = Number(v);
        if (!Number.isFinite(n)) throw new HttpError(400, `${f.label} must be a number.`);
        if (f.type === "number" && f.name !== "Quantity" && !Number.isInteger(n)) throw new HttpError(400, `${f.label} must be a whole number.`);
        if (f.min !== undefined && n < f.min) throw new HttpError(400, `${f.label} must be at least ${f.min}.`);
        if (f.max !== undefined && n > f.max) throw new HttpError(400, `${f.label} must be at most ${f.max}.`);
        v = n; break;
      }
      case "date": if (!DATE.test(v)) throw new HttpError(400, `${f.label} must be a valid date.`); break;
      case "time": if (!TIME.test(v)) throw new HttpError(400, `${f.label} must be a valid time.`); if (v.length === 5) v += ":00"; break;
      case "email": if (!EMAIL.test(v)) throw new HttpError(400, `${f.label} must be a valid email.`); break;
      case "select": if (f.options && !f.options.includes(v) && !(f.name === "Status" && v === "OCCUPIED")) throw new HttpError(400, `${f.label} has an invalid value.`); break;
      default: break;
    }
    if (typeof v === "string") {
      if (f.maxLength && v.length > f.maxLength) throw new HttpError(400, `${f.label} is too long (max ${f.maxLength}).`);
      if (f.pattern && !new RegExp(f.pattern).test(v)) throw new HttpError(400, f.patternMsg || `${f.label} is invalid.`);
    }
    target[f.name] = v;
  }
  return { values, virtuals };
}

// ------------------------------------------------------------------ ID GENERATION
export async function nextId(conn: PoolConnection, table: string, col: string, prefix: string, pad: number) {
  const regex = `^${prefix.replace(/[^A-Za-z0-9-]/g, "")}[0-9]+$`;
  const [row] = await query<{ n: number }>(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(${q(col)}, ?) AS UNSIGNED)), 0) + 1 AS n FROM ${q(table)} WHERE ${q(col)} REGEXP ?`,
    [prefix.length + 1, regex], conn);
  return prefix + String(row.n).padStart(pad, "0");
}
async function nextSeq(conn: PoolConnection, cfg: SqlCfg, values: Record<string, any>) {
  const seq = cfg.seq!;
  const [row] = await query<{ n: number }>(
    `SELECT COALESCE(MAX(${q(seq.col)}), 0) + 1 AS n FROM ${q(cfg.table)} WHERE ${seq.parent.map((p) => `${q(p)} = ?`).join(" AND ")}`,
    seq.parent.map((p) => values[p]), conn);
  return row.n;
}

async function writeChildren(conn: PoolConnection, cfg: SqlCfg, parentId: string, virtuals: Record<string, any>) {
  for (const ch of cfg.children ?? []) {
    if (!(ch.field in virtuals)) continue;
    await query(`DELETE FROM ${q(ch.table)} WHERE ${q(ch.parentCol)} = ?`, [parentId], conn);
    const list: string[] = virtuals[ch.field] || [];
    for (const v of list) await query(`INSERT INTO ${q(ch.table)} (${q(ch.parentCol)}, ${q(ch.valueCol)}) VALUES (?, ?)`, [parentId, v], conn);
  }
}

// ------------------------------------------------------------------ CREATE
export async function createResource(key: string, s: Session, body: any) {
  const { res, cfg } = resolve(key);
  authorize(res, "create", s);
  const { values, virtuals } = validate(res, body, "create", s);

  let created: any;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      created = await withTransaction(async (conn) => {
        const row = { ...values };
        if (cfg.idPrefix) row[res.pk[0]] = await nextId(conn, cfg.table, res.pk[0], cfg.idPrefix.prefix, cfg.idPrefix.pad);
        if (cfg.seq) row[cfg.seq.col] = await nextSeq(conn, cfg, row);
        const cols = Object.keys(row);
        await query(`INSERT INTO ${q(cfg.table)} (${cols.map(q).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`, cols.map((c) => row[c]), conn);
        const id = res.pk.map((k) => String(row[k])).join("~");
        await writeChildren(conn, cfg, String(row[res.pk[0]]), virtuals);
        if (key === "room" && virtuals.Create_Beds) {
          for (let i = 1; i <= Number(row.Capacity); i++)
            await query("INSERT INTO BED (Room_ID, Bed_No, Bed_Type, Status) VALUES (?, ?, 'Single', 'AVAILABLE')", [row.Room_ID, i], conn);
        }
        return { id, row };
      });
      break;
    } catch (e: any) {
      // two users created an auto-numbered row at the same moment -> retry with the next number
      if (e?.code === "ER_DUP_ENTRY" && (cfg.idPrefix || cfg.seq) && /PRIMARY|pk_/i.test(e.sqlMessage || "") && attempt < 3) continue;
      throw e;
    }
  }
  await audit(s, "CREATE", cfg.table, created.id, { fields: Object.keys(values) });
  return getResource(key, s, created.id);
}

// ------------------------------------------------------------------ UPDATE
export async function updateResource(key: string, s: Session, id: string, body: any) {
  const { res, cfg } = resolve(key);
  authorize(res, "update", s);
  const { values, virtuals } = validate(res, body, "update", s);
  const w = pkWhere(res, id);

  await withTransaction(async (conn) => {
    const [current] = await query(`SELECT * FROM ${q(cfg.table)} t WHERE ${w.sql} FOR UPDATE`, w.params, conn);
    if (!current) throw new HttpError(404, "Record not found.");
    if (key === "bed" && current.Status === "OCCUPIED") delete values.Status; // status is owned by allocations
    const cols = Object.keys(values);
    if (cols.length) {
      await query(`UPDATE ${q(cfg.table)} t SET ${cols.map((c) => `t.${q(c)} = ?`).join(", ")} WHERE ${w.sql}`, [...cols.map((c) => values[c]), ...w.params], conn);
    }
    await writeChildren(conn, cfg, String(current[res.pk[0]]), virtuals);
  });
  await audit(s, "UPDATE", cfg.table, id, { fields: Object.keys(values) });
  return getResource(key, s, id);
}

// ------------------------------------------------------------------ DELETE
const cleanup: Record<string, (row: any) => Promise<void>> = {
  // keep MongoDB consistent with MySQL (no orphan documents)
  resident: async (r) => { const db = await mongo(); await db.collection("meal_feedback").deleteMany({ residentId: r.Resident_ID }); await db.collection("app_users").deleteMany({ residentId: r.Resident_ID }); },
  staff: async (r) => { const db = await mongo(); await db.collection("app_users").deleteMany({ staffId: r.Staff_ID }); },
  menu: async (r) => { const db = await mongo(); await db.collection("meal_feedback").deleteMany({ menuId: r.Menu_ID }); },
  property: async (r) => { const db = await mongo(); await db.collection("meal_feedback").deleteMany({ propertyId: r.Property_ID }); },
};

export async function deleteResource(key: string, s: Session, id: string) {
  const { res, cfg } = resolve(key);
  authorize(res, "delete", s);
  const w = pkWhere(res, id);
  const [row] = await query(`SELECT * FROM ${q(cfg.table)} t WHERE ${w.sql}`, w.params);
  if (!row) throw new HttpError(404, "Record not found.");
  await query(`DELETE t FROM ${q(cfg.table)} t WHERE ${w.sql}`, w.params);
  if (cleanup[key]) await cleanup[key](row).catch((e) => console.error("[cleanup]", e.message));
  await audit(s, "DELETE", cfg.table, id);
  return { deleted: id };
}

// ------------------------------------------------------------------ OPTIONS (for dropdowns)
export async function optionsFor(key: string, s: Session, sp: URLSearchParams) {
  const { res, cfg } = resolve(key);
  if (!cfg.opt) throw new HttpError(404, "No options for this resource.");
  if (s.role === "RESIDENT") throw new HttpError(403, "You do not have permission for this action.");
  const where: string[] = []; const params: any[] = [];
  for (const [name, col] of Object.entries(cfg.opt.filters)) { const v = sp.get(name); if (v) { where.push(`${col} = ?`); params.push(v); } }
  const rows = await query(`SELECT ${cfg.opt.value} AS value, ${cfg.opt.label} AS label FROM ${cfg.opt.from} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY ${cfg.opt.order}`, params);
  return rows;
}
