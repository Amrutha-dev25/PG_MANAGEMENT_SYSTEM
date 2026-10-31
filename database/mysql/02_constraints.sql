-- =====================================================================
-- 02_constraints.sql : DDL (ALTER TABLE) - domain / integrity constraints
-- Input validation is enforced INSIDE the database (not only in the UI/API).
-- Requires MySQL 8.0.16+ (CHECK constraints are enforced from that version).
-- NOTE: CHECKs never reference FK columns that have CASCADE/SET NULL actions
--       (MySQL restriction); those rules are implemented as triggers instead.
-- =====================================================================
USE pg_management;

-- PROPERTY
ALTER TABLE PROPERTY
  ADD CONSTRAINT chk_property_floor   CHECK (Total_Floor BETWEEN 1 AND 60),
  ADD CONSTRAINT chk_property_type    CHECK (Property_Type IN ('Co-living','Student PG','Ladies PG','Gents PG','Working Professionals')),
  ADD CONSTRAINT chk_property_pincode CHECK (Pincode REGEXP '^[0-9]{6}$');

-- STAFF
ALTER TABLE STAFF
  ADD CONSTRAINT chk_staff_salary CHECK (Salary >= 0);

-- POLICY / LICENSE / ASSET
ALTER TABLE POLICY
  ADD CONSTRAINT chk_policy_dates CHECK (Effective_To IS NULL OR Effective_To >= Effective_From);
ALTER TABLE LICENSE
  ADD CONSTRAINT chk_license_dates CHECK (Expiry_Date > Issue_Date);
ALTER TABLE ASSET
  ADD CONSTRAINT chk_asset_cost      CHECK (Cost >= 0),
  ADD CONSTRAINT chk_asset_condition CHECK (`Condition` IN ('NEW','GOOD','FAIR','POOR','DAMAGED'));

-- ROOM / BED / ROOM_ASSET
ALTER TABLE ROOM
  ADD CONSTRAINT chk_room_capacity CHECK (Capacity BETWEEN 1 AND 12),
  ADD CONSTRAINT chk_room_rent     CHECK (Rent >= 0),
  ADD CONSTRAINT chk_room_type     CHECK (Room_Type IN ('Single','Double','Triple','Quad','Dormitory'));
ALTER TABLE BED
  ADD CONSTRAINT chk_bed_no     CHECK (Bed_No > 0),
  ADD CONSTRAINT chk_bed_type   CHECK (Bed_Type IN ('Single','Bunk-Upper','Bunk-Lower')),
  ADD CONSTRAINT chk_bed_status CHECK (Status IN ('AVAILABLE','OCCUPIED','MAINTENANCE'));
ALTER TABLE ROOM_ASSET
  ADD CONSTRAINT chk_room_asset_qty CHECK (Quantity > 0);

-- RESIDENT
ALTER TABLE RESIDENT
  ADD CONSTRAINT chk_resident_gender  CHECK (Gender IN ('Male','Female','Other')),
  ADD CONSTRAINT chk_resident_email   CHECK (Email REGEXP '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}$'),
  ADD CONSTRAINT chk_resident_pincode CHECK (Pincode REGEXP '^[0-9]{6}$');
ALTER TABLE RESIDENT_PHONE
  ADD CONSTRAINT chk_resident_phone CHECK (Phone_No REGEXP '^([+]91)?[0-9]{10}$');

-- ALLOCATION
ALTER TABLE ALLOCATION
  ADD CONSTRAINT chk_allocation_status CHECK (Allocation_Status IN ('ACTIVE','COMPLETED','CANCELLED')),
  ADD CONSTRAINT chk_allocation_dates  CHECK (Check_Out_Date IS NULL OR Check_Out_Date >= Check_In_Date);

-- PAYMENT
ALTER TABLE PAYMENT
  ADD CONSTRAINT chk_payment_amount CHECK (Amount > 0),
  ADD CONSTRAINT chk_payment_type   CHECK (Payment_Type IN ('RENT','DEPOSIT','MAINTENANCE','FOOD','LATE_FEE','OTHER')),
  ADD CONSTRAINT chk_payment_status CHECK (Payment_Status IN ('PENDING','PAID','FAILED','REFUNDED'));

-- COMPLAINT
ALTER TABLE COMPLAINT
  ADD CONSTRAINT chk_complaint_category CHECK (Category IN ('Maintenance','Electrical','Plumbing','Food','Cleanliness','Internet','Noise','Security','Other')),
  ADD CONSTRAINT chk_complaint_priority CHECK (Priority IN ('LOW','MEDIUM','HIGH','URGENT')),
  ADD CONSTRAINT chk_complaint_status   CHECK (Status IN ('OPEN','IN_PROGRESS','RESOLVED','CLOSED')),
  ADD CONSTRAINT chk_complaint_desc_len CHECK (CHAR_LENGTH(Description) >= 5);

-- VISITOR
ALTER TABLE VISITOR
  ADD CONSTRAINT chk_visitor_idtype CHECK (ID_Type IN ('Aadhaar','PAN','Passport','Driving License','Voter ID','Other'));
ALTER TABLE VISITOR_PHONE
  ADD CONSTRAINT chk_visitor_phone CHECK (Phone REGEXP '^([+]91)?[0-9]{10}$');
ALTER TABLE VISITOR_LOG
  ADD CONSTRAINT chk_visitor_time CHECK (Out_Time IS NULL OR Out_Time >= In_Time);

-- RESIDENT_DOCUMENT
ALTER TABLE RESIDENT_DOCUMENT
  ADD CONSTRAINT chk_doc_no     CHECK (DocNo > 0),
  ADD CONSTRAINT chk_doc_type   CHECK (Document_Type IN ('Aadhaar','PAN','Passport','Driving License','College ID','Employee ID','Police Verification','Other')),
  ADD CONSTRAINT chk_doc_status CHECK (Verification_Status IN ('PENDING','VERIFIED','REJECTED'));

-- MENU / FOOD_ITEM / MENU_ITEM
ALTER TABLE MENU
  ADD CONSTRAINT chk_menu_meal CHECK (Meal_Type IN ('BREAKFAST','LUNCH','SNACKS','DINNER'));
ALTER TABLE FOOD_ITEM
  ADD CONSTRAINT chk_food_category CHECK (Category IN ('Staple','Main','Bread','Side','Beverage','Dessert','Snack')),
  ADD CONSTRAINT chk_food_unit     CHECK (Unit IN ('piece','plate','cup','bowl','glass','kg','litre'));
ALTER TABLE MENU_ITEM
  ADD CONSTRAINT chk_menu_item_no  CHECK (Menu_Item_No > 0),
  ADD CONSTRAINT chk_menu_item_qty CHECK (Quantity > 0);
