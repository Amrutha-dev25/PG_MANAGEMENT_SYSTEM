-- =====================================================================
-- PG Accommodation Management System  |  MySQL 8.0+
-- 01_schema.sql : DDL - database, tables, primary keys, foreign keys
-- Source of truth: ER diagram + relational schema in /docs/diagrams.
-- Every table / column below maps 1:1 to the relational schema (23 tables).
-- Domain CHECK constraints are added in 02_constraints.sql (ALTER TABLE).
-- =====================================================================
CREATE DATABASE IF NOT EXISTS pg_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pg_management;

-- ---------------------------------------------------------------- PROPERTY
CREATE TABLE IF NOT EXISTS PROPERTY (
  Property_ID   VARCHAR(20)  NOT NULL,
  Property_Name VARCHAR(120) NOT NULL,
  Property_Type VARCHAR(50)  NOT NULL,
  Description   TEXT NULL,
  Total_Floor   INT          NOT NULL,
  Street        VARCHAR(160) NOT NULL,
  City          VARCHAR(80)  NOT NULL,
  Pincode       VARCHAR(10)  NOT NULL,
  CONSTRAINT pk_property PRIMARY KEY (Property_ID),
  CONSTRAINT uq_property_name_city UNIQUE (Property_Name, City)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------- STAFF
-- Property EMPLOYS Staff (1:N); Staff SUPERVISES Staff (recursive 1:N)
CREATE TABLE IF NOT EXISTS STAFF (
  Staff_ID      VARCHAR(20) NOT NULL,
  First_Name    VARCHAR(60) NOT NULL,
  Last_Name     VARCHAR(60) NOT NULL,
  Designation   VARCHAR(80) NOT NULL,
  Salary        DECIMAL(12,2) NOT NULL DEFAULT 0,
  Join_Date     DATE NOT NULL,
  Supervisor_ID VARCHAR(20) NULL,
  Property_ID   VARCHAR(20) NOT NULL,
  CONSTRAINT pk_staff PRIMARY KEY (Staff_ID),
  CONSTRAINT fk_staff_supervisor FOREIGN KEY (Supervisor_ID) REFERENCES STAFF(Staff_ID)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_staff_property FOREIGN KEY (Property_ID) REFERENCES PROPERTY(Property_ID)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ------------------------------------------------------------------ POLICY
-- Property GOVERNS Policy (1:N)
CREATE TABLE IF NOT EXISTS POLICY (
  Policy_ID      VARCHAR(20)  NOT NULL,
  Policy_Type    VARCHAR(80)  NOT NULL,
  Description    TEXT         NOT NULL,
  Effective_From DATE         NOT NULL,
  Effective_To   DATE         NULL,
  Property_ID    VARCHAR(20)  NOT NULL,
  CONSTRAINT pk_policy PRIMARY KEY (Policy_ID),
  CONSTRAINT fk_policy_property FOREIGN KEY (Property_ID) REFERENCES PROPERTY(Property_ID)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------- LICENSE
-- Property HOLDS License (1:N)
CREATE TABLE IF NOT EXISTS LICENSE (
  License_ID     VARCHAR(20) NOT NULL,
  License_Type   VARCHAR(80) NOT NULL,
  License_Number VARCHAR(80) NOT NULL,
  Issue_Date     DATE NOT NULL,
  Expiry_Date    DATE NOT NULL,
  Property_ID    VARCHAR(20) NOT NULL,
  CONSTRAINT pk_license PRIMARY KEY (License_ID),
  CONSTRAINT uq_license_number UNIQUE (License_Number),
  CONSTRAINT fk_license_property FOREIGN KEY (Property_ID) REFERENCES PROPERTY(Property_ID)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------------- ASSET
-- Property OWNS Asset (1:N)
CREATE TABLE IF NOT EXISTS ASSET (
  Asset_ID      VARCHAR(20)  NOT NULL,
  Asset_Name    VARCHAR(120) NOT NULL,
  Asset_Type    VARCHAR(80)  NOT NULL,
  Purchase_Date DATE NOT NULL,
  `Condition`   VARCHAR(40)  NOT NULL,
  Cost          DECIMAL(12,2) NOT NULL DEFAULT 0,
  Property_ID   VARCHAR(20)  NOT NULL,
  CONSTRAINT pk_asset PRIMARY KEY (Asset_ID),
  CONSTRAINT fk_asset_property FOREIGN KEY (Property_ID) REFERENCES PROPERTY(Property_ID)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- -------------------------------------------------------------------- ROOM
-- Property HAS Room (1:N).  Rent = monthly rent charged PER BED.
CREATE TABLE IF NOT EXISTS ROOM (
  Room_ID     VARCHAR(20) NOT NULL,
  Room_No     VARCHAR(20) NOT NULL,
  Room_Type   VARCHAR(50) NOT NULL,
  Capacity    INT         NOT NULL,
  Rent        DECIMAL(12,2) NOT NULL DEFAULT 0,
  Property_ID VARCHAR(20) NOT NULL,
  CONSTRAINT pk_room PRIMARY KEY (Room_ID),
  CONSTRAINT uq_room_property_no UNIQUE (Property_ID, Room_No),
  CONSTRAINT fk_room_property FOREIGN KEY (Property_ID) REFERENCES PROPERTY(Property_ID)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- --------------------------------------------------------------------- BED
-- WEAK entity of ROOM (Room CONTAINS Bed): PK = (Room_ID, Bed_No)
CREATE TABLE IF NOT EXISTS BED (
  Room_ID  VARCHAR(20) NOT NULL,
  Bed_No   INT         NOT NULL,
  Bed_Type VARCHAR(50) NOT NULL DEFAULT 'Single',
  Status   VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',
  CONSTRAINT pk_bed PRIMARY KEY (Room_ID, Bed_No),
  CONSTRAINT fk_bed_room FOREIGN KEY (Room_ID) REFERENCES ROOM(Room_ID)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- -------------------------------------------------------------- ROOM_ASSET
-- Asset ASSIGNED_TO Room (weak entity ROOM ASSETS, partial key Assignment_No)
CREATE TABLE IF NOT EXISTS ROOM_ASSET (
  Assignment_No VARCHAR(20) NOT NULL,
  Asset_ID      VARCHAR(20) NOT NULL,
  Quantity      INT         NOT NULL DEFAULT 1,
  Assigned_Date DATE        NOT NULL,
  Room_ID       VARCHAR(20) NOT NULL,
  CONSTRAINT pk_room_asset PRIMARY KEY (Assignment_No),
  CONSTRAINT fk_room_asset_asset FOREIGN KEY (Asset_ID) REFERENCES ASSET(Asset_ID)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_room_asset_room FOREIGN KEY (Room_ID) REFERENCES ROOM(Room_ID)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------- RESIDENT
-- ER derived attribute AGE is NOT stored: see fn_resident_age() / vw_resident_profile.
-- ER multivalued attribute phone_no is stored in RESIDENT_PHONE.
CREATE TABLE IF NOT EXISTS RESIDENT (
  Resident_ID VARCHAR(20)  NOT NULL,
  FirstName   VARCHAR(60)  NOT NULL,
  LastName    VARCHAR(60)  NOT NULL,
  Email       VARCHAR(160) NOT NULL,
  Gender      VARCHAR(30)  NOT NULL,
  DOB         DATE         NOT NULL,
  Street      VARCHAR(160) NOT NULL,
  City        VARCHAR(80)  NOT NULL,
  Pincode     VARCHAR(10)  NOT NULL,
  CONSTRAINT pk_resident PRIMARY KEY (Resident_ID),
  CONSTRAINT uq_resident_email UNIQUE (Email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS RESIDENT_PHONE (
  Resident_ID VARCHAR(20) NOT NULL,
  Phone_No    VARCHAR(20) NOT NULL,
  CONSTRAINT pk_resident_phone PRIMARY KEY (Resident_ID, Phone_No),
  CONSTRAINT fk_resident_phone_resident FOREIGN KEY (Resident_ID) REFERENCES RESIDENT(Resident_ID)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- -------------------------------------------------------------- ALLOCATION
-- Resident OCCUPIES Bed through ALLOCATION (weak entity, partial key Allocation_No)
CREATE TABLE IF NOT EXISTS ALLOCATION (
  Allocation_No     VARCHAR(20) NOT NULL,
  Check_In_Date     DATE        NOT NULL,
  Check_Out_Date    DATE        NULL,
  Allocation_Date   DATE        NOT NULL,
  Allocation_Status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  Remarks           VARCHAR(500) NULL,
  Resident_ID       VARCHAR(20) NOT NULL,
  Room_ID           VARCHAR(20) NOT NULL,
  Bed_No            INT         NOT NULL,
  CONSTRAINT pk_allocation PRIMARY KEY (Allocation_No),
  CONSTRAINT fk_allocation_resident FOREIGN KEY (Resident_ID) REFERENCES RESIDENT(Resident_ID)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_allocation_bed FOREIGN KEY (Room_ID, Bed_No) REFERENCES BED(Room_ID, Bed_No)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ----------------------------------------------------------------- PAYMENT
-- Resident MAKES Payment (weak entity, partial key Payment_No).
-- ER derived attribute Total_due is NOT stored: see fn_resident_total_due() / vw_resident_dues.
-- For a PENDING payment, Payment_Date is the DUE date; for PAID it is the date paid.
CREATE TABLE IF NOT EXISTS PAYMENT (
  Payment_No     VARCHAR(30) NOT NULL,
  Resident_ID    VARCHAR(20) NOT NULL,
  Payment_Date   DATE        NOT NULL,
  Payment_Type   VARCHAR(50) NOT NULL,
  Amount         DECIMAL(12,2) NOT NULL,
  Payment_Status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  CONSTRAINT pk_payment PRIMARY KEY (Payment_No),
  CONSTRAINT fk_payment_resident FOREIGN KEY (Resident_ID) REFERENCES RESIDENT(Resident_ID)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- --------------------------------------------------------------- COMPLAINT
-- Resident FILES Complaint (weak entity, partial key Complaint_No).
-- The progress timeline of each complaint lives in MongoDB (complaint_updates).
CREATE TABLE IF NOT EXISTS COMPLAINT (
  Complaint_No VARCHAR(20) NOT NULL,
  Resident_ID  VARCHAR(20) NOT NULL,
  Category     VARCHAR(80) NOT NULL,
  Description  TEXT        NOT NULL,
  Priority     VARCHAR(30) NOT NULL DEFAULT 'MEDIUM',
  Status       VARCHAR(30) NOT NULL DEFAULT 'OPEN',
  Date_Filed   DATE        NOT NULL,
  CONSTRAINT pk_complaint PRIMARY KEY (Complaint_No),
  CONSTRAINT fk_complaint_resident FOREIGN KEY (Resident_ID) REFERENCES RESIDENT(Resident_ID)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ------------------------------------------------------------------ VISITOR
CREATE TABLE IF NOT EXISTS VISITOR (
  Visitor_ID VARCHAR(20)  NOT NULL,
  Name       VARCHAR(120) NOT NULL,
  ID_Type    VARCHAR(50)  NOT NULL,
  ID_Number  VARCHAR(80)  NOT NULL,
  CONSTRAINT pk_visitor PRIMARY KEY (Visitor_ID)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS VISITOR_PHONE (
  Visitor_ID VARCHAR(20) NOT NULL,
  Phone      VARCHAR(20) NOT NULL,
  CONSTRAINT pk_visitor_phone PRIMARY KEY (Visitor_ID, Phone),
  CONSTRAINT fk_visitor_phone_visitor FOREIGN KEY (Visitor_ID) REFERENCES VISITOR(Visitor_ID)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- Resident VISITS Visitor (M:N)
CREATE TABLE IF NOT EXISTS VISITOR_RESIDENT (
  Visitor_ID  VARCHAR(20) NOT NULL,
  Resident_ID VARCHAR(20) NOT NULL,
  CONSTRAINT pk_visitor_resident PRIMARY KEY (Visitor_ID, Resident_ID),
  CONSTRAINT fk_vr_visitor  FOREIGN KEY (Visitor_ID)  REFERENCES VISITOR(Visitor_ID)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_vr_resident FOREIGN KEY (Resident_ID) REFERENCES RESIDENT(Resident_ID)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- Visitor LOGGED_AS Visitor_Log (1:N, weak entity, partial key Log_No)
CREATE TABLE IF NOT EXISTS VISITOR_LOG (
  Log_No     VARCHAR(20) NOT NULL,
  Visitor_ID VARCHAR(20) NOT NULL,
  Visit_Date DATE        NOT NULL,
  In_Time    TIME        NOT NULL,
  Out_Time   TIME        NULL,
  Purpose    VARCHAR(250) NOT NULL,
  CONSTRAINT pk_visitor_log PRIMARY KEY (Log_No),
  CONSTRAINT fk_visitor_log_visitor FOREIGN KEY (Visitor_ID) REFERENCES VISITOR(Visitor_ID)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------- AMENITY
CREATE TABLE IF NOT EXISTS AMENITY (
  Amenity_ID   VARCHAR(20)  NOT NULL,
  Amenity_Name VARCHAR(100) NOT NULL,
  Amenity_Type VARCHAR(60)  NOT NULL,
  Description  TEXT NULL,
  CONSTRAINT pk_amenity PRIMARY KEY (Amenity_ID),
  CONSTRAINT uq_amenity_name UNIQUE (Amenity_Name)
) ENGINE=InnoDB;

-- Property PROVIDES Amenity (M:N)
CREATE TABLE IF NOT EXISTS PROPERTY_AMENITY (
  Property_ID VARCHAR(20) NOT NULL,
  Amenity_ID  VARCHAR(20) NOT NULL,
  CONSTRAINT pk_property_amenity PRIMARY KEY (Property_ID, Amenity_ID),
  CONSTRAINT fk_pa_property FOREIGN KEY (Property_ID) REFERENCES PROPERTY(Property_ID)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_pa_amenity FOREIGN KEY (Amenity_ID) REFERENCES AMENITY(Amenity_ID)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------- RESIDENT_DOCUMENT
-- Resident SUBMITS Document (weak entity, partial key Doc_No): PK = (Resident_ID, DocNo)
CREATE TABLE IF NOT EXISTS RESIDENT_DOCUMENT (
  Resident_ID         VARCHAR(20)  NOT NULL,
  DocNo               INT          NOT NULL,
  Document_Type       VARCHAR(80)  NOT NULL,
  Document_Number     VARCHAR(100) NOT NULL,
  Issue_Date          DATE NULL,
  Verification_Status VARCHAR(30)  NOT NULL DEFAULT 'PENDING',
  CONSTRAINT pk_resident_document PRIMARY KEY (Resident_ID, DocNo),
  CONSTRAINT fk_resident_document_resident FOREIGN KEY (Resident_ID) REFERENCES RESIDENT(Resident_ID)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- -------------------------------------------------------------------- MENU
-- Property OFFERS Menu (1:N)
CREATE TABLE IF NOT EXISTS MENU (
  Menu_ID     VARCHAR(20) NOT NULL,
  Menu_Date   DATE        NOT NULL,
  Meal_Type   VARCHAR(40) NOT NULL,
  Meal_Time   TIME        NOT NULL,
  Property_ID VARCHAR(20) NOT NULL,
  CONSTRAINT pk_menu PRIMARY KEY (Menu_ID),
  CONSTRAINT uq_menu_slot UNIQUE (Property_ID, Menu_Date, Meal_Type),
  CONSTRAINT fk_menu_property FOREIGN KEY (Property_ID) REFERENCES PROPERTY(Property_ID)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS FOOD_ITEM (
  Food_Item_ID VARCHAR(20)  NOT NULL,
  Food_Name    VARCHAR(120) NOT NULL,
  Category     VARCHAR(60)  NOT NULL,
  Unit         VARCHAR(30)  NOT NULL,
  CONSTRAINT pk_food_item PRIMARY KEY (Food_Item_ID),
  CONSTRAINT uq_food_name UNIQUE (Food_Name)
) ENGINE=InnoDB;

-- Menu INCLUDES Menu_Item (weak entity, partial key menu_item_no); Menu_Item HAS Food_Item
CREATE TABLE IF NOT EXISTS MENU_ITEM (
  Menu_ID       VARCHAR(20)   NOT NULL,
  Menu_Item_No  INT           NOT NULL,
  Food_Item_ID  VARCHAR(20)   NOT NULL,
  Quantity      DECIMAL(10,2) NOT NULL DEFAULT 1,
  CONSTRAINT pk_menu_item PRIMARY KEY (Menu_ID, Menu_Item_No),
  CONSTRAINT uq_menu_food UNIQUE (Menu_ID, Food_Item_ID),
  CONSTRAINT fk_menu_item_menu FOREIGN KEY (Menu_ID) REFERENCES MENU(Menu_ID)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_menu_item_food FOREIGN KEY (Food_Item_ID) REFERENCES FOOD_ITEM(Food_Item_ID)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;
