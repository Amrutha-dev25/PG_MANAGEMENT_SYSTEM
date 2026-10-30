import { requireSession } from "@/lib/auth";
import { handler, ok, readJson, HttpError } from "@/lib/http";
import { query, mongo, pool } from "@/lib/db";
import { nextId } from "@/lib/crud";
import { audit } from "@/lib/audit";
import { COMPLAINT_CATEGORIES, PRIORITIES } from "@/lib/resources";

const BASE_SELECT = `t.*, CONCAT(r.FirstName, ' ', r.LastName) AS Resident_Name, va.Property_ID, va.Property_Name, va.Room_No,
  CASE WHEN t.Status IN ('RESOLVED','CLOSED') THEN NULL ELSE DATEDIFF(CURDATE(), t.Date_Filed) END AS Open_Days`;
const BASE_FROM = `COMPLAINT t JOIN RESIDENT r ON r.Resident_ID = t.Resident_ID
  LEFT JOIN vw_active_allocations va ON va.Resident_ID = t.Resident_ID`;

export const GET = handler(async (req: Request) => {
  const s = await requireSession();
  const sp = new URL(req.url).searchParams;
  const where: string[] = []; const params: any[] = [];
  if (s.role === "RESIDENT") { where.push("t.Resident_ID = ?"); params.push(s.residentId); }
  for (const [name, col] of [["Status", "t.Status"], ["Priority", "t.Priority"], ["Category", "t.Category"], ["Property_ID", "va.Property_ID"]] as const) {
    const v = sp.get(name); if (v) { where.push(`${col} = ?`); params.push(v); }
  }
  // Search: MySQL FULLTEXT (ft_complaint_text) in BOOLEAN MODE; falls back to LIKE for very short words / no hits.
  const text = (sp.get("q") || "").trim();
  const pageSize = Math.min(parseInt(sp.get("pageSize") || "10", 10) || 10, 100);
  const page = Math.max(parseInt(sp.get("page") || "1", 10) || 1, 1);
  const order = `ORDER BY (t.Status IN ('RESOLVED','CLOSED')), FIELD(t.Priority,'URGENT','HIGH','MEDIUM','LOW'), t.Date_Filed DESC, t.Complaint_No DESC`;

  async function run(searchSql: string, searchParams: any[]) {
    const w = [...where, ...(searchSql ? [searchSql] : [])];
    const wsql = w.length ? "WHERE " + w.join(" AND ") : "";
    const p = [...params, ...searchParams];
    const [{ n }] = await query(`SELECT COUNT(*) AS n FROM ${BASE_FROM} ${wsql}`, p);
    const rows = await query(`SELECT ${BASE_SELECT} FROM ${BASE_FROM} ${wsql} ${order} LIMIT ? OFFSET ?`, [...p, pageSize, (page - 1) * pageSize]);
    return { rows, total: n as number };
  }

  let result;
  let mode = "none";
  if (text) {
    const tokens = text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
    if (tokens.length && tokens.every((t) => t.length >= 3)) {
      const boolean = tokens.map((t) => `+${t}*`).join(" ");
      result = await run("MATCH(t.Description, t.Category) AGAINST (? IN BOOLEAN MODE)", [boolean]);
      mode = "fulltext";
    }
    if (!result || result.total === 0) {
      result = await run("(t.Description LIKE ? OR t.Category LIKE ? OR r.FirstName LIKE ? OR r.LastName LIKE ? OR t.Complaint_No LIKE ?)", Array(5).fill(`%${text}%`));
      mode = "like";
    }
  } else result = await run("", []);

  // enrich with number of timeline entries from MongoDB (fail-soft)
  let counts: Record<string, number> = {};
  try {
    const db = await mongo();
    const match: any = { complaintNo: { $in: result.rows.map((r: any) => r.Complaint_No) } };
    if (s.role === "RESIDENT") match.internal = { $ne: true };
    const agg = await db.collection("complaint_updates").aggregate([{ $match: match }, { $group: { _id: "$complaintNo", n: { $sum: 1 } } }]).toArray();
    counts = Object.fromEntries(agg.map((a: any) => [a._id, a.n]));
  } catch { /* timeline counts are optional */ }

  return ok({ rows: result.rows.map((r: any) => ({ ...r, __id: r.Complaint_No, Update_Count: counts[r.Complaint_No] || 0 })), total: result.total, page, pageSize, searchMode: mode });
});

export const POST = handler(async (req: Request) => {
  const s = await requireSession();
  const b = await readJson(req);
  const residentId = s.role === "RESIDENT" ? s.residentId : b.Resident_ID;
  if (!residentId) throw new HttpError(400, "Choose the resident.");
  if (!COMPLAINT_CATEGORIES.includes(b.Category)) throw new HttpError(400, "Choose a valid category.");
  const priority = b.Priority || "MEDIUM";
  if (!PRIORITIES.includes(priority)) throw new HttpError(400, "Choose a valid priority.");
  const desc = String(b.Description || "").trim();
  if (desc.length < 5) throw new HttpError(400, "Describe the problem (at least 5 characters).");
  if (desc.length > 2000) throw new HttpError(400, "Description is too long.");

  let no = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    no = await nextId(pool() as any, "COMPLAINT", "Complaint_No", "C", 3);
    try {
      await query("INSERT INTO COMPLAINT (Complaint_No, Resident_ID, Category, Description, Priority, Status, Date_Filed) VALUES (?, ?, ?, ?, ?, 'OPEN', CURDATE())",
        [no, residentId, b.Category, desc, priority]);
      break;
    } catch (e: any) { if (e?.code === "ER_DUP_ENTRY" && attempt < 2) continue; throw e; }
  }
  const db = await mongo();
  await db.collection("complaint_updates").insertOne({
    complaintNo: no, type: "COMMENT", message: "Complaint filed.", author: { username: s.username, role: s.role }, createdAt: new Date(),
  });
  await audit(s, "CREATE", "COMPLAINT", no, { category: b.Category, priority });
  return ok({ Complaint_No: no }, 201);
});
