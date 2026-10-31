-- =====================================================================
-- 09_demo_queries.sql : important SELECT queries (JOIN, GROUP BY, HAVING,
-- ORDER BY, aggregates, subqueries, views, window functions, CTE, FULLTEXT)
-- Safe to run any number of times (read-only).
-- =====================================================================
USE pg_management;

-- Q1  JOIN (4 tables): who sleeps where right now
SELECT p.Property_Name, r.Room_No, a.Bed_No, CONCAT(res.FirstName,' ',res.LastName) AS Resident, a.Check_In_Date
  FROM ALLOCATION a
  JOIN RESIDENT res ON res.Resident_ID = a.Resident_ID
  JOIN ROOM r       ON r.Room_ID = a.Room_ID
  JOIN PROPERTY p   ON p.Property_ID = r.Property_ID
 WHERE a.Allocation_Status = 'ACTIVE'
 ORDER BY p.Property_Name, r.Room_No, a.Bed_No;

-- Q2  GROUP BY + aggregate: beds and occupancy per property (uses VIEW + FUNCTION)
SELECT * FROM vw_property_occupancy ORDER BY Occupancy_Pct DESC;

-- Q3  GROUP BY + HAVING: properties whose monthly payroll exceeds 70,000
SELECT p.Property_Name, COUNT(s.Staff_ID) AS Staff, SUM(s.Salary) AS Payroll
  FROM PROPERTY p JOIN STAFF s ON s.Property_ID = p.Property_ID
 GROUP BY p.Property_ID, p.Property_Name
HAVING SUM(s.Salary) > 70000
 ORDER BY Payroll DESC;

-- Q4  Subquery: residents whose total due is above the average due of residents who owe money
SELECT Resident_Name, Total_Due FROM vw_resident_dues
 WHERE Total_Due > (SELECT AVG(Total_Due) FROM vw_resident_dues WHERE Total_Due > 0)
 ORDER BY Total_Due DESC;

-- Q5  Correlated subquery: rooms that still have at least one free bed
SELECT r.Room_ID, r.Room_No, r.Room_Type
  FROM ROOM r
 WHERE EXISTS (SELECT 1 FROM BED b WHERE b.Room_ID = r.Room_ID AND b.Status = 'AVAILABLE');

-- Q6  Self join: staff and their supervisors
SELECT CONCAT(e.First_Name,' ',e.Last_Name) AS Employee, e.Designation,
       CONCAT(m.First_Name,' ',m.Last_Name) AS Supervisor
  FROM STAFF e LEFT JOIN STAFF m ON m.Staff_ID = e.Supervisor_ID
 ORDER BY e.Property_ID, Supervisor, Employee;

-- Q7  Many-to-many: amenities offered by each property
SELECT p.Property_Name, GROUP_CONCAT(a.Amenity_Name ORDER BY a.Amenity_Name SEPARATOR ', ') AS Amenities
  FROM PROPERTY p
  JOIN PROPERTY_AMENITY pa ON pa.Property_ID = p.Property_ID
  JOIN AMENITY a ON a.Amenity_ID = pa.Amenity_ID
 GROUP BY p.Property_ID, p.Property_Name;

-- Q8  Window function: rank residents by total rent paid
SELECT Resident_Name, Paid_Amount, RANK() OVER (ORDER BY Paid_Amount DESC) AS Paid_Rank
  FROM vw_resident_dues WHERE Paid_Amount > 0 ORDER BY Paid_Rank LIMIT 5;

-- Q9  CTE: month-over-month collection
WITH monthly AS (SELECT Month, Collected FROM vw_monthly_revenue)
SELECT Month, Collected, Collected - LAG(Collected) OVER (ORDER BY Month) AS Change_From_Previous FROM monthly ORDER BY Month;

-- Q10 Derived attribute AGE + multivalued phone numbers (VIEW)
SELECT Resident_ID, Full_Name, Age, Phones, Property_Name, Room_No FROM vw_resident_profile ORDER BY Age DESC LIMIT 5;

-- Q11 FULLTEXT search over complaints
SELECT Complaint_No, Category, Priority, Status, Description
  FROM COMPLAINT WHERE MATCH(Description, Category) AGAINST ('+water* +leak*' IN BOOLEAN MODE);

-- Q12 Overdue rent with days late
SELECT p.Payment_No, CONCAT(r.FirstName,' ',r.LastName) AS Resident, p.Amount, p.Payment_Date AS Due_Date,
       DATEDIFF(CURDATE(), p.Payment_Date) AS Days_Late
  FROM PAYMENT p JOIN RESIDENT r ON r.Resident_ID = p.Resident_ID
 WHERE p.Payment_Status = 'PENDING' AND p.Payment_Date < CURDATE()
 ORDER BY Days_Late DESC;

-- Q13 Visitors currently inside, and who they visit
SELECT * FROM vw_visitor_log_details WHERE Visit_Status = 'INSIDE';

-- Q14 Licences expiring / expired (VIEW)
SELECT * FROM vw_license_alerts ORDER BY Days_Left;

-- Q15 Scalar function: derived Total_due of every resident
SELECT Resident_ID, fn_resident_total_due(Resident_ID) AS Total_Due FROM RESIDENT ORDER BY Total_Due DESC LIMIT 5;
