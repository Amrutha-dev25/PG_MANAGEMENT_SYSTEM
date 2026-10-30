import { requireSession } from "@/lib/auth";
import { handler, ok, readJson, HttpError } from "@/lib/http";
import { query, mongo } from "@/lib/db";
import { audit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

// Residents rate a meal (1-5). One rating per resident per menu (upsert). Stored in MongoDB.
export const POST = handler(async (req: Request, { params }: Ctx) => {
  const s = await requireSession(["RESIDENT"]); const { id } = await params;
  const b = await readJson(req);
  const rating = Number(b.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError(400, "Rating must be between 1 and 5.");
  const [m] = await query("SELECT Menu_ID, Property_ID, Meal_Type, Menu_Date, Menu_Date <= CURDATE() AS Served FROM MENU WHERE Menu_ID = ?", [id]);
  if (!m) throw new HttpError(404, "Menu not found.");
  if (!m.Served) throw new HttpError(400, "You can rate a meal only after its date.");
  const comment = String(b.comment || "").trim().slice(0, 1000);
  const tags = (Array.isArray(b.tags) ? b.tags : []).map((t: any) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 8);
  const db = await mongo();
  await db.collection("meal_feedback").updateOne(
    { menuId: id, residentId: s.residentId },
    { $set: { propertyId: m.Property_ID, mealType: m.Meal_Type, menuDate: m.Menu_Date, rating, ...(comment ? { comment } : {}), tags },
      ...(comment ? {} : { $unset: { comment: "" } }), $setOnInsert: { createdAt: new Date() } },
    { upsert: true });
  await audit(s, "ACTION", "MEAL_FEEDBACK", id, { rating });
  return ok({ ok: true }, 201);
});

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  await requireSession(["ADMIN", "STAFF"]); const { id } = await params;
  const db = await mongo();
  const rows = await db.collection("meal_feedback").find({ menuId: id }).sort({ createdAt: -1 }).toArray();
  return ok({ feedback: rows.map((r: any) => ({ ...r, _id: String(r._id) })) });
});
