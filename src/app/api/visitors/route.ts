import { requireSession } from "@/lib/auth";
import { handler, ok, readJson, HttpError } from "@/lib/http";
import { query, withTransaction } from "@/lib/db";
import { nextId } from "@/lib/crud";
import { audit } from "@/lib/audit";
import { ID_TYPES } from "@/lib/resources";

export const GET = handler(async (req: Request) => {
  const s = await requireSession();
  const sp = new URL(req.url).searchParams;
  const where: string[] = []; const params: any[] = [];
  if (s.role === "RESIDENT") {
    where.push("EXISTS (SELECT 1 FROM VISITOR_RESIDENT vr WHERE vr.Visitor_ID = vd.Visitor_ID AND vr.Resident_ID = ?)"); params.push(s.residentId);
  }
  const st = sp.get("Visit_Status"); if (st) { where.push("vd.Visit_Status = ?"); params.push(st); }
  const date = sp.get("Visit_Date"); if (date) { where.push("vd.Visit_Date = ?"); params.push(date); }
  const text = (sp.get("q") || "").trim();
  if (text) { where.push("(vd.Visitor_Name LIKE ? OR vd.Visiting LIKE ? OR vd.Phones LIKE ? OR vd.Purpose LIKE ?)"); params.push(...Array(4).fill(`%${text}%`)); }
  const w = where.length ? "WHERE " + where.join(" AND ") : "";
  const pageSize = Math.min(parseInt(sp.get("pageSize") || "10", 10) || 10, 100);
  const page = Math.max(parseInt(sp.get("page") || "1", 10) || 1, 1);
  const [{ n }] = await query(`SELECT COUNT(*) AS n FROM vw_visitor_log_details vd ${w}`, params);
  const rows = await query(`SELECT vd.* FROM vw_visitor_log_details vd ${w} ORDER BY (vd.Out_Time IS NOT NULL), vd.Visit_Date DESC, vd.In_Time DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize]);
  return ok({ rows: rows.map((r: any) => ({ ...r, __id: r.Log_No })), total: n, page, pageSize });
});

// Register a visit: creates (or re-uses) the VISITOR, links the resident (VISITOR_RESIDENT) and opens a VISITOR_LOG row.
export const POST = handler(async (req: Request) => {
  const s = await requireSession(["ADMIN", "STAFF"]);
  const b = await readJson(req);
  const name = String(b.Name || "").trim();
  if (!name) throw new HttpError(400, "Visitor name is required.");
  if (!ID_TYPES.includes(b.ID_Type)) throw new HttpError(400, "Choose an ID type.");
  const idNo = String(b.ID_Number || "").trim();
  if (!idNo) throw new HttpError(400, "ID number is required.");
  if (!b.Resident_ID) throw new HttpError(400, "Choose the resident being visited.");
  const purpose = String(b.Purpose || "").trim();
  if (!purpose) throw new HttpError(400, "Purpose of visit is required.");
  const phones: string[] = (Array.isArray(b.phones) ? b.phones : []).map((p: any) => String(p).trim()).filter(Boolean);
  for (const p of phones) if (!/^([+]91)?[0-9]{10}$/.test(p)) throw new HttpError(400, `Invalid phone number '${p}'.`);

  const result = await withTransaction(async (conn) => {
    const [existing] = await query("SELECT Visitor_ID FROM VISITOR WHERE ID_Type = ? AND ID_Number = ?", [b.ID_Type, idNo], conn);
    let visitorId = existing?.Visitor_ID as string | undefined;
    if (!visitorId) {
      visitorId = await nextId(conn, "VISITOR", "Visitor_ID", "V", 3);
      await query("INSERT INTO VISITOR (Visitor_ID, Name, ID_Type, ID_Number) VALUES (?, ?, ?, ?)", [visitorId, name, b.ID_Type, idNo], conn);
    }
    for (const p of phones) await query("INSERT IGNORE INTO VISITOR_PHONE (Visitor_ID, Phone) VALUES (?, ?)", [visitorId, p], conn);
    await query("INSERT IGNORE INTO VISITOR_RESIDENT (Visitor_ID, Resident_ID) VALUES (?, ?)", [visitorId, b.Resident_ID], conn);
    const logNo = await nextId(conn, "VISITOR_LOG", "Log_No", "L", 3);
    await query("INSERT INTO VISITOR_LOG (Log_No, Visitor_ID, Visit_Date, In_Time, Purpose) VALUES (?, ?, CURDATE(), CURTIME(), ?)", [logNo, visitorId, purpose], conn);
    return { Log_No: logNo, Visitor_ID: visitorId };
  });
  await audit(s, "CREATE", "VISITOR_LOG", result.Log_No, { visitor: result.Visitor_ID, resident: b.Resident_ID });
  return ok(result, 201);
});
