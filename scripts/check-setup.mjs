// Usage: npm run check      -> verifies .env, MySQL, MongoDB and demo accounts BEFORE you start the app / demo.
import mysql from "mysql2/promise";
import { MongoClient } from "mongodb";
import { loadEnv } from "./lib-env.mjs";

loadEnv();
let bad = 0;
const ok = (m) => console.log("  \u2713 " + m);
const no = (m, fix) => { bad++; console.log("  \u2717 " + m + (fix ? "\n      -> " + fix : "")); };

console.log("\n1) .env values");
for (const k of ["MYSQL_HOST", "MYSQL_USER", "MYSQL_DATABASE", "MONGODB_URI", "MONGODB_DB"]) process.env[k] ? ok(k) : no(`${k} is missing`, "copy .env.example to .env and fill it in");
(process.env.AUTH_SECRET || "").length >= 16 ? ok("AUTH_SECRET") : no("AUTH_SECRET missing or shorter than 16 characters", "generate: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
process.env.STAFF_SIGNUP_CODE && process.env.ADMIN_SIGNUP_CODE ? ok("STAFF_SIGNUP_CODE / ADMIN_SIGNUP_CODE") : no("signup codes missing (only needed for 'Create account' as Staff/Admin)", "add STAFF_SIGNUP_CODE=... and ADMIN_SIGNUP_CODE=... to .env");

console.log("\n2) MySQL");
try {
  const c = await mysql.createConnection({ host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT || 3306), user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD || "", database: process.env.MYSQL_DATABASE });
  ok("connected to " + process.env.MYSQL_DATABASE);
  const [t] = await c.query("SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'");
  t[0].n >= 20 ? ok(`${t[0].n} tables`) : no(`only ${t[0].n} tables found`, "npm run db:setup");
  const [p] = await c.query("SELECT COUNT(*) n FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_type = 'PROCEDURE'");
  p[0].n >= 5 ? ok(`${p[0].n} stored procedures`) : no(`only ${p[0].n} stored procedures`, "npm run db:setup");
  const [r] = await c.query("SELECT COUNT(*) n FROM RESIDENT");
  r[0].n > 0 ? ok(`${r[0].n} residents in database`) : no("RESIDENT table is empty", "npm run db:setup");
  await c.end();
} catch (e) {
  no("MySQL: " + e.message, /ECONNREFUSED/.test(e.message) ? "start the MySQL service" : /Access denied/.test(e.message) ? "fix MYSQL_USER / MYSQL_PASSWORD in .env" : /Unknown database/.test(e.message) ? "npm run db:setup" : "");
}

console.log("\n3) MongoDB");
try {
  const m = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 4000 });
  await m.connect();
  const db = m.db(process.env.MONGODB_DB);
  ok("connected to " + process.env.MONGODB_DB);
  const n = await db.collection("app_users").countDocuments();
  n > 0 ? ok(`${n} login accounts`) : no("no login accounts found", "npm run db:setup");
  for (const u of ["admin", "staff", "aarav"]) (await db.collection("app_users").findOne({ username: u })) ? ok(`demo account '${u}' exists`) : no(`demo account '${u}' missing`, "npm run db:mongo -- --reset  (or npm run db:setup)");
  await m.close();
} catch (e) {
  no("MongoDB: " + e.message, "start the MongoDB service (mongod) and check MONGODB_URI");
}

console.log(bad ? `\n${bad} problem(s) found - fix the lines marked \u2717 above.\n` : "\nAll good - run  npm run dev  and open http://localhost:3000\n");
process.exit(bad ? 1 : 0);
