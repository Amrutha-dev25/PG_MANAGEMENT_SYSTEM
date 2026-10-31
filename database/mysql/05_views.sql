-- =====================================================================
-- 05_views.sql : views used by the dashboards, lists and reports
-- =====================================================================
USE pg_management;

-- All allocations with resident / room / property details
CREATE OR REPLACE VIEW vw_allocation_details AS
SELECT a.Allocation_No, a.Resident_ID,
       CONCAT(res.FirstName, ' ', res.LastName) AS Resident_Name,
       p.Property_ID, p.Property_Name,
       a.Room_ID, r.Room_No, r.Room_Type, a.Bed_No, r.Rent,
       a.Check_In_Date, a.Check_Out_Date, a.Allocation_Date,
       a.Allocation_Status, a.Remarks,
       DATEDIFF(COALESCE(a.Check_Out_Date, CURDATE()), a.Check_In_Date) AS Days_Stayed
  FROM ALLOCATION a
  JOIN RESIDENT res ON res.Resident_ID = a.Resident_ID
  JOIN ROOM r       ON r.Room_ID = a.Room_ID
  JOIN PROPERTY p   ON p.Property_ID = r.Property_ID;

CREATE OR REPLACE VIEW vw_active_allocations AS
SELECT * FROM vw_allocation_details WHERE Allocation_Status = 'ACTIVE';

-- Resident profile: ER derived attribute AGE + multivalued phones + current bed
CREATE OR REPLACE VIEW vw_resident_profile AS
SELECT res.Resident_ID,
       CONCAT(res.FirstName, ' ', res.LastName) AS Full_Name,
       fn_resident_age(res.DOB) AS Age,
       res.Email, res.Gender, res.DOB,
       (SELECT GROUP_CONCAT(rp.Phone_No ORDER BY rp.Phone_No SEPARATOR ', ')
          FROM RESIDENT_PHONE rp WHERE rp.Resident_ID = res.Resident_ID) AS Phones,
       va.Property_Name, va.Room_No, va.Bed_No, va.Check_In_Date
  FROM RESIDENT res
  LEFT JOIN vw_active_allocations va ON va.Resident_ID = res.Resident_ID;

-- Payments summary per resident (Total_due is the ER derived attribute)
CREATE OR REPLACE VIEW vw_resident_dues AS
SELECT res.Resident_ID,
       CONCAT(res.FirstName, ' ', res.LastName) AS Resident_Name,
       COALESCE(SUM(CASE WHEN pay.Payment_Status = 'PAID' THEN pay.Amount END), 0)    AS Paid_Amount,
       COALESCE(SUM(CASE WHEN pay.Payment_Status = 'PENDING' THEN pay.Amount END), 0) AS Total_Due,
       COALESCE(SUM(CASE WHEN pay.Payment_Status = 'PENDING' AND pay.Payment_Date < CURDATE()
                         THEN pay.Amount END), 0)                                     AS Overdue_Amount,
       MAX(CASE WHEN pay.Payment_Status = 'PAID' THEN pay.Payment_Date END)           AS Last_Paid_On
  FROM RESIDENT res
  LEFT JOIN PAYMENT pay ON pay.Resident_ID = res.Resident_ID
 GROUP BY res.Resident_ID, res.FirstName, res.LastName;

-- Bed statistics per property
CREATE OR REPLACE VIEW vw_property_occupancy AS
SELECT p.Property_ID, p.Property_Name, p.City,
       COUNT(DISTINCT r.Room_ID)                          AS Total_Rooms,
       COUNT(b.Bed_No)                                    AS Total_Beds,
       COALESCE(SUM(b.Status = 'OCCUPIED'), 0)            AS Occupied_Beds,
       COALESCE(SUM(b.Status = 'AVAILABLE'), 0)           AS Available_Beds,
       COALESCE(SUM(b.Status = 'MAINTENANCE'), 0)         AS Maintenance_Beds,
       fn_property_occupancy_pct(p.Property_ID)           AS Occupancy_Pct
  FROM PROPERTY p
  LEFT JOIN ROOM r ON r.Property_ID = p.Property_ID
  LEFT JOIN BED  b ON b.Room_ID = r.Room_ID
 GROUP BY p.Property_ID, p.Property_Name, p.City;

-- Bed statistics per room
CREATE OR REPLACE VIEW vw_room_availability AS
SELECT r.Room_ID, r.Room_No, r.Room_Type, r.Capacity, r.Rent,
       p.Property_ID, p.Property_Name,
       COUNT(b.Bed_No)                            AS Total_Beds,
       COALESCE(SUM(b.Status = 'AVAILABLE'), 0)   AS Available_Beds,
       COALESCE(SUM(b.Status = 'OCCUPIED'), 0)    AS Occupied_Beds
  FROM ROOM r
  JOIN PROPERTY p ON p.Property_ID = r.Property_ID
  LEFT JOIN BED b ON b.Room_ID = r.Room_ID
 GROUP BY r.Room_ID, r.Room_No, r.Room_Type, r.Capacity, r.Rent, p.Property_ID, p.Property_Name;

-- Revenue by month (Payment_Date = due date for pending, paid date for paid)
CREATE OR REPLACE VIEW vw_monthly_revenue AS
SELECT DATE_FORMAT(Payment_Date, '%Y-%m') AS Month,
       SUM(CASE WHEN Payment_Status = 'PAID'    THEN Amount ELSE 0 END) AS Collected,
       SUM(CASE WHEN Payment_Status = 'PENDING' THEN Amount ELSE 0 END) AS Pending,
       SUM(CASE WHEN Payment_Status = 'FAILED'  THEN Amount ELSE 0 END) AS Failed,
       COUNT(*) AS Payment_Count
  FROM PAYMENT
 GROUP BY DATE_FORMAT(Payment_Date, '%Y-%m');

-- Licences that are expired or expire within 60 days
CREATE OR REPLACE VIEW vw_license_alerts AS
SELECT l.License_ID, l.License_Type, l.License_Number, l.Expiry_Date,
       p.Property_ID, p.Property_Name,
       DATEDIFF(l.Expiry_Date, CURDATE()) AS Days_Left,
       CASE WHEN l.Expiry_Date < CURDATE() THEN 'EXPIRED' ELSE 'EXPIRING' END AS Alert
  FROM LICENSE l JOIN PROPERTY p ON p.Property_ID = l.Property_ID
 WHERE l.Expiry_Date <= DATE_ADD(CURDATE(), INTERVAL 60 DAY);

-- Visitor log with phones and the residents being visited
CREATE OR REPLACE VIEW vw_visitor_log_details AS
SELECT vl.Log_No, vl.Visitor_ID, v.Name AS Visitor_Name, v.ID_Type, v.ID_Number,
       (SELECT GROUP_CONCAT(vp.Phone ORDER BY vp.Phone SEPARATOR ', ')
          FROM VISITOR_PHONE vp WHERE vp.Visitor_ID = v.Visitor_ID) AS Phones,
       (SELECT GROUP_CONCAT(CONCAT(r.FirstName, ' ', r.LastName) ORDER BY r.FirstName SEPARATOR ', ')
          FROM VISITOR_RESIDENT vr JOIN RESIDENT r ON r.Resident_ID = vr.Resident_ID
         WHERE vr.Visitor_ID = v.Visitor_ID) AS Visiting,
       vl.Visit_Date, vl.In_Time, vl.Out_Time, vl.Purpose,
       CASE WHEN vl.Out_Time IS NULL THEN 'INSIDE' ELSE 'LEFT' END AS Visit_Status
  FROM VISITOR_LOG vl JOIN VISITOR v ON v.Visitor_ID = vl.Visitor_ID;
