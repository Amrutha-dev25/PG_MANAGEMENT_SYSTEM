-- =====================================================================
-- 07_procedures.sql : stored procedures with TRANSACTIONS
--   Each procedure is atomic: any error rolls the whole unit of work back
--   and is re-raised to the caller (the Next.js API turns it into a message).
-- =====================================================================
USE pg_management;

DROP PROCEDURE IF EXISTS sp_allocate_bed;
DROP PROCEDURE IF EXISTS sp_close_allocation;
DROP PROCEDURE IF EXISTS sp_transfer_resident;
DROP PROCEDURE IF EXISTS sp_generate_monthly_rent;
DROP PROCEDURE IF EXISTS sp_settle_payment;

DELIMITER $$

-- Check a resident in to a bed (locks the bed row to stop double-booking)
CREATE PROCEDURE sp_allocate_bed(
  IN p_allocation_no VARCHAR(20), IN p_resident_id VARCHAR(20),
  IN p_room_id VARCHAR(20), IN p_bed_no INT,
  IN p_check_in DATE, IN p_check_out DATE, IN p_remarks VARCHAR(500))
BEGIN
  DECLARE v_status VARCHAR(30) DEFAULT NULL;
  DECLARE v_res_cnt INT DEFAULT 0;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;
    SELECT COUNT(*) INTO v_res_cnt FROM RESIDENT WHERE Resident_ID = p_resident_id FOR UPDATE;
    IF v_res_cnt = 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Resident does not exist';
    END IF;

    SELECT Status INTO v_status FROM BED
     WHERE Room_ID = p_room_id AND Bed_No = p_bed_no FOR UPDATE;
    IF v_status IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bed does not exist';
    END IF;

    -- trg_allocation_bi re-validates availability and one-active-allocation rule
    INSERT INTO ALLOCATION (Allocation_No, Check_In_Date, Check_Out_Date, Allocation_Date,
                            Allocation_Status, Remarks, Resident_ID, Room_ID, Bed_No)
    VALUES (p_allocation_no, p_check_in, p_check_out, CURDATE(),
            'ACTIVE', p_remarks, p_resident_id, p_room_id, p_bed_no);
  COMMIT;

  SELECT * FROM vw_allocation_details WHERE Allocation_No = p_allocation_no;
END$$

-- Check out (COMPLETED) or cancel (CANCELLED) an active allocation; frees the bed
CREATE PROCEDURE sp_close_allocation(
  IN p_allocation_no VARCHAR(20), IN p_new_status VARCHAR(30), IN p_date DATE)
BEGIN
  DECLARE v_status VARCHAR(30) DEFAULT NULL;
  DECLARE v_check_in DATE;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  IF p_new_status NOT IN ('COMPLETED','CANCELLED') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'New status must be COMPLETED or CANCELLED';
  END IF;

  START TRANSACTION;
    SELECT Allocation_Status, Check_In_Date INTO v_status, v_check_in
      FROM ALLOCATION WHERE Allocation_No = p_allocation_no FOR UPDATE;
    IF v_status IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Allocation does not exist';
    END IF;
    IF v_status <> 'ACTIVE' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Allocation is already closed';
    END IF;
    IF p_date < v_check_in THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Check-out date cannot be before the check-in date';
    END IF;

    UPDATE ALLOCATION
       SET Allocation_Status = p_new_status, Check_Out_Date = p_date
     WHERE Allocation_No = p_allocation_no;      -- trg_allocation_au frees the bed
  COMMIT;

  SELECT * FROM vw_allocation_details WHERE Allocation_No = p_allocation_no;
END$$

-- Move a resident to another bed: close old allocation + open new one, atomically
CREATE PROCEDURE sp_transfer_resident(
  IN p_old_allocation_no VARCHAR(20), IN p_new_allocation_no VARCHAR(20),
  IN p_room_id VARCHAR(20), IN p_bed_no INT, IN p_date DATE, IN p_remarks VARCHAR(500))
BEGIN
  DECLARE v_status VARCHAR(30) DEFAULT NULL;
  DECLARE v_resident VARCHAR(20) DEFAULT NULL;
  DECLARE v_check_in DATE;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;
    SELECT Allocation_Status, Resident_ID, Check_In_Date INTO v_status, v_resident, v_check_in
      FROM ALLOCATION WHERE Allocation_No = p_old_allocation_no FOR UPDATE;
    IF v_status IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Allocation does not exist';
    END IF;
    IF v_status <> 'ACTIVE' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only an ACTIVE allocation can be transferred';
    END IF;
    IF p_date < v_check_in THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Transfer date cannot be before the check-in date';
    END IF;

    UPDATE ALLOCATION SET Allocation_Status = 'COMPLETED', Check_Out_Date = p_date
     WHERE Allocation_No = p_old_allocation_no;

    INSERT INTO ALLOCATION (Allocation_No, Check_In_Date, Check_Out_Date, Allocation_Date,
                            Allocation_Status, Remarks, Resident_ID, Room_ID, Bed_No)
    VALUES (p_new_allocation_no, p_date, NULL, CURDATE(), 'ACTIVE',
            COALESCE(p_remarks, CONCAT('Transferred from ', p_old_allocation_no)),
            v_resident, p_room_id, p_bed_no);   -- fails (=> full rollback) if the bed is taken
  COMMIT;

  SELECT * FROM vw_allocation_details WHERE Allocation_No = p_new_allocation_no;
END$$

-- Create one PENDING rent payment per resident staying at the property in that month.
-- Idempotent: running it twice for the same month creates nothing new.
CREATE PROCEDURE sp_generate_monthly_rent(IN p_property_id VARCHAR(20), IN p_month DATE)
BEGIN
  DECLARE v_first DATE;
  DECLARE v_created INT DEFAULT 0;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SET v_first = DATE_SUB(p_month, INTERVAL DAYOFMONTH(p_month) - 1 DAY);

  START TRANSACTION;
    INSERT INTO PAYMENT (Payment_No, Resident_ID, Payment_Date, Payment_Type, Amount, Payment_Status)
    SELECT CONCAT('RENT-', DATE_FORMAT(v_first, '%Y%m'), '-', a.Resident_ID),
           a.Resident_ID, DATE_ADD(v_first, INTERVAL 4 DAY), 'RENT', r.Rent, 'PENDING'
      FROM ALLOCATION a
      JOIN ROOM r ON r.Room_ID = a.Room_ID
     WHERE r.Property_ID = p_property_id
       AND a.Allocation_Status IN ('ACTIVE','COMPLETED')
       AND a.Check_In_Date <= LAST_DAY(v_first)
       AND COALESCE(a.Check_Out_Date, '9999-12-31') >= v_first
       AND r.Rent > 0
       AND NOT EXISTS (SELECT 1 FROM PAYMENT x
                        WHERE x.Payment_No = CONCAT('RENT-', DATE_FORMAT(v_first, '%Y%m'), '-', a.Resident_ID));
    SET v_created = ROW_COUNT();
  COMMIT;

  SELECT v_created AS Created;
END$$

-- Mark a PENDING payment as PAID on the given date
CREATE PROCEDURE sp_settle_payment(IN p_payment_no VARCHAR(30), IN p_paid_on DATE)
BEGIN
  DECLARE v_status VARCHAR(30) DEFAULT NULL;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;
    SELECT Payment_Status INTO v_status FROM PAYMENT WHERE Payment_No = p_payment_no FOR UPDATE;
    IF v_status IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payment does not exist';
    END IF;
    IF v_status NOT IN ('PENDING','FAILED') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only PENDING or FAILED payments can be settled';
    END IF;
    UPDATE PAYMENT SET Payment_Status = 'PAID', Payment_Date = p_paid_on
     WHERE Payment_No = p_payment_no;
  COMMIT;

  SELECT * FROM PAYMENT WHERE Payment_No = p_payment_no;
END$$

DELIMITER ;
