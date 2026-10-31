// API helpers: JSON responses, typed errors and MySQL error translation.
import { NextResponse } from "next/server";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const ok = (data: any, status = 200) => NextResponse.json(data, { status });

/** Turn any thrown error into a friendly JSON response. */
export function fail(e: any) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  const code = e?.code as string | undefined;
  const errno = e?.errno as number | undefined;
  const msg: string = e?.sqlMessage || e?.message || "Unexpected error";
  // Business rules raised by triggers / procedures (SIGNAL SQLSTATE '45000')
  if (errno === 1644) return NextResponse.json({ error: msg }, { status: 400 });
  if (code === "ER_DUP_ENTRY") {
    const m = /Duplicate entry '(.+?)' for key '(?:.*\.)?(.+?)'/.exec(msg);
    return NextResponse.json({ error: `Duplicate value${m ? ` '${m[1]}'` : ""} - it already exists.` }, { status: 409 });
  }
  if (code === "ER_ROW_IS_REFERENCED_2" || code === "ER_ROW_IS_REFERENCED")
    return NextResponse.json({ error: "Cannot delete: this record is still referenced by other records." }, { status: 409 });
  if (code === "ER_NO_REFERENCED_ROW_2" || code === "ER_NO_REFERENCED_ROW")
    return NextResponse.json({ error: "A selected related record does not exist." }, { status: 400 });
  if (errno === 3819) {
    const m = /Check constraint '(.+?)'/.exec(msg);
    return NextResponse.json({ error: `Value rejected by database rule${m ? ` (${m[1]})` : ""}.` }, { status: 400 });
  }
  if (code === "ER_DATA_TOO_LONG") return NextResponse.json({ error: "A value is too long for its field." }, { status: 400 });
  if (code === "ER_BAD_NULL_ERROR") return NextResponse.json({ error: "A required value is missing." }, { status: 400 });
  if (code === "ER_TRUNCATED_WRONG_VALUE" || code === "ER_WRONG_VALUE" || code === "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD")
    return NextResponse.json({ error: "A value has an invalid format." }, { status: 400 });
  if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "ENOTFOUND" || code === "PROTOCOL_CONNECTION_LOST" ||
      e?.name === "MongoServerSelectionError" || e?.name === "MongoNetworkError" || e?.name === "MongoNetworkTimeoutError")
    return NextResponse.json({ error: "Database is not reachable. Check that MySQL and MongoDB are running and that .env points to them." }, { status: 503 });
  // Setup problems (first run on a new machine) - say exactly what to do instead of a vague 500
  if (code === "ER_ACCESS_DENIED_ERROR" || errno === 1045)
    return NextResponse.json({ error: "MySQL refused the login. Check MYSQL_USER and MYSQL_PASSWORD in your .env file, then restart the app." }, { status: 503 });
  if (code === "ER_BAD_DB_ERROR" || errno === 1049)
    return NextResponse.json({ error: "MySQL database not found. Run  npm run db:setup  once to create it." }, { status: 503 });
  if (code === "ER_NO_SUCH_TABLE" || errno === 1146 || code === "ER_SP_DOES_NOT_EXIST" || errno === 1305 || errno === 1356)
    return NextResponse.json({ error: "A database table, view or procedure is missing. Run  npm run db:setup  to rebuild the database." }, { status: 503 });
  if (e?.name === "MongoServerError" && (e?.code === 13 || e?.code === 18))
    return NextResponse.json({ error: "MongoDB refused the login. Check MONGODB_URI in your .env file." }, { status: 503 });
  if (e?.name === "MongoServerError" && e?.code === 121)
    return NextResponse.json({ error: "MongoDB rejected the data (schema validation)." }, { status: 400 });
  if (/Missing environment variable|AUTH_SECRET/.test(String(e?.message)))
    return NextResponse.json({ error: String(e.message) }, { status: 500 });
  console.error("[api error]", e);
  return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
}

/** Wrap a route handler so errors always become JSON. */
export function handler<A extends any[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try { return await fn(...args); } catch (e) { return fail(e); }
  };
}

export async function readJson(req: Request): Promise<any> {
  try { return await req.json(); } catch { throw new HttpError(400, "Request body must be valid JSON."); }
}
