-- =====================================================================
-- 10_dml_transactions_demo.sql : INSERT / UPDATE / DELETE / SELECT and
-- transactions, triggers and procedures in action.
-- Everything runs inside a transaction that is ROLLED BACK at the end,
-- so the demo data is never changed and the script can be re-run.
-- =====================================================================
USE pg_management;
START TRANSACTION;

-- INSERT
INSERT INTO RESIDENT (Resident_ID, FirstName, LastName, Email, Gender, DOB, Street, City, Pincode)
VALUES ('RES900', 'Demo', 'Student', 'demo.student@example.com', 'Female', '2004-02-02', '1 Demo Road', 'Bengaluru', '560001');
INSERT INTO RESIDENT_PHONE (Resident_ID, Phone_No) VALUES ('RES900', '9000012345');

-- Procedure with transaction: allocate a bed (trigger marks it OCCUPIED)
CALL sp_allocate_bed('AL900', 'RES900', 'R006', 3, CURDATE(), NULL, 'demo allocation');
SELECT Room_ID, Bed_No, Status FROM BED WHERE Room_ID = 'R006' AND Bed_No = 3;      -- OCCUPIED

-- UPDATE
UPDATE RESIDENT SET City = 'Mysuru' WHERE Resident_ID = 'RES900';

-- Procedures: rent + settlement
CALL sp_generate_monthly_rent('P002', '2026-12-01');
CALL sp_settle_payment('RENT-202612-RES900', CURDATE());
SELECT Resident_ID, Payment_No, Amount, Payment_Status FROM PAYMENT WHERE Resident_ID = 'RES900';
SELECT fn_resident_total_due('RES900') AS Total_Due_After_Settlement;                -- 0.00

-- Check-out frees the bed
CALL sp_close_allocation('AL900', 'COMPLETED', CURDATE());
SELECT Room_ID, Bed_No, Status FROM BED WHERE Room_ID = 'R006' AND Bed_No = 3;      -- AVAILABLE

-- DELETE (child rows first because of RESTRICT foreign keys)
DELETE FROM PAYMENT WHERE Resident_ID = 'RES900' AND Payment_Status = 'PAID' AND 1 = 0;  -- no-op: PAID rows are immutable records
DELETE FROM RESIDENT_PHONE WHERE Resident_ID = 'RES900';

-- SELECT
SELECT * FROM vw_resident_profile WHERE Resident_ID = 'RES900';

ROLLBACK;   -- <- nothing above is kept

-- ---------------------------------------------------------------------
-- Savepoint demo
START TRANSACTION;
UPDATE ROOM SET Rent = Rent + 500 WHERE Room_ID = 'R001';
SAVEPOINT after_rent_change;
UPDATE ROOM SET Rent = 0 WHERE Room_ID = 'R001';
ROLLBACK TO SAVEPOINT after_rent_change;
SELECT Room_ID, Rent FROM ROOM WHERE Room_ID = 'R001';                               -- 10000.00 (only the first change survives)
ROLLBACK;

-- ---------------------------------------------------------------------
-- Triggers / constraints rejecting bad data (each statement below FAILS on purpose; run them one by one)
-- INSERT INTO ALLOCATION VALUES ('ALX','2026-10-01',NULL,'2026-10-01','ACTIVE',NULL,'RES015','R001',1);  -- bed not available
-- UPDATE BED SET Status = 'AVAILABLE' WHERE Room_ID = 'R001' AND Bed_No = 1;                               -- active allocation
-- INSERT INTO PAYMENT VALUES ('PX','RES001','2026-01-01','RENT',-5,'PENDING');                              -- CHECK Amount > 0
-- INSERT INTO STAFF VALUES ('SX','A','B','Cook',1,'2024-01-01','S004','P001');                              -- supervisor other property
