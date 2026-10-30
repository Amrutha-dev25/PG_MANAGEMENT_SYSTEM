// Generates docs/DATA_DICTIONARY.md from the LIVE MySQL schema (so it can never drift from the database).
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { ROOT, loadEnv, requireEnv } from "./lib-env.mjs";
loadEnv(); requireEnv(["MYSQL_HOST", "MYSQL_USER", "MYSQL_DATABASE"]);
const db = process.env.MYSQL_DATABASE;
const c = await mysql.createConnection({ host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT || 3306), user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD || "" });
const [tables] = await c.query("SELECT TABLE_NAME n FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME", [db]);
let md = `# Data Dictionary (MySQL \`${db}\`)\n\n_Generated from the live database by \`node scripts/gen-data-dictionary.mjs\` — ${tables.length} tables._\n\n`;
for (const { n } of tables) {
  const [cols] = await c.query("SELECT COLUMN_NAME c, COLUMN_TYPE t, IS_NULLABLE nl, COLUMN_DEFAULT d, COLUMN_KEY k FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY ORDINAL_POSITION", [db, n]);
  const [fks] = await c.query(`SELECT COLUMN_NAME c, REFERENCED_TABLE_NAME rt, REFERENCED_COLUMN_NAME rc FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND REFERENCED_TABLE_NAME IS NOT NULL`, [db, n]);
  const [chk] = await c.query(`SELECT cc.CONSTRAINT_NAME n, cc.CHECK_CLAUSE x FROM information_schema.CHECK_CONSTRAINTS cc JOIN information_schema.TABLE_CONSTRAINTS tc ON tc.CONSTRAINT_NAME=cc.CONSTRAINT_NAME AND tc.CONSTRAINT_SCHEMA=cc.CONSTRAINT_SCHEMA WHERE tc.TABLE_SCHEMA=? AND tc.TABLE_NAME=? ORDER BY cc.CONSTRAINT_NAME`, [db, n]);
  md += `## ${n}\n\n| Column | Type | Null | Key | Default | References |\n|---|---|---|---|---|---|\n`;
  for (const x of cols) {
    const fk = fks.filter((f) => f.c === x.c).map((f) => `${f.rt}.${f.rc}`).join(", ");
    md += `| ${x.c} | ${x.t} | ${x.nl} | ${x.k === "PRI" ? "PK" : x.k === "UNI" ? "UNIQUE" : x.k === "MUL" ? "INDEX" : ""} | ${x.d ?? ""} | ${fk} |\n`;
  }
  if (chk.length) md += `\n**CHECK constraints:** ${chk.map((k) => `\`${k.n}\``).join(", ")}\n`;
  md += "\n";
}
const [views] = await c.query("SELECT TABLE_NAME n FROM information_schema.VIEWS WHERE TABLE_SCHEMA=? ORDER BY 1", [db]);
const [procs] = await c.query("SELECT ROUTINE_NAME n, ROUTINE_TYPE t FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=? ORDER BY 2,1", [db]);
const [trg] = await c.query("SELECT TRIGGER_NAME n, EVENT_OBJECT_TABLE t, ACTION_TIMING a, EVENT_MANIPULATION e FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=? ORDER BY 2,1", [db]);
md += `## Views\n\n${views.map((v) => `- \`${v.n}\``).join("\n")}\n\n## Stored procedures & functions\n\n${procs.map((p) => `- \`${p.n}\` (${p.t.toLowerCase()})`).join("\n")}\n\n## Triggers\n\n| Trigger | Table | When |\n|---|---|---|\n${trg.map((t) => `| ${t.n} | ${t.t} | ${t.a} ${t.e} |`).join("\n")}\n`;
fs.writeFileSync(path.join(ROOT, "docs", "DATA_DICTIONARY.md"), md);
console.log(`docs/DATA_DICTIONARY.md written (${tables.length} tables, ${views.length} views, ${procs.length} routines, ${trg.length} triggers)`);
await c.end();
