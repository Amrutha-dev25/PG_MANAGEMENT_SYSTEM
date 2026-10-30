// The live MySQL schema must equal the relational schema drawn in docs/diagrams/Relational_schema.pdf
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT, dbAvailable, sql } from "./helpers.mjs";

const spec = JSON.parse(fs.readFileSync(path.join(ROOT, "database/schema-spec.json"), "utf8"));
delete spec._comment;
const up = await dbAvailable();

test("MySQL schema matches the relational schema (tables, columns, PKs, FKs)", { skip: !up && "databases not running" }, async () => {
  const c = await sql(); const db = process.env.MYSQL_DATABASE;
  try {
    const [tables] = await c.query("SELECT TABLE_NAME n FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_TYPE='BASE TABLE'", [db]);
    assert.deepEqual(tables.map((t) => t.n).sort(), Object.keys(spec).sort(), "table list differs from relational schema");
    for (const [t, s] of Object.entries(spec)) {
      const [cols] = await c.query("SELECT COLUMN_NAME n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY ORDINAL_POSITION", [db, t]);
      assert.deepEqual(cols.map((x) => x.n), s.cols, `${t}: columns differ`);
      const [pk] = await c.query("SELECT COLUMN_NAME n FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND CONSTRAINT_NAME='PRIMARY' ORDER BY ORDINAL_POSITION", [db, t]);
      assert.deepEqual(pk.map((x) => x.n), s.pk, `${t}: primary key differs`);
      const [fk] = await c.query(`SELECT GROUP_CONCAT(COLUMN_NAME ORDER BY ORDINAL_POSITION) c, REFERENCED_TABLE_NAME r FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND REFERENCED_TABLE_NAME IS NOT NULL GROUP BY CONSTRAINT_NAME, REFERENCED_TABLE_NAME`, [db, t]);
      const got = fk.map((x) => `${x.c}->${x.r}`).sort(), want = s.fks.map(([a, b]) => `${a}->${b}`).sort();
      assert.deepEqual(got, want, `${t}: foreign keys differ`);
    }
  } finally { await c.end(); }
});

test("SQL scripts define every required advanced feature", () => {
  const read = (f) => fs.readFileSync(path.join(ROOT, "database/mysql", f), "utf8");
  assert.ok((read("05_views.sql").match(/CREATE OR REPLACE VIEW/g) || []).length >= 5, "views");
  assert.ok((read("06_triggers.sql").match(/CREATE TRIGGER/g) || []).length >= 5, "triggers");
  assert.ok((read("07_procedures.sql").match(/CREATE PROCEDURE/g) || []).length >= 3, "procedures");
  assert.ok((read("04_functions.sql").match(/CREATE FUNCTION/g) || []).length >= 2, "functions");
  assert.match(read("07_procedures.sql"), /START TRANSACTION[\s\S]*COMMIT/, "transactions");
  assert.match(read("03_indexes.sql"), /FULLTEXT/, "full-text index");
  assert.match(read("02_constraints.sql"), /ALTER TABLE[\s\S]*CHECK/, "ALTER + CHECK");
});
