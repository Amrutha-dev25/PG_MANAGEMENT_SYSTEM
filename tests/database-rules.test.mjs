// Business rules enforced INSIDE MySQL (triggers, constraints, procedures). Runs in a transaction and rolls back.
import test from "node:test";
import assert from "node:assert/strict";
import { dbAvailable, sql } from "./helpers.mjs";

const up = await dbAvailable();
const opts = { skip: !up && "databases not running" };
const rejects = async (c, q, re) => assert.rejects(() => c.query(q), re);

test("constraints, triggers and procedures reject invalid data", opts, async () => {
  const c = await sql();
  try {
    await c.query("START TRANSACTION");
    await rejects(c, "INSERT INTO PROPERTY VALUES ('PX','n','Co-living',NULL,3,'s','c','12')", /chk_property_pincode|Check constraint/);
    await rejects(c, "INSERT INTO ROOM VALUES ('RX','1','Hexagon',2,100,'P001')", /chk_room_type|Check constraint/);
    await rejects(c, "INSERT INTO RESIDENT VALUES ('RX','a','b','not-an-email','Male','2000-01-01','s','c','560001')", /chk_resident_email|Check constraint/);
    await rejects(c, "INSERT INTO RESIDENT VALUES ('RX','a','b','a@b.com','Male','2030-01-01','s','c','560001')", /Date of birth must be in the past/);
    await rejects(c, "INSERT INTO PAYMENT VALUES ('PX','RES001','2026-01-01','RENT',-5,'PENDING')", /chk_payment_amount|Check constraint/);
    await rejects(c, "INSERT INTO STAFF VALUES ('SX','a','b','x',1,'2024-01-01','S004','P001')", /same property/);
    await rejects(c, "INSERT INTO BED VALUES ('R002',2,'Single','AVAILABLE')", /capacity reached/i);
    await rejects(c, "UPDATE BED SET Status='AVAILABLE' WHERE Room_ID='R001' AND Bed_No=1", /active allocation/i);
    await rejects(c, "UPDATE BED SET Status='OCCUPIED' WHERE Room_ID='R003' AND Bed_No=3", /through an allocation/i);
    await rejects(c, "DELETE FROM ALLOCATION WHERE Allocation_No='AL001'", /ACTIVE allocation cannot be deleted/);
    await rejects(c, "INSERT INTO ALLOCATION VALUES ('ALX','2026-10-01',NULL,'2026-10-01','ACTIVE',NULL,'RES001','R003',3)", /already has an active allocation/);
    await rejects(c, "INSERT INTO ALLOCATION VALUES ('ALX','2026-10-01',NULL,'2026-10-01','ACTIVE',NULL,'RES015','R001',1)", /not available/);
    await rejects(c, "UPDATE PAYMENT SET Amount=1 WHERE Payment_No='DEP-RES001'", /settled payment/);
    await rejects(c, "DELETE FROM RESIDENT WHERE Resident_ID='RES001'", /foreign key/i);
    await c.query("ROLLBACK");
  } finally { await c.end(); }
});

test("derived attributes (age, total due) and bed status stay consistent", opts, async () => {
  const c = await sql();
  try {
    const [[a]] = await c.query("SELECT fn_resident_age(DOB) age, TIMESTAMPDIFF(YEAR,DOB,CURDATE()) exp FROM RESIDENT WHERE Resident_ID='RES001'");
    assert.equal(a.age, a.exp);
    const [[d]] = await c.query("SELECT fn_resident_total_due('RES004') f, (SELECT Total_Due FROM vw_resident_dues WHERE Resident_ID='RES004') v");
    assert.equal(Number(d.f), Number(d.v));
    const [bad] = await c.query(`SELECT b.Room_ID, b.Bed_No FROM BED b
      WHERE (b.Status='OCCUPIED') <> EXISTS (SELECT 1 FROM ALLOCATION a WHERE a.Room_ID=b.Room_ID AND a.Bed_No=b.Bed_No AND a.Allocation_Status='ACTIVE')`);
    assert.equal(bad.length, 0, "every OCCUPIED bed has exactly an ACTIVE allocation");
    const [dup] = await c.query("SELECT Resident_ID FROM ALLOCATION WHERE Allocation_Status='ACTIVE' GROUP BY Resident_ID HAVING COUNT(*)>1");
    assert.equal(dup.length, 0, "no resident has two active allocations");
  } finally { await c.end(); }
});

test("procedure sp_transfer_resident is atomic (rolls back when target bed is taken)", opts, async () => {
  const c = await sql();
  try {
    await assert.rejects(() => c.query("CALL sp_transfer_resident('AL001','ALZ99','R001',2,CURDATE(),NULL)"), /not available/);
    const [[r]] = await c.query("SELECT Allocation_Status s FROM ALLOCATION WHERE Allocation_No='AL001'");
    assert.equal(r.s, "ACTIVE", "old allocation must be untouched after the failed transfer");
  } finally { await c.end(); }
});
