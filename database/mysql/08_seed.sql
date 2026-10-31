-- =====================================================================
-- 08_seed.sql : realistic demo data (INSERT).  Run AFTER 01-07.
-- Beds are inserted AVAILABLE; allocation triggers flip them to OCCUPIED.
-- =====================================================================
USE pg_management;

INSERT INTO PROPERTY (Property_ID, Property_Name, Property_Type, Description, Total_Floor, Street, City, Pincode) VALUES
('P001','Green View Residency','Co-living','Modern co-living PG near the metro with rooftop lounge and daily housekeeping.',4,'12 Residency Cross Road, Koramangala','Bengaluru','560034'),
('P002','Lakeside Ladies PG','Ladies PG','Safe, women-only PG with 24x7 security and warden on premises.',3,'45 Lake View Road, HSR Layout','Bengaluru','560102'),
('P003','Tech Park Suites','Working Professionals','Premium suites for working professionals, 5 minutes from the IT corridor.',5,'7 Outer Ring Road, Marathahalli','Bengaluru','560037');

INSERT INTO STAFF (Staff_ID, First_Name, Last_Name, Designation, Salary, Join_Date, Supervisor_ID, Property_ID) VALUES
('S001','Anita','Rao','Property Manager',52000,'2023-04-10',NULL,'P001'),
('S004','Meera','Shah','Property Manager',50000,'2023-06-01',NULL,'P002'),
('S006','Kiran','Patel','Property Manager',55000,'2022-11-15',NULL,'P003'),
('S002','Rahul','Kumar','Warden',28000,'2024-01-20','S001','P001'),
('S003','Meena','Iyer','Cook',22000,'2024-02-05','S001','P001'),
('S005','Suresh','Babu','Security Guard',20000,'2024-03-12','S004','P002'),
('S007','Divya','Menon','Housekeeping Supervisor',24000,'2024-05-01','S006','P003');

INSERT INTO AMENITY (Amenity_ID, Amenity_Name, Amenity_Type, Description) VALUES
('AM001','High-speed Wi-Fi','Connectivity','100 Mbps fibre broadband in all rooms'),
('AM002','Laundry','Service','Washing machines on every floor'),
('AM003','Gym','Fitness','Equipped gym open 5 AM - 10 PM'),
('AM004','Power Backup','Utility','24x7 generator backup'),
('AM005','CCTV Surveillance','Security','Common areas covered by CCTV'),
('AM006','Parking','Facility','Two- and four-wheeler parking'),
('AM007','Hot Water','Utility','Solar + geyser hot water supply'),
('AM008','Study Room','Facility','Quiet air-conditioned study room');

INSERT INTO PROPERTY_AMENITY (Property_ID, Amenity_ID) VALUES
('P001','AM001'),('P001','AM002'),('P001','AM003'),('P001','AM004'),('P001','AM005'),('P001','AM006'),
('P002','AM001'),('P002','AM002'),('P002','AM004'),('P002','AM005'),('P002','AM007'),('P002','AM008'),
('P003','AM001'),('P003','AM002'),('P003','AM003'),('P003','AM004'),('P003','AM005'),('P003','AM006'),('P003','AM007');

INSERT INTO POLICY (Policy_ID, Policy_Type, Description, Effective_From, Effective_To, Property_ID) VALUES
('POL001','Visitor Policy','Visitors are allowed between 10 AM and 8 PM in the common lounge only.','2026-01-01',NULL,'P001'),
('POL002','Notice Period','Residents must give 30 days written notice before vacating.','2026-01-01',NULL,'P001'),
('POL003','Visitor Policy','No male visitors beyond the reception area. Visiting hours 10 AM - 6 PM.','2026-01-01',NULL,'P002'),
('POL004','Curfew','Gate closes at 10:30 PM. Late entry needs prior warden approval.','2026-01-01',NULL,'P002'),
('POL005','Refund Policy','Security deposit refunded within 15 days of check-out after damage inspection.','2026-01-01',NULL,'P003'),
('POL006','Quiet Hours','Quiet hours 11 PM - 6 AM. Repeated violations may lead to eviction.','2025-06-01','2026-12-31','P003');

INSERT INTO LICENSE (License_ID, License_Type, License_Number, Issue_Date, Expiry_Date, Property_ID) VALUES
('LIC001','Trade License','BBMP/TL/2024/00123','2024-01-01','2027-12-31','P001'),
('LIC002','Fire Safety Certificate','KFES/FS/2025/0456','2025-11-30','2026-11-30','P001'),
('LIC003','Trade License','BBMP/TL/2024/00987','2024-02-01','2027-01-31','P002'),
('LIC004','Police Verification Certificate','BLR/PV/2025/7781','2025-09-30','2026-09-30','P002'),
('LIC005','Food Safety (FSSAI)','FSSAI/KA/2025/55421','2025-12-15','2026-12-14','P003');

INSERT INTO ASSET (Asset_ID, Asset_Name, Asset_Type, Purchase_Date, `Condition`, Cost, Property_ID) VALUES
('A001','Single Cot with Mattress','Furniture','2024-01-10','GOOD',6500,'P001'),
('A002','Study Table','Furniture','2024-01-10','GOOD',3200,'P001'),
('A003','Wardrobe','Furniture','2024-01-10','FAIR',7800,'P001'),
('A004','Split AC 1.5 Ton','Appliance','2024-03-02','GOOD',38000,'P001'),
('A005','Single Cot with Mattress','Furniture','2024-02-14','GOOD',6500,'P002'),
('A006','Wardrobe','Furniture','2024-02-14','GOOD',7800,'P002'),
('A007','Geyser 15L','Appliance','2024-02-20','FAIR',9500,'P002'),
('A008','Ceiling Fan','Appliance','2024-02-14','GOOD',2400,'P002'),
('A009','Single Cot with Mattress','Furniture','2023-12-01','NEW',7200,'P003'),
('A010','Study Table & Chair','Furniture','2023-12-01','GOOD',5400,'P003'),
('A011','Split AC 1.5 Ton','Appliance','2024-04-15','GOOD',39500,'P003'),
('A012','Mini Refrigerator','Appliance','2024-04-15','POOR',11000,'P003');

INSERT INTO ROOM (Room_ID, Room_No, Room_Type, Capacity, Rent, Property_ID) VALUES
('R001','101','Double',2,9500,'P001'),('R002','102','Single',1,12500,'P001'),
('R003','201','Triple',3,8500,'P001'),('R004','202','Double',2,9500,'P001'),
('R005','G01','Double',2,8000,'P002'),('R006','G02','Triple',3,7000,'P002'),
('R007','101','Single',1,11000,'P002'),
('R008','301','Single',1,13500,'P003'),('R009','302','Double',2,10500,'P003'),
('R010','401','Quad',4,7500,'P003');

INSERT INTO BED (Room_ID, Bed_No, Bed_Type, Status) VALUES
('R001',1,'Single','AVAILABLE'),('R001',2,'Single','AVAILABLE'),
('R002',1,'Single','AVAILABLE'),
('R003',1,'Single','AVAILABLE'),('R003',2,'Single','AVAILABLE'),('R003',3,'Single','AVAILABLE'),
('R004',1,'Single','AVAILABLE'),('R004',2,'Single','MAINTENANCE'),
('R005',1,'Single','AVAILABLE'),('R005',2,'Single','AVAILABLE'),
('R006',1,'Single','AVAILABLE'),('R006',2,'Single','AVAILABLE'),('R006',3,'Single','AVAILABLE'),
('R007',1,'Single','AVAILABLE'),
('R008',1,'Single','AVAILABLE'),
('R009',1,'Single','AVAILABLE'),('R009',2,'Single','AVAILABLE'),
('R010',1,'Bunk-Lower','AVAILABLE'),('R010',2,'Bunk-Upper','AVAILABLE'),
('R010',3,'Bunk-Lower','AVAILABLE'),('R010',4,'Bunk-Upper','AVAILABLE');

INSERT INTO ROOM_ASSET (Assignment_No, Asset_ID, Quantity, Assigned_Date, Room_ID) VALUES
('RA001','A001',2,'2024-01-15','R001'),('RA002','A002',2,'2024-01-15','R001'),('RA003','A004',1,'2024-03-05','R001'),
('RA004','A001',1,'2024-01-15','R002'),('RA005','A003',1,'2024-01-15','R002'),
('RA006','A005',2,'2024-02-20','R005'),('RA007','A007',1,'2024-02-22','R005'),('RA008','A008',2,'2024-02-20','R005'),
('RA009','A009',1,'2023-12-10','R008'),('RA010','A011',1,'2024-04-20','R008'),('RA011','A012',1,'2024-04-20','R009');

INSERT INTO RESIDENT (Resident_ID, FirstName, LastName, Email, Gender, DOB, Street, City, Pincode) VALUES
('RES001','Aarav','Sharma','aarav.sharma@example.com','Male','2003-05-14','22 MG Road','Mysuru','570001'),
('RES002','Rohan','Mehta','rohan.mehta@example.com','Male','2002-11-02','8 Park Street','Pune','411001'),
('RES003','Karthik','Reddy','karthik.reddy@example.com','Male','2001-08-21','15 Jubilee Hills','Hyderabad','500033'),
('RES004','Vikram','Singh','vikram.singh@example.com','Male','2000-01-30','3 Civil Lines','Jaipur','302006'),
('RES005','Arjun','Nair','arjun.nair@example.com','Male','2002-03-17','41 Marine Drive','Kochi','682031'),
('RES006','Sanjay','Gupta','sanjay.gupta@example.com','Male','2003-09-09','9 Hazratganj','Lucknow','226001'),
('RES007','Diya','Patel','diya.patel@example.com','Female','2003-02-25','18 CG Road','Ahmedabad','380009'),
('RES008','Sneha','Kulkarni','sneha.kulkarni@example.com','Female','2002-07-12','27 FC Road','Pune','411004'),
('RES009','Priya','Menon','priya.menon@example.com','Female','2001-12-05','5 Beach Road','Kozhikode','673032'),
('RES010','Ananya','Das','ananya.das@example.com','Female','2000-06-18','60 Park Circus','Kolkata','700017'),
('RES011','Rahul','Verma','rahul.verma@example.com','Male','1998-10-03','12 Sector 15','Gurugram','122001'),
('RES012','Neha','Joshi','neha.joshi@example.com','Female','1999-04-22','33 Shivaji Nagar','Nagpur','440010'),
('RES013','Amit','Kumar','amit.kumar@example.com','Male','1999-09-14','19 Boring Road','Patna','800001'),
('RES014','Suresh','Pillai','suresh.pillai@example.com','Male','2000-02-08','7 MG Road','Thiruvananthapuram','695001'),
('RES015','Pooja','Hegde','pooja.hegde@example.com','Female','2001-05-30','4 Temple Street','Mangaluru','575001'),
('RES016','Manoj','Tiwari','manoj.tiwari@example.com','Male','1997-12-27','21 Gandhi Nagar','Bhopal','462001');

INSERT INTO RESIDENT_PHONE (Resident_ID, Phone_No) VALUES
('RES001','9876500001'),('RES001','9876500101'),('RES002','9876500002'),('RES003','9876500003'),
('RES004','9876500004'),('RES005','9876500005'),('RES006','9876500006'),('RES007','9876500007'),
('RES008','9876500008'),('RES009','9876500009'),('RES010','9876500010'),('RES011','9876500011'),
('RES012','9876500012'),('RES013','9876500013'),('RES014','9876500014'),('RES015','9876500015'),
('RES016','9876500016');

INSERT INTO RESIDENT_DOCUMENT (Resident_ID, DocNo, Document_Type, Document_Number, Issue_Date, Verification_Status) VALUES
('RES001',1,'Aadhaar','XXXX-XXXX-1001','2019-03-01','VERIFIED'),
('RES001',2,'College ID','PES2024-0054','2024-08-01','VERIFIED'),
('RES002',1,'Aadhaar','XXXX-XXXX-1002','2019-04-11','VERIFIED'),
('RES003',1,'PAN','ABCPK1234D','2020-06-15','PENDING'),
('RES004',1,'Aadhaar','XXXX-XXXX-1004','2018-09-09','VERIFIED'),
('RES007',1,'Aadhaar','XXXX-XXXX-1007','2020-01-20','VERIFIED'),
('RES008',1,'Passport','N1234567','2021-02-02','REJECTED'),
('RES011',1,'Employee ID','EMP-88231','2024-07-01','VERIFIED'),
('RES012',1,'Driving License','KA05-20230012345','2023-05-05','PENDING');

-- Allocations (historic first, then active). Bed status is maintained by triggers.
INSERT INTO ALLOCATION (Allocation_No, Check_In_Date, Check_Out_Date, Allocation_Date, Allocation_Status, Remarks, Resident_ID, Room_ID, Bed_No) VALUES
('AL013','2026-01-10','2026-07-31','2026-01-08','COMPLETED','Left after internship ended','RES015','R003',3),
('AL014','2026-03-01','2026-08-15','2026-02-25','COMPLETED','Relocated to another city','RES016','R010',3);

INSERT INTO ALLOCATION (Allocation_No, Check_In_Date, Check_Out_Date, Allocation_Date, Allocation_Status, Remarks, Resident_ID, Room_ID, Bed_No) VALUES
('AL001','2026-06-01',NULL,'2026-05-28','ACTIVE','Academic year stay','RES001','R001',1),
('AL002','2026-06-01',NULL,'2026-05-28','ACTIVE',NULL,'RES002','R001',2),
('AL003','2026-06-15',NULL,'2026-06-10','ACTIVE','Prefers single room','RES003','R002',1),
('AL004','2026-07-01',NULL,'2026-06-25','ACTIVE',NULL,'RES004','R003',1),
('AL005','2026-07-01',NULL,'2026-06-25','ACTIVE',NULL,'RES005','R003',2),
('AL006','2026-07-10',NULL,'2026-07-05','ACTIVE',NULL,'RES006','R004',1),
('AL007','2026-06-01',NULL,'2026-05-20','ACTIVE',NULL,'RES007','R005',1),
('AL008','2026-06-01',NULL,'2026-05-20','ACTIVE',NULL,'RES008','R005',2),
('AL009','2026-06-20',NULL,'2026-06-15','ACTIVE',NULL,'RES009','R006',1),
('AL010','2026-07-05',NULL,'2026-06-30','ACTIVE','Working professional','RES010','R007',1),
('AL011','2026-05-01',NULL,'2026-04-25','ACTIVE','Corporate booking','RES011','R008',1),
('AL012','2026-06-01',NULL,'2026-05-25','ACTIVE',NULL,'RES012','R009',1),
('AL015','2026-06-01',NULL,'2026-05-25','ACTIVE',NULL,'RES013','R010',1),
('AL016','2026-06-10',NULL,'2026-06-05','ACTIVE',NULL,'RES014','R010',2);

-- Monthly rent for Aug, Sep, Oct 2026 via the stored procedure
CALL sp_generate_monthly_rent('P001','2026-08-01');
CALL sp_generate_monthly_rent('P002','2026-08-01');
CALL sp_generate_monthly_rent('P003','2026-08-01');
CALL sp_generate_monthly_rent('P001','2026-09-01');
CALL sp_generate_monthly_rent('P002','2026-09-01');
CALL sp_generate_monthly_rent('P003','2026-09-01');
CALL sp_generate_monthly_rent('P001','2026-10-01');
CALL sp_generate_monthly_rent('P002','2026-10-01');
CALL sp_generate_monthly_rent('P003','2026-10-01');

INSERT INTO PAYMENT (Payment_No, Resident_ID, Payment_Date, Payment_Type, Amount, Payment_Status) VALUES
('DEP-RES001','RES001','2026-05-28','DEPOSIT',15000,'PAID'),
('DEP-RES007','RES007','2026-05-20','DEPOSIT',12000,'PAID'),
('DEP-RES011','RES011','2026-04-25','DEPOSIT',20000,'PAID'),
('DEP-RES013','RES013','2026-05-25','DEPOSIT',12000,'PAID'),
('PAY-00001','RES003','2026-10-10','MAINTENANCE',1500,'PENDING');

-- Settle all Aug/Sep rent, and most of October
UPDATE PAYMENT SET Payment_Status = 'PAID',
       Payment_Date = DATE_ADD(Payment_Date, INTERVAL (CAST(CRC32(Resident_ID) MOD 4 AS SIGNED) - 2) DAY)
 WHERE Payment_Type = 'RENT' AND Payment_No REGEXP '^RENT-2026(08|09)-';
UPDATE PAYMENT SET Payment_Status = 'PAID', Payment_Date = '2026-10-04'
 WHERE Payment_No REGEXP '^RENT-202610-' AND Resident_ID IN
       ('RES001','RES002','RES003','RES005','RES007','RES009','RES010','RES011','RES013','RES014');
UPDATE PAYMENT SET Payment_Status = 'FAILED' WHERE Payment_No = 'RENT-202610-RES006';
-- RES004, RES008, RES012 stay PENDING (overdue) for the demo

INSERT INTO COMPLAINT (Complaint_No, Resident_ID, Category, Description, Priority, Status, Date_Filed) VALUES
('C001','RES001','Plumbing','Water leakage from the bathroom tap in room 101, floor gets wet every morning.','HIGH','IN_PROGRESS','2026-10-12'),
('C002','RES002','Internet','Wi-Fi keeps disconnecting after 9 PM on the first floor.','MEDIUM','OPEN','2026-10-15'),
('C003','RES004','Electrical','Ceiling fan in room 201 makes a loud noise and wobbles.','LOW','RESOLVED','2026-09-28'),
('C004','RES007','Cleanliness','Common bathroom on ground floor not cleaned for two days.','MEDIUM','OPEN','2026-10-18'),
('C005','RES008','Food','Dinner served cold and rice was undercooked on Monday.','MEDIUM','IN_PROGRESS','2026-10-19'),
('C006','RES011','Security','Main gate lock is broken and anyone can walk in at night.','URGENT','IN_PROGRESS','2026-10-17'),
('C007','RES012','Noise','Loud music from the next room past midnight on weekends.','HIGH','OPEN','2026-10-14'),
('C008','RES010','Maintenance','Geyser in room 101 is not heating water properly.','HIGH','RESOLVED','2026-09-20'),
('C009','RES013','Internet','Router in the Quad room needs a restart every day.','LOW','CLOSED','2026-09-05'),
('C010','RES005','Plumbing','Flush tank keeps running and wastes water.','MEDIUM','OPEN','2026-10-20');

INSERT INTO VISITOR (Visitor_ID, Name, ID_Type, ID_Number) VALUES
('V001','Rajesh Sharma','Aadhaar','XXXX-XXXX-5501'),
('V002','Sunita Mehta','Driving License','KA01-2015-998877'),
('V003','Lakshmi Reddy','Aadhaar','XXXX-XXXX-5503'),
('V004','Harish Patel','Voter ID','GJ/12/345/678901'),
('V005','Kavita Joshi','Passport','P7654321'),
('V006','Deepak Verma','PAN','AAAPV1234K');

INSERT INTO VISITOR_PHONE (Visitor_ID, Phone) VALUES
('V001','9811100001'),('V002','9811100002'),('V003','9811100003'),
('V004','9811100004'),('V005','9811100005'),('V006','9811100006'),('V006','9811100106');

INSERT INTO VISITOR_RESIDENT (Visitor_ID, Resident_ID) VALUES
('V001','RES001'),('V002','RES002'),('V003','RES003'),('V004','RES007'),
('V005','RES012'),('V006','RES011'),('V001','RES002');

INSERT INTO VISITOR_LOG (Log_No, Visitor_ID, Visit_Date, In_Time, Out_Time, Purpose) VALUES
('L001','V001','2026-10-10','11:00:00','13:30:00','Parents visit'),
('L002','V002','2026-10-12','16:00:00','18:00:00','Delivered documents'),
('L003','V003','2026-10-15','10:30:00','12:00:00','Family visit'),
('L004','V004','2026-10-17','17:00:00','18:00:00','Dropped luggage'),
('L005','V005','2026-10-18','15:00:00','17:30:00','Sibling visit'),
('L006','V006','2026-10-19','19:00:00','20:45:00','Dinner meeting'),
('L007','V001','2026-10-20','12:00:00','14:00:00','Festival visit'),
('L008','V002','2026-10-21','10:15:00',NULL,'Brought home food');

INSERT INTO FOOD_ITEM (Food_Item_ID, Food_Name, Category, Unit) VALUES
('F001','Idli','Main','piece'),('F002','Masala Dosa','Main','piece'),('F003','Poha','Main','plate'),
('F004','Sambar','Side','bowl'),('F005','Coconut Chutney','Side','bowl'),('F006','Filter Coffee','Beverage','cup'),
('F007','Masala Tea','Beverage','cup'),('F008','Chapati','Bread','piece'),('F009','Steamed Rice','Staple','bowl'),
('F010','Dal Tadka','Main','bowl'),('F011','Paneer Butter Masala','Main','bowl'),('F012','Mixed Veg Curry','Main','bowl'),
('F013','Curd','Side','bowl'),('F014','Gulab Jamun','Dessert','piece');

-- Menus: breakfast + dinner for 7 days (19-25 Oct 2026) for every property.
-- IDs are deterministic: M001..M014 = P001, M015..M028 = P002, M029..M042 = P003
-- (ordered by property, date, meal type).
INSERT INTO MENU (Menu_ID, Menu_Date, Meal_Type, Meal_Time, Property_ID)
WITH RECURSIVE d AS (
  SELECT DATE('2026-10-19') AS dt
  UNION ALL
  SELECT dt + INTERVAL 1 DAY FROM d WHERE dt < DATE('2026-10-25')
)
SELECT CONCAT('M', LPAD(ROW_NUMBER() OVER (ORDER BY p.Property_ID, d.dt, mt.Meal_Type), 3, '0')),
       d.dt, mt.Meal_Type, mt.Meal_Time, p.Property_ID
  FROM d CROSS JOIN PROPERTY p
  CROSS JOIN (SELECT 'BREAKFAST' AS Meal_Type, '08:00:00' AS Meal_Time
              UNION ALL SELECT 'DINNER', '20:00:00') mt;

INSERT INTO MENU_ITEM (Menu_ID, Menu_Item_No, Food_Item_ID, Quantity)
SELECT m.Menu_ID,
       ROW_NUMBER() OVER (PARTITION BY m.Menu_ID ORDER BY x.Seq),
       x.Food_Item_ID, x.Qty
  FROM MENU m
  JOIN (
    SELECT 'BREAKFAST' AS Meal_Type, 0 AS Variant, 1 AS Seq, 'F001' AS Food_Item_ID, 3 AS Qty
    UNION ALL SELECT 'BREAKFAST',0,2,'F004',1 UNION ALL SELECT 'BREAKFAST',0,3,'F005',1 UNION ALL SELECT 'BREAKFAST',0,4,'F006',1
    UNION ALL SELECT 'BREAKFAST',1,1,'F002',2 UNION ALL SELECT 'BREAKFAST',1,2,'F004',1 UNION ALL SELECT 'BREAKFAST',1,3,'F005',1 UNION ALL SELECT 'BREAKFAST',1,4,'F006',1
    UNION ALL SELECT 'BREAKFAST',2,1,'F003',1 UNION ALL SELECT 'BREAKFAST',2,2,'F005',1 UNION ALL SELECT 'BREAKFAST',2,3,'F007',1
    UNION ALL SELECT 'DINNER',0,1,'F008',3 UNION ALL SELECT 'DINNER',0,2,'F010',1 UNION ALL SELECT 'DINNER',0,3,'F009',1 UNION ALL SELECT 'DINNER',0,4,'F013',1
    UNION ALL SELECT 'DINNER',1,1,'F008',3 UNION ALL SELECT 'DINNER',1,2,'F011',1 UNION ALL SELECT 'DINNER',1,3,'F009',1 UNION ALL SELECT 'DINNER',1,4,'F014',1
    UNION ALL SELECT 'DINNER',2,1,'F008',3 UNION ALL SELECT 'DINNER',2,2,'F012',1 UNION ALL SELECT 'DINNER',2,3,'F009',1 UNION ALL SELECT 'DINNER',2,4,'F013',1
  ) x ON x.Meal_Type = m.Meal_Type AND x.Variant = (DAYOFYEAR(m.Menu_Date) MOD 3);
