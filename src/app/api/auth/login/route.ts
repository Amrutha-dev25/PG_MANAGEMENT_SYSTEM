import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { mongo } from "@/lib/db";
import { createToken, COOKIE, cookieOptions, type Session } from "@/lib/auth";
import { HttpError, handler, readJson } from "@/lib/http";
import { audit } from "@/lib/audit";

// very small in-memory brute-force guard: 5 failures => 5 minute lock per username
const attempts = new Map<string, { n: number; until: number }>();
const DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.3C0U1lG2dQj8x7Z9s5Qy5Jz1b1pa";

export const POST = handler(async (req: Request) => {
  const body = await readJson(req);
  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!username || !password) throw new HttpError(400, "Enter your username and password.");

  const a = attempts.get(username);
  if (a && a.until > Date.now()) throw new HttpError(429, "Too many failed attempts. Try again in a few minutes.");

  const db = await mongo();
  const user = await db.collection("app_users").findOne({ username, active: true });
  const valid = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !valid) {
    const n = (a?.n || 0) + 1;
    attempts.set(username, { n, until: n >= 5 ? Date.now() + 5 * 60_000 : 0 });
    await audit({ username, role: "STAFF" }, "LOGIN_FAILED", "SESSION", username, { reason: "bad credentials" });
    throw new HttpError(401, "Invalid username or password.");
  }
  attempts.delete(username);
  await db.collection("app_users").updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

  const session: Session = { username: user.username, role: user.role, name: user.displayName, residentId: user.residentId, staffId: user.staffId };
  const res = NextResponse.json({ user: session });
  res.cookies.set(COOKIE, await createToken(session), cookieOptions());
  await audit(session, "LOGIN", "SESSION", user.username);
  return res;
});
