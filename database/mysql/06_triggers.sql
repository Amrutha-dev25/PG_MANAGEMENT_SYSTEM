-- =====================================================================
-- 06_triggers.sql : business rules & integrity enforced inside the DB
--   Bed status is ONLY changed by allocation triggers (never by hand) so
--   BED.Status and ALLOCATION can never get out of sync.
-- =====================================================================
USE pg_management;

DROP TRIGGER IF EXISTS trg_resident_bi;
DROP TRIGGER IF EXISTS trg_resident_bu;
DROP TRIGGER IF EXISTS trg_staff_bi;
DROP TRIGGER IF EXISTS trg_staff_bu;
DROP TRIGGER IF EXISTS trg_room_bu;
DROP TRIGGER IF EXISTS trg_bed_bi;
DROP TRIGGER IF EXISTS trg_bed_bu;
DROP TRIGGER IF EXISTS trg_allocation_bi;
DROP TRIGGER IF EXISTS trg_allocation_ai;
DROP TRIGGER IF EXISTS trg_allocation_bu;
DROP TRIGGER IF EXISTS trg_allocation_au;
DROP TRIGGER IF EXISTS trg_allocation_bd;
DROP TRIGGER IF EXISTS trg_payment_bu;
DROP TRIGGER IF EXISTS trg_complaint_bi;
DROP TRIGGER IF EXISTS trg_visitor_log_bi;

DELIMITER $$

-- ---------------------------------------------------------------- RESIDENT
CREATE TRIGGER trg_resident_bi BEFORE INSERT ON RESIDENT FOR EACH ROW
BEGIN
  IF NEW.DOB >= CURDATE() THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Date of birth must be in the past';
  END IF;
  IF TIMESTAMPDIFF(YEAR, NEW.DOB, CURDATE()) < 16 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Resident must be at least 16 years old';
  END IF;
END$$

CREATE TRIGGER trg_resident_bu BEFORE UPDATE ON RESIDENT FOR EACH ROW
BEGIN
  IF NEW.DOB >= CURDATE() THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Date of birth must be in the past';
  END IF;
  IF TIMESTAMPDIFF(YEAR, NEW.DOB, CURDATE()) < 16 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Resident must be at least 16 years old';
  END IF;
END$$

-- ------------------------------------------------------------------- STAFF
-- A supervisor must be a different person working at the same property.
CREATE TRIGGER trg_staff_bi BEFORE INSERT ON STAFF FOR EACH ROW
BEGIN
  IF NEW.Supervisor_ID IS NOT NULL THEN
    IF NEW.Supervisor_ID = NEW.Staff_ID THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A staff member cannot supervise themselves';
    END IF;
    IF (SELECT Property_ID FROM STAFF WHERE Staff_ID = NEW.Supervisor_ID) <> NEW.Property_ID THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Supervisor must work at the same property';
    END IF;
  END IF;
END$$

CREATE TRIGGER trg_staff_bu BEFORE UPDATE ON STAFF FOR EACH ROW
BEGIN
  IF NEW.Supervisor_ID IS NOT NULL THEN
    IF NEW.Supervisor_ID = NEW.Staff_ID THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A staff member cannot supervise themselves';
    END IF;
    IF (SELECT Property_ID FROM STAFF WHERE Staff_ID = NEW.Supervisor_ID) <> NEW.Property_ID THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Supervisor must work at the same property';
    END IF;
  END IF;
END$$

-- -------------------------------------------------------------- ROOM / BED
CREATE TRIGGER trg_room_bu BEFORE UPDATE ON ROOM FOR EACH ROW
BEGIN
  IF NEW.Capacity < (SELECT COUNT(*) FROM BED WHERE Room_ID = OLD.Room_ID) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Capacity cannot be lower than the number of beds already in the room';
  END IF;
END$$

-- Number of beds in a room can never exceed the room capacity
CREATE TRIGGER trg_bed_bi BEFORE INSERT ON BED FOR EACH ROW
BEGIN
  IF (SELECT COUNT(*) FROM BED WHERE Room_ID = NEW.Room_ID)
     >= (SELECT Capacity FROM ROOM WHERE Room_ID = NEW.Room_ID) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Room capacity reached: cannot add more beds to this room';
  END IF;
  IF NEW.Status = 'OCCUPIED' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A new bed cannot be OCCUPIED; allocate a resident instead';
  END IF;
END$$

-- BED.Status = OCCUPIED  <=>  the bed has an ACTIVE allocation
CREATE TRIGGER trg_bed_bu BEFORE UPDATE ON BED FOR EACH ROW
BEGIN
  IF NEW.Status = 'OCCUPIED' AND OLD.Status <> 'OCCUPIED'
     AND NOT EXISTS (SELECT 1 FROM ALLOCATION
                      WHERE Room_ID = OLD.Room_ID AND Bed_No = OLD.Bed_No
                        AND Allocation_Status = 'ACTIVE') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bed can only become OCCUPIED through an allocation';
  END IF;
  IF OLD.Status = 'OCCUPIED' AND NEW.Status <> 'OCCUPIED'
     AND EXISTS (SELECT 1 FROM ALLOCATION
                  WHERE Room_ID = OLD.Room_ID AND Bed_No = OLD.Bed_No
                    AND Allocation_Status = 'ACTIVE') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bed has an active allocation; check the resident out first';
  END IF;
END$$

-- -------------------------------------------------------------- ALLOCATION
CREATE TRIGGER trg_allocation_bi BEFORE INSERT ON ALLOCATION FOR EACH ROW
BEGIN
  DECLARE v_bed_status VARCHAR(30) DEFAULT NULL;
  IF NEW.Allocation_Status = 'ACTIVE' THEN
    SELECT Status INTO v_bed_status FROM BED
     WHERE Room_ID = NEW.Room_ID AND Bed_No = NEW.Bed_No;
    IF v_bed_status IS NOT NULL AND v_bed_status <> 'AVAILABLE' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Selected bed is not available';
    END IF;
    IF EXISTS (SELECT 1 FROM ALLOCATION
                WHERE Resident_ID = NEW.Resident_ID AND Allocation_Status = 'ACTIVE') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Resident already has an active allocation';
    END IF;
  ELSEIF NEW.Allocation_Status = 'COMPLETED' AND NEW.Check_Out_Date IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A completed allocation needs a check-out date';
  END IF;
END$$

CREATE TRIGGER trg_allocation_ai AFTER INSERT ON ALLOCATION FOR EACH ROW
BEGIN
  IF NEW.Allocation_Status = 'ACTIVE' THEN
    UPDATE BED SET Status = 'OCCUPIED'
     WHERE Room_ID = NEW.Room_ID AND Bed_No = NEW.Bed_No;
  END IF;
END$$

CREATE TRIGGER trg_allocation_bu BEFORE UPDATE ON ALLOCATION FOR EACH ROW
BEGIN
  IF NEW.Resident_ID <> OLD.Resident_ID OR NEW.Room_ID <> OLD.Room_ID OR NEW.Bed_No <> OLD.Bed_No THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Resident/bed of an allocation cannot be changed; use a transfer';
  END IF;
  IF OLD.Allocation_Status <> 'ACTIVE' AND NEW.Allocation_Status = 'ACTIVE' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A closed allocation cannot be re-opened';
  END IF;
  IF NEW.Allocation_Status = 'COMPLETED' AND NEW.Check_Out_Date IS NULL THEN
    SET NEW.Check_Out_Date = GREATEST(CURDATE(), NEW.Check_In_Date);
  END IF;
END$$

CREATE TRIGGER trg_allocation_au AFTER UPDATE ON ALLOCATION FOR EACH ROW
BEGIN
  IF OLD.Allocation_Status = 'ACTIVE' AND NEW.Allocation_Status <> 'ACTIVE' THEN
    UPDATE BED SET Status = 'AVAILABLE'
     WHERE Room_ID = NEW.Room_ID AND Bed_No = NEW.Bed_No AND Status = 'OCCUPIED';
  END IF;
END$$

CREATE TRIGGER trg_allocation_bd BEFORE DELETE ON ALLOCATION FOR EACH ROW
BEGIN
  IF OLD.Allocation_Status = 'ACTIVE' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'An ACTIVE allocation cannot be deleted; check the resident out or cancel it first';
  END IF;
END$$

-- ----------------------------------------------------------------- PAYMENT
-- Settled payments are financial records: amount / owner / type are frozen.
CREATE TRIGGER trg_payment_bu BEFORE UPDATE ON PAYMENT FOR EACH ROW
BEGIN
  IF OLD.Payment_Status IN ('PAID','REFUNDED') THEN
    IF NEW.Amount <> OLD.Amount OR NEW.Resident_ID <> OLD.Resident_ID OR NEW.Payment_Type <> OLD.Payment_Type THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A settled payment cannot be modified';
    END IF;
    IF NEW.Payment_Status = 'PENDING' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A settled payment cannot go back to PENDING';
    END IF;
  END IF;
END$$

-- --------------------------------------------------------------- COMPLAINT
CREATE TRIGGER trg_complaint_bi BEFORE INSERT ON COMPLAINT FOR EACH ROW
BEGIN
  IF NEW.Date_Filed > CURDATE() THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Complaint date cannot be in the future';
  END IF;
END$$

-- ------------------------------------------------------------- VISITOR_LOG
CREATE TRIGGER trg_visitor_log_bi BEFORE INSERT ON VISITOR_LOG FOR EACH ROW
BEGIN
  IF NEW.Visit_Date > CURDATE() THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Visit date cannot be in the future';
  END IF;
END$$

DELIMITER ;
