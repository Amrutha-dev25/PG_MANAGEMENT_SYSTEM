import { Int32 } from "mongodb";
import { requireSession } from "@/lib/auth";
import { handler, ok, readJson, HttpError } from "@/lib/http";
import { query, mongo } from "@/lib/db";
import { audit } from "@/lib/audit";

// Staff / admin: read every review of a menu (MongoDB meal_feedback).
export const GET = handler(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireSession(["ADMIN", "STAFF"]);
  const { id } = await params;
  const db = await mongo();
  const feedback = await db.collection("meal_feedback").find({ menuId: id }).sort({ createdAt: -1 }).toArray();
  return ok({ feedback: feedback.map((f: any) => ({ ...f, _id: String(f._id) })) });
});

// Resident: rate a meal (1-5 stars + optional comment / tags). One review per resident per menu; re-rating updates it.
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const s = await requireSession(["RESIDENT"]);
  if (!s.residentId) throw new HttpError(403, "Your account is not linked to a resident record.");
  const { id } = await params;
  const b = await readJson(req);
  const rating = Number(b.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError(400, "Choose a rating between 1 and 5 stars.");
  const comment = String(b.comment || "").trim().slice(0, 1000);
  const tags = (Array.isArray(b.tags) ? b.tags : []).map((t: any) => String(t).trim().slice(0, 30)).filter(Boolean).slice(0, 10);

  const [menu] = await query("SELECT Menu_ID, Property_ID, Meal_Type, Menu_Date FROM MENU WHERE Menu_ID = ?", [id]);
  if (!menu) throw new HttpError(404, "Menu not found.");

  const db = await mongo();
  await db.collection("meal_feedback").updateOne(
    { menuId: id, residentId: s.residentId },
    {
      $set: { rating: new Int32(rating), comment, tags, propertyId: menu.Property_ID, mealType: menu.Meal_Type, menuDate: String(menu.Menu_Date).slice(0, 10), createdAt: new Date() },
      $setOnInsert: { menuId: id, residentId: s.residentId },
    },
    { upsert: true });
  await audit(s, "ACTION", "MEAL_FEEDBACK", id, { rating });
  return ok({ saved: true }, 201);
});
