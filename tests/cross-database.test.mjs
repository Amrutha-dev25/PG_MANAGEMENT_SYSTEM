// MySQL <-> MongoDB consistency: every business key stored in MongoDB must exist in MySQL.
import test from "node:test";
import assert from "node:assert/strict";
import { dbAvailable, sql, mongoDb } from "./helpers.mjs";

const up = await dbAvailable();
test("MongoDB references resolve to MySQL rows", { skip: !up && "databases not running" }, async () => {
  const c = await sql(); const { db, close } = await mongoDb();
  try {
    const set = async (q) => new Set((await c.query(q))[0].map((r) => r.k));
    const complaints = await set("SELECT Complaint_No k FROM COMPLAINT");
    const menus = await set("SELECT Menu_ID k FROM MENU");
    const residents = await set("SELECT Resident_ID k FROM RESIDENT");
    const staff = await set("SELECT Staff_ID k FROM STAFF");
    const props = await set("SELECT Property_ID k FROM PROPERTY");
    for (const d of await db.collection("complaint_updates").find().toArray()) assert.ok(complaints.has(d.complaintNo), `complaint_updates -> unknown complaint ${d.complaintNo}`);
    for (const d of await db.collection("meal_feedback").find().toArray()) {
      assert.ok(menus.has(d.menuId), `meal_feedback -> unknown menu ${d.menuId}`);
      assert.ok(residents.has(d.residentId), `meal_feedback -> unknown resident ${d.residentId}`);
      assert.ok(props.has(d.propertyId), `meal_feedback -> unknown property ${d.propertyId}`);
      const [[m]] = await c.query("SELECT Property_ID p, Meal_Type t, Menu_Date d FROM MENU WHERE Menu_ID=?", [d.menuId]);
      assert.equal(m.p, d.propertyId); assert.equal(m.t, d.mealType); assert.equal(m.d, d.menuDate, "denormalised menu data must match MySQL");
    }
    for (const u of await db.collection("app_users").find().toArray()) {
      assert.match(u.passwordHash, /^\$2[aby]\$/, "passwords are bcrypt hashes");
      if (u.residentId) assert.ok(residents.has(u.residentId), `app_users -> unknown resident ${u.residentId}`);
      if (u.staffId) assert.ok(staff.has(u.staffId), `app_users -> unknown staff ${u.staffId}`);
    }
    const roles = new Set((await db.collection("app_users").find().toArray()).map((u) => u.role));
    assert.ok(roles.size >= 2, "at least 2 roles exist");
  } finally { await c.end(); await close(); }
});

test("MongoDB validators reject malformed documents", { skip: !up && "databases not running" }, async () => {
  const { db, close } = await mongoDb();
  try {
    await assert.rejects(() => db.collection("meal_feedback").insertOne({ menuId: "M001", residentId: "RES001", propertyId: "P001", mealType: "BREAKFAST", menuDate: "2026-10-19", rating: 9, createdAt: new Date() }), /validation/i);
    await assert.rejects(() => db.collection("app_users").insertOne({ username: "x", role: "ADMIN" }), /validation/i);
    await assert.rejects(() => db.collection("app_users").insertOne({ username: "admin", passwordHash: "h", role: "ADMIN", displayName: "d", active: true, createdAt: new Date() }), /duplicate|E11000/i);
  } finally { await close(); }
});
