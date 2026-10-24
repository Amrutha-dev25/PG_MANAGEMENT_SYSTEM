-- =====================================================================
-- 04_functions.sql : stored functions
-- Implements the ER DERIVED attributes (age, total due) without storing them.
-- =====================================================================
USE pg_management;

DROP FUNCTION IF EXISTS fn_resident_age;
DROP FUNCTION IF EXISTS fn_resident_total_due;
DROP FUNCTION IF EXISTS fn_property_occupancy_pct;

DELIMITER $$

-- RESIDENT.age (derived from DOB)
CREATE FUNCTION fn_resident_age(p_dob DATE)
RETURNS INT
NO SQL
BEGIN
  RETURN TIMESTAMPDIFF(YEAR, p_dob, CURDATE());
END$$

-- PAYMENT.Total_due (derived): sum of all PENDING payments of a resident
CREATE FUNCTION fn_resident_total_due(p_resident_id VARCHAR(20))
RETURNS DECIMAL(12,2)
READS SQL DATA
BEGIN
  DECLARE v_due DECIMAL(12,2);
  SELECT COALESCE(SUM(Amount), 0) INTO v_due
    FROM PAYMENT
   WHERE Resident_ID = p_resident_id AND Payment_Status = 'PENDING';
  RETURN v_due;
END$$

-- % of beds of a property that are currently OCCUPIED (maintenance beds excluded)
CREATE FUNCTION fn_property_occupancy_pct(p_property_id VARCHAR(20))
RETURNS DECIMAL(5,2)
READS SQL DATA
BEGIN
  DECLARE v_total INT DEFAULT 0;
  DECLARE v_occ   INT DEFAULT 0;
  SELECT COUNT(*), COALESCE(SUM(b.Status = 'OCCUPIED'), 0)
    INTO v_total, v_occ
    FROM BED b JOIN ROOM r ON r.Room_ID = b.Room_ID
   WHERE r.Property_ID = p_property_id AND b.Status <> 'MAINTENANCE';
  IF v_total = 0 THEN RETURN 0; END IF;
  RETURN ROUND(v_occ * 100 / v_total, 2);
END$$

DELIMITER ;
