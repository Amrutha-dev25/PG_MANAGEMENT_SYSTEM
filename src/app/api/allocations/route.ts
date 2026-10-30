import { requireSession } from "@/lib/auth";
import { handler, ok, readJson, HttpError } from "@/lib/http";
import { query, callProc, pool } from "@/lib/db";
import { nextId } from "@/lib/crud";
import { audit } from "@/lib/audit";

export const GET = handler(async (req: Request) => {
  const s = await requireSession();
  const sp = new URL(req.url).searchParams;
  const where: string[] = []; const params: any[] = [];
  if (s.role === "RESIDENT") { where.push("Resident_ID = ?"); params.push(s.residentId); }
  const status = sp.get("Allocation_Status"); if (status) { where.push("Allocation_Status = ?"); params.push(status); }
  const prop = sp.get("Property_ID"); if (prop) { where.push("Property_ID = ?"); params.push(prop); }
  const text = (sp.get("q") || "").trim();
  if (text) { where.push("(Resident_Name LIKE ? OR Room_No LIKE ? OR Property_Name LIKE ? OR Allocation_No LIKE ?)"); params.push(...Array(4).fill(`%${text}%`)); }
  const w = where.length ? "WHERE " + where.join(" AND ") : "";
  const pageSize = Math.min(parseInt(sp.get("pageSize") || "10", 10) || 10, 100);
  const page = Math.max(parseInt(sp.get("page") || "1", 10) || 1, 1);
  const [{ n }] = await query(`SELECT COUNT(*) AS n FROM vw_allocation_details ${w}`, params);
  const rows = await query(
    `SELECT * FROM vw_allocation_details ${w} ORDER BY FIELD(Allocation_Status,'ACTIVE','COMPLETED','CANCELLED'), Check_In_Date DESC, Allocation_No DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize]);
  return ok({ rows: rows.map((r: any) => ({ ...r, __id: r.Allocation_No })), total: n, page, pageSize });
});

export const POST = handler(async (req: Request) => {
  const s = await requireSession(["ADMIN", "STAFF"]);
  const b = await readJson(req);
  for (const k of ["Resident_ID", "Room_ID", "Bed_No", "Check_In_Date"]) if (!b[k]) throw new HttpError(400, `${k.replace(/_/g, " ")} is required.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.Check_In_Date)) throw new HttpError(400, "Check-in date is invalid.");
  if (b.Check_Out_Date && b.Check_Out_Date < b.Check_In_Date) throw new HttpError(400, "Expected check-out cannot be before check-in.");

  let rows: any[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const no = await nextId(pool() as any, "ALLOCATION", "Allocation_No", "AL", 3);
    try {
      rows = await callProc("sp_allocate_bed", [no, b.Resident_ID, b.Room_ID, Number(b.Bed_No), b.Check_In_Date, b.Check_Out_Date || null, (b.Remarks || "").slice(0, 500) || null]);
      break;
    } catch (e: any) { if (e?.code === "ER_DUP_ENTRY" && attempt < 2) continue; throw e; }
  }
  await audit(s, "ACTION", "ALLOCATION", rows[0]?.Allocation_No, { op: "sp_allocate_bed", resident: b.Resident_ID, room: b.Room_ID, bed: b.Bed_No });
  return ok(rows[0], 201);
});
