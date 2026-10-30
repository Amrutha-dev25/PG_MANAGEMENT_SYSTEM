import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { MongoClient } from "mongodb";
import { loadEnv } from "../scripts/lib-env.mjs";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnv();

export async function dbAvailable() {
  try {
    const c = await mysql.createConnection({ host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT || 3306), user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD || "", database: process.env.MYSQL_DATABASE });
    await c.end();
    const m = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 2500 }); await m.connect(); await m.close();
    return true;
  } catch { return false; }
}
export const sql = () => mysql.createConnection({ host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT || 3306), user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD || "", database: process.env.MYSQL_DATABASE, dateStrings: true });
export async function mongoDb() { const c = new MongoClient(process.env.MONGODB_URI); await c.connect(); return { db: c.db(process.env.MONGODB_DB), close: () => c.close() }; }
export const walk = (dir, out = []) => { for (const f of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, f.name); f.isDirectory() ? walk(p, out) : out.push(p); } return out; };
