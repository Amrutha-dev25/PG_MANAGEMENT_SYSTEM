import { requireSession } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { query, mongo } from "@/lib/db";

// Menus of one date (default: today, else the latest date that has menus) with dishes (MySQL) and rating summary (MongoDB)
export const GET = handler(async (req: Request) => {
  const s = await requireSession();
  const sp = new URL(req.url).searchParams;
  const property = sp.get("Property_ID");
  const dates = (await query("SELECT DISTINCT Menu_Date FROM MENU ORDER BY Menu_Date DESC LIMIT 60")).map((d: any) => d.Menu_Date as string);
  const now = new Date(); const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; // local date, not UTC
  const date = sp.get("date") || (dates.includes(today) ? today : dates[0]) || today;

  const where = ["m.Menu_Date = ?"]; const params: any[] = [date];
  if (property) { where.push("m.Property_ID = ?"); params.push(property); }
  const menus = await query(
    `SELECT m.*, p.Property_Name FROM MENU m JOIN PROPERTY p ON p.Property_ID = m.Property_ID
      WHERE ${where.join(" AND ")} ORDER BY p.Property_Name, m.Meal_Time`, params);
  const ids = menus.map((m: any) => m.Menu_ID);
  const items = ids.length ? await query(
    `SELECT mi.*, f.Food_Name, f.Unit, f.Category FROM MENU_ITEM mi JOIN FOOD_ITEM f ON f.Food_Item_ID = mi.Food_Item_ID
      WHERE mi.Menu_ID IN (?) ORDER BY mi.Menu_ID, mi.Menu_Item_No`, [ids]) : [];

  let stats: Record<string, { avg: number; n: number }> = {}; let mine: Record<string, number> = {};
  try {
    const db = await mongo();
    const agg = await db.collection("meal_feedback").aggregate([
      { $match: { menuId: { $in: ids } } }, { $group: { _id: "$menuId", avg: { $avg: "$rating" }, n: { $sum: 1 } } },
    ]).toArray();
    stats = Object.fromEntries(agg.map((a: any) => [a._id, { avg: Math.round(a.avg * 10) / 10, n: a.n }]));
    if (s.role === "RESIDENT") {
      const my = await db.collection("meal_feedback").find({ menuId: { $in: ids }, residentId: s.residentId }).toArray();
      mine = Object.fromEntries(my.map((m: any) => [m.menuId, m.rating]));
    }
  } catch { /* ratings are optional */ }

  return ok({
    date, dates,
    menus: menus.map((m: any) => ({
      ...m, items: items.filter((i: any) => i.Menu_ID === m.Menu_ID),
      avgRating: stats[m.Menu_ID]?.avg ?? null, ratingCount: stats[m.Menu_ID]?.n ?? 0, myRating: mine[m.Menu_ID] ?? null,
    })),
  });
});
