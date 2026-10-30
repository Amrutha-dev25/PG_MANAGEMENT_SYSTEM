// Authentication: bcrypt-verified accounts stored in MongoDB, JWT session in an httpOnly cookie.
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { HttpError } from "./http";

export type Role = "ADMIN" | "STAFF" | "RESIDENT";
export interface Session { username: string; role: Role; name: string; residentId?: string; staffId?: string }

export const COOKIE = "pg_session";
const MAX_AGE = 60 * 60 * 8; // 8 hours

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET is missing or too short. Set it in .env (see .env.example).");
  return new TextEncoder().encode(s);
}

export async function createToken(s: Session) {
  return new SignJWT({ ...s }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${MAX_AGE}s`).sign(secret());
}

export async function verifyToken(token?: string): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { username: payload.username as string, role: payload.role as Role, name: payload.name as string,
             residentId: payload.residentId as string | undefined, staffId: payload.staffId as string | undefined };
  } catch { return null; }
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return verifyToken(jar.get(COOKIE)?.value);
}

export const cookieOptions = () => ({
  httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: MAX_AGE,
  secure: process.env.COOKIE_SECURE === "true",
});

/** Use in API routes: returns the session or throws 401 / 403. */
export async function requireSession(roles?: Role[]): Promise<Session> {
  const s = await getSession();
  if (!s) throw new HttpError(401, "Please sign in.");
  if (roles && !roles.includes(s.role)) throw new HttpError(403, "You do not have permission for this action.");
  return s;
}
