-- =====================================================================
-- 11_ddl_alter_drop_demo.sql : CREATE / ALTER / DROP demonstration on a
-- scratch table, so the real schema is never touched. Re-runnable.
-- =====================================================================
USE pg_management;
DROP TABLE IF EXISTS DEMO_NOTICE;

-- CREATE
CREATE TABLE DEMO_NOTICE (
  Notice_ID   INT AUTO_INCREMENT PRIMARY KEY,
  Property_ID VARCHAR(20) NOT NULL,
  Title       VARCHAR(100) NOT NULL,
  CONSTRAINT fk_demo_notice_property FOREIGN KEY (Property_ID) REFERENCES PROPERTY(Property_ID) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ALTER: add / modify / rename column, add constraint and index
ALTER TABLE DEMO_NOTICE ADD COLUMN Posted_On DATE NOT NULL DEFAULT (CURRENT_DATE);
ALTER TABLE DEMO_NOTICE MODIFY COLUMN Title VARCHAR(200) NOT NULL;
ALTER TABLE DEMO_NOTICE RENAME COLUMN Title TO Notice_Title;
ALTER TABLE DEMO_NOTICE ADD CONSTRAINT chk_demo_title CHECK (CHAR_LENGTH(Notice_Title) >= 3);
CREATE INDEX idx_demo_posted ON DEMO_NOTICE (Posted_On);
INSERT INTO DEMO_NOTICE (Property_ID, Notice_Title) VALUES ('P001', 'Water supply maintenance on Sunday');
SELECT * FROM DEMO_NOTICE;
DESCRIBE DEMO_NOTICE;

-- ALTER: drop pieces again
DROP INDEX idx_demo_posted ON DEMO_NOTICE;
ALTER TABLE DEMO_NOTICE DROP CHECK chk_demo_title;
ALTER TABLE DEMO_NOTICE DROP COLUMN Posted_On;

-- DROP
DROP TABLE DEMO_NOTICE;
DROP VIEW IF EXISTS vw_demo_tmp;
CREATE VIEW vw_demo_tmp AS SELECT Property_ID, Property_Name FROM PROPERTY;
DROP VIEW vw_demo_tmp;
