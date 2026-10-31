import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { mongo, query } from "@/lib/db";
import { createToken, COOKIE, cookieOptions, type Role, type Session } from "@/lib/auth";
import { HttpError, handler, readJson } from "@/lib/http";
import { audit } from "@/lib/audit";

const allowedRoles = ["ADMIN", "STAFF", "RESIDENT"] as const;

export const POST = handler(async (req: Request) => {
  const body = await readJson(req);
  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  const displayNameInput = String(body.name || "").trim();
  const role = String(body.role || "").toUpperCase() as Role;
  const accessCode = String(body.accessCode || "");
  const residentId = String(body.residentId || "").trim();
  const staffId = String(body.staffId || "").trim();

  if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw new HttpError(400, "Username must be 3–40 characters (letters, numbers, dot, underscore or hyphen).");
  if (password.length < 8) throw new HttpError(400, "Password must contain at least 8 characters.");
  if (!allowedRoles.includes(role as any)) throw new HttpError(400, "Choose a valid account position.");

  let displayName = displayNameInput;
  let linkedResidentId: string | undefined;
  let linkedStaffId: string | undefined;

  if (role === "ADMIN") {
    if (!process.env.ADMIN_SIGNUP_CODE || accessCode !== process.env.ADMIN_SIGNUP_CODE) {
      throw new HttpError(403, "A valid administrator registration code is required.");
    }
    if (displayName.length < 2) throw new HttpError(400, "Enter your full name.");
  } else if (role === "STAFF") {
    if (!process.env.STAFF_SIGNUP_CODE || accessCode !== process.env.STAFF_SIGNUP_CODE) {
      throw new HttpError(403, "A valid staff registration code is required.");
    }
    if (!staffId) throw new HttpError(400, "Enter your Staff ID.");
    const rows = await query<any>(
      "SELECT Staff_ID, First_Name, Last_Name FROM STAFF WHERE Staff_ID = ? LIMIT 1",
      [staffId]
    );
    if (!rows.length) throw new HttpError(400, "Staff ID was not found. Ask the PG administrator to add your staff record first.");
    linkedStaffId = rows[0].Staff_ID;
    displayName = `${rows[0].First_Name} ${rows[0].Last_Name}`.trim();
  } else {
    if (!residentId) throw new HttpError(400, "Enter your Resident ID.");
    const rows = await query<any>(
      "SELECT Resident_ID, FirstName, LastName FROM RESIDENT WHERE Resident_ID = ? LIMIT 1",
      [residentId]
    );
    if (!rows.length) throw new HttpError(400, "Resident ID was not found. Ask the PG administrator to add your resident record first.");
    linkedResidentId = rows[0].Resident_ID;
    displayName = `${rows[0].FirstName} ${rows[0].LastName}`.trim();
  }

  const db = await mongo();
  const users = db.collection("app_users");
  if (await users.findOne({ username })) throw new HttpError(409, "That username is already taken. Choose another.");
  if (linkedResidentId && await users.findOne({ residentId: linkedResidentId })) {
    throw new HttpError(409, "An account is already registered for this Resident ID.");
  }
  if (linkedStaffId && await users.findOne({ staffId: linkedStaffId })) {
    throw new HttpError(409, "An account is already registered for this Staff ID.");
  }

  const doc = {
    username,
    passwordHash: await bcrypt.hash(password, 12),
    role,
    displayName,
    ...(linkedResidentId ? { residentId: linkedResidentId } : {}),
    ...(linkedStaffId ? { staffId: linkedStaffId } : {}),
    active: true,
    createdAt: new Date(),
    lastLoginAt: new Date(),
  };
  await users.insertOne(doc);

  const session: Session = {
    username,
    role,
    name: displayName,
    ...(linkedResidentId ? { residentId: linkedResidentId } : {}),
    ...(linkedStaffId ? { staffId: linkedStaffId } : {}),
  };
  const res = NextResponse.json({ user: session, message: "Account created successfully." }, { status: 201 });
  res.cookies.set(COOKIE, await createToken(session), cookieOptions());
  await audit(session, "ACTION", "ACCOUNT", username, { action: "REGISTER", role });
  return res;
});
