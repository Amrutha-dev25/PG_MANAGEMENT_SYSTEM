import { NextResponse } from "next/server";
import { COOKIE, getSession } from "@/lib/auth";
import { handler } from "@/lib/http";
import { audit } from "@/lib/audit";

export const POST = handler(async () => {
  const s = await getSession();
  if (s) await audit(s, "LOGOUT", "SESSION", s.username);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
  return res;
});
