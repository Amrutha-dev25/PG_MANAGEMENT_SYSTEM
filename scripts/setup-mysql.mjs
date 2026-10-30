// Runs database/mysql/*.sql in order.  Usage: node scripts/setup-mysql.mjs [--reset] [--no-seed]
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { ROOT, loadEnv, requireEnv } from "./lib-env.mjs";

loadEnv();
requireEnv(["MYSQL_HOST", "MYSQL_USER", "MYSQL_DATABASE"]);

const args = new Set(process.argv.slice(2));
const dir = path.join(ROOT, "database", "mysql");

/** Split a SQL script into statements, honouring DELIMITER commands. */
export function splitSql(text) {
  const out = [];
  let delimiter = ";";
  let buf = "";
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!buf && (line === "" || line.startsWith("--"))) continue;
    const m = /^DELIMITER\s+(\S+)$/i.exec(line);
    if (m && !buf) { delimiter = m[1]; continue; }
    buf += rawLine + "\n";
    if (line.endsWith(delimiter)) {
      out.push(buf.trim().slice(0, -delimiter.length).trim());
      buf = "";
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter(Boolean);
}

const files = fs.readdirSync(dir).filter((f) => /^0[1-8]_.*\.sql$/.test(f)).sort()
  .filter((f) => !(args.has("--no-seed") && f.startsWith("08_")));

const conn = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD || "",
  multipleStatements: false,
});

try {
  if (args.has("--reset")) {
    console.log(`Dropping database ${process.env.MYSQL_DATABASE} ...`);
    await conn.query(`DROP DATABASE IF EXISTS \`${process.env.MYSQL_DATABASE}\``);
  }
  for (const file of files) {
    const statements = splitSql(fs.readFileSync(path.join(dir, file), "utf8"));
    process.stdout.write(`> ${file} (${statements.length} statements) ... `);
    for (const sql of statements) {
      try { await conn.query(sql); }
      catch (e) {
        console.error(`\nFAILED in ${file}:\n${sql.slice(0, 300)}\n-> ${e.message}`);
        if (/1419|SUPER|log_bin_trust/i.test(e.message)) {
          console.error("\nHint: run  SET GLOBAL log_bin_trust_function_creators = 1;  as MySQL root, then retry.");
        }
        process.exit(1);
      }
    }
    console.log("ok");
  }
  console.log("MySQL setup complete.");
} finally {
  await conn.end();
}
