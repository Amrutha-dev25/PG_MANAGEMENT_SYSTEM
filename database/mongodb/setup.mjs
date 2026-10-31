// =====================================================================
// MongoDB setup: collections, JSON-Schema validators, indexes, seed data.
// Run via:  npm run db:mongo  (or  node scripts/setup-mongo.mjs --reset)
//
// WHY MongoDB (see docs/PROJECT_REPORT.md section 6):
//   * complaint_updates - append-only, variable-shape timeline events per complaint
//   * meal_feedback     - free-text + tags + ratings, analysed with aggregation
//   * audit_logs        - high-volume, schema-flexible activity trail
//   * app_users         - login accounts (infrastructure data that is NOT part of
//                         the PG domain ER, kept out of the relational schema)
// Cross-database references are by business key only (e.g. complaintNo = COMPLAINT.Complaint_No).
// =====================================================================
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";

const ROLES = ["ADMIN", "STAFF", "RESIDENT"];

export const COLLECTIONS = {
  app_users: {
    validator: {
      bsonType: "object",
      required: ["username", "passwordHash", "role", "displayName", "active", "createdAt"],
      additionalProperties: true,
      properties: {
        username: { bsonType: "string", minLength: 3, maxLength: 40 },
        passwordHash: { bsonType: "string", description: "bcrypt hash - never the plain password" },
        role: { enum: ROLES },
        displayName: { bsonType: "string" },
        residentId: { bsonType: "string", description: "RESIDENT.Resident_ID (role RESIDENT)" },
        staffId: { bsonType: "string", description: "STAFF.Staff_ID (role STAFF)" },
        active: { bsonType: "bool" },
        createdAt: { bsonType: "date" },
        lastLoginAt: { bsonType: ["date", "null"] },
      },
    },
    indexes: [
      { key: { username: 1 }, options: { unique: true, name: "uq_username" } },
      { key: { role: 1 }, options: { name: "idx_role" } },
      { key: { residentId: 1 }, options: { name: "idx_resident", sparse: true } },
    ],
  },
  complaint_updates: {
    validator: {
      bsonType: "object",
      required: ["complaintNo", "type", "message", "author", "createdAt"],
      properties: {
        complaintNo: { bsonType: "string", description: "COMPLAINT.Complaint_No" },
        type: { enum: ["COMMENT", "STATUS_CHANGE", "ASSIGNMENT", "RESOLUTION"] },
        message: { bsonType: "string", minLength: 1, maxLength: 2000 },
        fromStatus: { bsonType: "string" },
        toStatus: { bsonType: "string" },
        internal: { bsonType: "bool", description: "internal notes are hidden from residents" },
        attachments: {
          bsonType: "array",
          items: { bsonType: "object", required: ["name"], properties: { name: { bsonType: "string" }, note: { bsonType: "string" } } },
        },
        author: {
          bsonType: "object",
          required: ["username", "role"],
          properties: { username: { bsonType: "string" }, role: { enum: ROLES } },
        },
        createdAt: { bsonType: "date" },
      },
    },
    indexes: [
      { key: { complaintNo: 1, createdAt: -1 }, options: { name: "idx_complaint_timeline" } },
      { key: { type: 1, createdAt: -1 }, options: { name: "idx_type_time" } },
      { key: { message: "text" }, options: { name: "txt_message", default_language: "english" } },
    ],
  },
  meal_feedback: {
    validator: {
      bsonType: "object",
      required: ["menuId", "residentId", "propertyId", "mealType", "menuDate", "rating", "createdAt"],
      properties: {
        menuId: { bsonType: "string", description: "MENU.Menu_ID" },
        residentId: { bsonType: "string", description: "RESIDENT.Resident_ID" },
        propertyId: { bsonType: "string", description: "denormalised from MENU for fast aggregation" },
        mealType: { enum: ["BREAKFAST", "LUNCH", "SNACKS", "DINNER"] },
        menuDate: { bsonType: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        rating: { bsonType: "int", minimum: 1, maximum: 5 },
        comment: { bsonType: "string", maxLength: 1000 },
        tags: { bsonType: "array", items: { bsonType: "string" } },
        createdAt: { bsonType: "date" },
      },
    },
    indexes: [
      { key: { menuId: 1, residentId: 1 }, options: { unique: true, name: "uq_menu_resident" } },
      { key: { propertyId: 1, mealType: 1 }, options: { name: "idx_property_meal" } },
      { key: { createdAt: -1 }, options: { name: "idx_created" } },
    ],
  },
  audit_logs: {
    validator: {
      bsonType: "object",
      required: ["actor", "action", "entity", "createdAt"],
      properties: {
        actor: { bsonType: "object", required: ["username", "role"], properties: { username: { bsonType: "string" }, role: { enum: ROLES } } },
        action: { enum: ["CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "LOGIN_FAILED", "ACTION"] },
        entity: { bsonType: "string" },
        entityId: { bsonType: "string" },
        details: { bsonType: "object" },
        createdAt: { bsonType: "date" },
      },
    },
    indexes: [
      { key: { createdAt: -1 }, options: { name: "idx_created" } },
      { key: { entity: 1, entityId: 1 }, options: { name: "idx_entity" } },
      { key: { "actor.username": 1, createdAt: -1 }, options: { name: "idx_actor_time" } },
      { key: { action: 1 }, options: { name: "idx_action" } },
    ],
  },
};

const d = (s) => new Date(s);

function seedDocs(passwords) {
  const hash = (p) => bcrypt.hashSync(p, 10);
  const now = new Date();
  const users = [
    { username: "admin", passwordHash: hash(passwords.admin), role: "ADMIN", displayName: "Administrator", active: true, createdAt: now, lastLoginAt: null },
    { username: "staff", passwordHash: hash(passwords.staff), role: "STAFF", displayName: "Anita Rao", staffId: "S001", active: true, createdAt: now, lastLoginAt: null },
    { username: "aarav", passwordHash: hash(passwords.resident), role: "RESIDENT", displayName: "Aarav Sharma", residentId: "RES001", active: true, createdAt: now, lastLoginAt: null },
    { username: "diya", passwordHash: hash(passwords.resident), role: "RESIDENT", displayName: "Diya Patel", residentId: "RES007", active: true, createdAt: now, lastLoginAt: null },
    { username: "neha", passwordHash: hash(passwords.resident), role: "RESIDENT", displayName: "Neha Joshi", residentId: "RES012", active: true, createdAt: now, lastLoginAt: null },
  ];

  const A = { username: "staff", role: "STAFF" };
  const R1 = { username: "aarav", role: "RESIDENT" };
  const AD = { username: "admin", role: "ADMIN" };
  const upd = (complaintNo, type, message, author, createdAt, extra = {}) => ({ complaintNo, type, message, author, createdAt: d(createdAt), ...extra });
  const complaint_updates = [
    upd("C001", "COMMENT", "Tap is leaking continuously, attaching a photo of the wet floor.", R1, "2026-10-12T08:15:00Z", { attachments: [{ name: "leak_photo.jpg" }] }),
    upd("C001", "STATUS_CHANGE", "Plumber scheduled for tomorrow morning.", A, "2026-10-12T10:00:00Z", { fromStatus: "OPEN", toStatus: "IN_PROGRESS" }),
    upd("C001", "COMMENT", "Spare washer ordered, needs one more day.", A, "2026-10-13T11:30:00Z", { internal: true }),
    upd("C003", "STATUS_CHANGE", "Warden inspected the fan.", A, "2026-09-28T12:00:00Z", { fromStatus: "OPEN", toStatus: "IN_PROGRESS" }),
    upd("C003", "RESOLUTION", "Fan bearing replaced and tested.", A, "2026-09-30T15:20:00Z", { fromStatus: "IN_PROGRESS", toStatus: "RESOLVED" }),
    upd("C005", "COMMENT", "Cook has been informed; dinner temperature will be monitored.", A, "2026-10-19T21:10:00Z"),
    upd("C005", "STATUS_CHANGE", "Under review with the kitchen team.", A, "2026-10-20T09:00:00Z", { fromStatus: "OPEN", toStatus: "IN_PROGRESS" }),
    upd("C006", "ASSIGNMENT", "Assigned to security supervisor for lock replacement.", AD, "2026-10-17T20:00:00Z"),
    upd("C006", "STATUS_CHANGE", "Locksmith booked for tomorrow.", A, "2026-10-17T20:30:00Z", { fromStatus: "OPEN", toStatus: "IN_PROGRESS" }),
    upd("C008", "RESOLUTION", "Heating element replaced.", A, "2026-09-22T17:45:00Z", { fromStatus: "OPEN", toStatus: "RESOLVED" }),
    upd("C009", "RESOLUTION", "Router firmware updated; issue not reproducible.", A, "2026-09-08T13:00:00Z", { fromStatus: "OPEN", toStatus: "CLOSED" }),
  ];

  // Menu ids: M001-M014 = P001, M015-M028 = P002, M029-M042 = P003 (see database/mysql/08_seed.sql)
  const mf = (menuId, residentId, propertyId, mealType, menuDate, rating, comment, tags) => ({
    menuId, residentId, propertyId, mealType, menuDate, rating, comment, tags, createdAt: d(`${menuDate}T21:00:00Z`),
  });
  const meal_feedback = [
    mf("M001", "RES001", "P001", "BREAKFAST", "2026-10-19", 5, "Idli was soft and the sambar was perfect.", ["tasty", "fresh"]),
    mf("M001", "RES002", "P001", "BREAKFAST", "2026-10-19", 4, "Good, coffee could be hotter.", ["tasty"]),
    mf("M002", "RES001", "P001", "DINNER", "2026-10-19", 3, "Average dal, chapati slightly hard.", ["average"]),
    mf("M003", "RES001", "P001", "BREAKFAST", "2026-10-20", 4, "Dosa was crisp.", ["tasty", "crisp"]),
    mf("M004", "RES003", "P001", "DINNER", "2026-10-20", 2, "Food was cold when served.", ["cold", "slow-service"]),
    mf("M004", "RES004", "P001", "DINNER", "2026-10-20", 2, "Rice was undercooked.", ["undercooked"]),
    mf("M015", "RES007", "P002", "BREAKFAST", "2026-10-19", 5, "Loved the poha and masala tea.", ["tasty", "fresh"]),
    mf("M016", "RES008", "P002", "DINNER", "2026-10-19", 2, "Dinner was cold and rice undercooked.", ["cold", "undercooked"]),
    mf("M016", "RES009", "P002", "DINNER", "2026-10-19", 3, "Okay but needs more variety.", ["average", "variety"]),
    mf("M017", "RES010", "P002", "BREAKFAST", "2026-10-20", 4, "Nice breakfast, on time.", ["tasty"]),
    mf("M029", "RES011", "P003", "BREAKFAST", "2026-10-19", 4, "Good quality.", ["fresh"]),
    mf("M030", "RES012", "P003", "DINNER", "2026-10-19", 5, "Paneer butter masala was excellent.", ["tasty", "fresh"]),
    mf("M030", "RES013", "P003", "DINNER", "2026-10-19", 4, "Tasty, slightly oily.", ["tasty", "oily"]),
    mf("M031", "RES014", "P003", "BREAKFAST", "2026-10-20", 3, "Average.", ["average"]),
  ];

  const al = (actor, action, entity, entityId, details, at) => ({ actor, action, entity, entityId, details, createdAt: d(at) });
  const audit_logs = [
    al(AD, "LOGIN", "SESSION", "admin", { ip: "127.0.0.1" }, "2026-10-19T08:00:00Z"),
    al(A, "ACTION", "ALLOCATION", "AL016", { op: "sp_allocate_bed", resident: "RES014", bed: "R010-2" }, "2026-06-10T09:30:00Z"),
    al(A, "CREATE", "COMPLAINT", "C006", { category: "Security", priority: "URGENT" }, "2026-10-17T20:00:00Z"),
    al(A, "UPDATE", "COMPLAINT", "C006", { Status: "IN_PROGRESS" }, "2026-10-17T20:30:00Z"),
    al(A, "ACTION", "PAYMENT", "RENT-202610-RES001", { op: "sp_settle_payment", paidOn: "2026-10-04" }, "2026-10-04T10:00:00Z"),
    al(AD, "ACTION", "PAYMENT", "RENT-202610", { op: "sp_generate_monthly_rent", created: 13 }, "2026-10-01T07:00:00Z"),
    al(AD, "UPDATE", "ROOM", "R004", { Rent: 9500 }, "2026-10-02T11:00:00Z"),
    al(AD, "DELETE", "ASSET", "A099", { reason: "duplicate entry" }, "2026-10-03T12:00:00Z"),
    al({ username: "unknown", role: "STAFF" }, "LOGIN_FAILED", "SESSION", "unknown", { reason: "bad credentials" }, "2026-10-20T22:10:00Z"),
  ];
  return { app_users: users, complaint_updates, meal_feedback, audit_logs };
}

export async function setupMongo({ uri, dbName, reset = false, seed = true, passwords, log = console.log }) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  const db = client.db(dbName);
  try {
    if (reset) {
      for (const name of Object.keys(COLLECTIONS)) await db.collection(name).drop().catch(() => {});
      log(`Dropped collections in ${dbName}`);
    }
    const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));
    for (const [name, def] of Object.entries(COLLECTIONS)) {
      const validation = { validator: { $jsonSchema: def.validator }, validationLevel: "strict", validationAction: "error" };
      if (!existing.has(name)) await db.createCollection(name, validation);
      else await db.command({ collMod: name, ...validation });
      for (const idx of def.indexes) await db.collection(name).createIndex(idx.key, idx.options);
      log(`  collection ${name}: validator + ${def.indexes.length} indexes`);
    }
    if (seed) {
      const docs = seedDocs(passwords);
      for (const [name, list] of Object.entries(docs)) {
        const col = db.collection(name);
        if ((await col.countDocuments()) === 0) { await col.insertMany(list); log(`  seeded ${name}: ${list.length} documents`); }
        else log(`  ${name}: already has data, seed skipped`);
      }
    }
  } finally {
    await client.close();
  }
}

// Allow:  node database/mongodb/setup.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  const { loadEnv } = await import("../../scripts/lib-env.mjs");
  loadEnv();
  await setupMongo({
    uri: process.env.MONGODB_URI, dbName: process.env.MONGODB_DB || "pg_management_nosql",
    reset: process.argv.includes("--reset"), passwords: demoPasswords(),
  });
}

export function demoPasswords() {
  return {
    admin: process.env.SEED_ADMIN_PASSWORD || "Admin@123",
    staff: process.env.SEED_STAFF_PASSWORD || "Staff@123",
    resident: process.env.SEED_RESIDENT_PASSWORD || "Resident@123",
  };
}
