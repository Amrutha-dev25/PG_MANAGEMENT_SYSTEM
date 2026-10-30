// Database connections (MySQL pool + MongoDB client). Configuration comes ONLY from environment variables.
import mysql, { Pool, PoolConnection } from "mysql2/promise";
import { MongoClient, Db } from "mongodb";

const g = globalThis as unknown as { __pgPool?: Pool; __pgMongo?: Promise<MongoClient> };

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}. Copy .env.example to .env and fill it in.`);
  return v;
}

export function pool(): Pool {
  if (!g.__pgPool) {
    g.__pgPool = mysql.createPool({
      host: env("MYSQL_HOST"),
      port: Number(process.env.MYSQL_PORT || 3306),
      user: env("MYSQL_USER"),
      password: process.env.MYSQL_PASSWORD || "",
      database: env("MYSQL_DATABASE"),
      connectionLimit: 10,
      decimalNumbers: true, // DECIMAL -> JS number
      dateStrings: true,    // DATE/TIME -> 'YYYY-MM-DD' / 'HH:MM:SS' (no timezone surprises)
      namedPlaceholders: false,
    });
  }
  return g.__pgPool;
}

/** Parameterised query helper. Values are always bound, never concatenated. */
export async function query<T = any>(sql: string, params: any[] = [], conn?: PoolConnection | Pool): Promise<T[]> {
  const [rows] = await (conn ?? pool()).query(sql, params);
  return rows as T[];
}

/** Run a function inside a MySQL transaction (commit on success, rollback on error). */
export async function withTransaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback().catch(() => {});
    throw e;
  } finally {
    conn.release();
  }
}

/** Call a stored procedure; returns its first result set. */
export async function callProc<T = any>(name: string, args: any[]): Promise<T[]> {
  const placeholders = args.map(() => "?").join(", ");
  const [res] = await pool().query(`CALL ${name}(${placeholders})`, args);
  // mysql2 returns [resultSet, OkPacket] for CALL
  const first = Array.isArray(res) ? (res as any[])[0] : [];
  return (Array.isArray(first) ? first : []) as T[];
}

export async function mongo(): Promise<Db> {
  if (!g.__pgMongo) {
    const client = new MongoClient(env("MONGODB_URI"), { serverSelectionTimeoutMS: 5000 });
    g.__pgMongo = client.connect();
  }
  const client = await g.__pgMongo;
  return client.db(env("MONGODB_DB"));
}
