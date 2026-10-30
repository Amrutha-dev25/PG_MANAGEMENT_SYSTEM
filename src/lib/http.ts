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
  if (code === "ECONNREFUSED" || code === "PROTOCOL_CONNECTION_LOST" || e?.name === "MongoServerSelectionError")
    return NextResponse.json({ error: "Database is not reachable. Check that MySQL and MongoDB are running." }, { status: 503 });
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
