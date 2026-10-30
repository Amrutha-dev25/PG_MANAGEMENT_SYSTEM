// Loads .env (if present) into process.env. Node >= 20.12 required.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const file = path.join(ROOT, name);
    if (fs.existsSync(file)) {
      try { process.loadEnvFile(file); } catch { /* ignore */ }
    }
  }
}

export function requireEnv(keys) {
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`\nMissing environment variables: ${missing.join(", ")}\nCopy .env.example to .env and fill in your values.\n`);
    process.exit(1);
  }
}
