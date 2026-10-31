-- =====================================================================
-- 03_indexes.sql : secondary indexes (+ FULLTEXT)
-- PK / UNIQUE / FK columns are already indexed by InnoDB; the indexes
-- below target the most frequent filters, joins and sorts of the app.
-- =====================================================================
USE pg_management;

CREATE INDEX idx_property_city          ON PROPERTY (City);
CREATE INDEX idx_staff_property_desig   ON STAFF (Property_ID, Designation);
CREATE INDEX idx_room_property_type     ON ROOM (Property_ID, Room_Type);
CREATE INDEX idx_bed_status             ON BED (Status);
CREATE INDEX idx_resident_name          ON RESIDENT (LastName, FirstName);
CREATE INDEX idx_allocation_res_status  ON ALLOCATION (Resident_ID, Allocation_Status);
CREATE INDEX idx_allocation_status_dates ON ALLOCATION (Allocation_Status, Check_In_Date, Check_Out_Date);
CREATE INDEX idx_payment_res_status     ON PAYMENT (Resident_ID, Payment_Status);
CREATE INDEX idx_payment_status_date    ON PAYMENT (Payment_Status, Payment_Date);
CREATE INDEX idx_complaint_status_prio  ON COMPLAINT (Status, Priority);
CREATE INDEX idx_complaint_resident     ON COMPLAINT (Resident_ID, Date_Filed);
CREATE INDEX idx_visitor_log_date       ON VISITOR_LOG (Visit_Date, In_Time);
CREATE INDEX idx_license_expiry         ON LICENSE (Expiry_Date);

-- Full-text search over complaints (used by the Complaints page search box)
CREATE FULLTEXT INDEX ft_complaint_text ON COMPLAINT (Description, Category);
