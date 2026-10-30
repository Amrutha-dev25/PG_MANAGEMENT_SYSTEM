// Static checks: every sidebar link has a page, resources match SQL config, no hard-coded secrets.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT, walk } from "./helpers.mjs";

const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

test("every navigation link has a page", () => {
  const nav = read("src/lib/nav.ts");
  const hrefs = [...nav.matchAll(/href: "([^"]+)"/g)].map((m) => m[1]);
  assert.ok(hrefs.length >= 15);
  for (const h of hrefs) assert.ok(fs.existsSync(path.join(ROOT, "src/app/(app)", h, "page.tsx")), `no page for ${h}`);
});

test("every resource has SQL config and its columns exist in database/schema-spec.json", () => {
  const spec = JSON.parse(read("database/schema-spec.json"));
  const sqlTs = read("src/lib/resource-sql.ts");
  const resTs = read("src/lib/resources.ts");
  for (const m of sqlTs.matchAll(/^\s{2}(\w+): \{\n\s+table: "(\w+)"/gm)) {
    const [, key, table] = m;
    assert.ok(spec[table], `resource ${key}: unknown table ${table}`);
    assert.match(resTs, new RegExp(`^\\s{2}${key}: \\{`, "m"), `resource ${key} missing in resources.ts`);
    // every form field name (non-virtual) must be a real column
    const block = resTs.split(new RegExp(`^\\s{2}${key}: \\{`, "m"))[1]?.split(/^\s{2}\w+: \{/m)[0] ?? "";
    for (const f of block.matchAll(/\{ name: "(\w+)", label: [^}]*?type: "(\w+)"([^}]*)\}/g)) {
      if (/virtual: true/.test(f[3])) continue;
      assert.ok(spec[table].cols.includes(f[1]), `${key}.${f[1]} is not a column of ${table}`);
    }
  }
});

test("no hard-coded credentials / secrets in source", () => {
  const files = [...walk(path.join(ROOT, "src")), ...walk(path.join(ROOT, "scripts")), ...walk(path.join(ROOT, "database"))].filter((f) => /\.(ts|tsx|mjs|js)$/.test(f));
  for (const f of files) {
    const t = fs.readFileSync(f, "utf8");
    assert.doesNotMatch(t, /mysql:\/\/\w+:\w+@/i, `${f}: connection string with password`);
    assert.doesNotMatch(t, /(MYSQL|DB)_?PASSWORD\s*[:=]\s*["'][^"']+["']/, `${f}: hard-coded database password`);
  }
  assert.ok(!fs.existsSync(path.join(ROOT, ".env")) || read(".gitignore").includes(".env"), ".env must be git-ignored");
});

test("every API route enforces authentication", () => {
  const routes = walk(path.join(ROOT, "src/app/api")).filter((f) => f.endsWith("route.ts"));
  for (const r of routes) {
    if (/auth[\\/](login|logout)/.test(r)) continue;
    const t = fs.readFileSync(r, "utf8");
    assert.match(t, /requireSession|getSession/, `${path.relative(ROOT, r)} does not check the session`);
  }
});
