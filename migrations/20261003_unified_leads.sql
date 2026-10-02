SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leads' AND COLUMN_NAME = 'enquiryType');
SET @s := IF(@c = 0, 'ALTER TABLE `leads` ADD COLUMN `enquiryType` VARCHAR(32) NULL DEFAULT ''machine''', 'SELECT 1');
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leads' AND COLUMN_NAME = 'marketingEventId');
SET @s := IF(@c = 0, 'ALTER TABLE `leads` ADD COLUMN `marketingEventId` VARCHAR(64) NULL', 'SELECT 1');
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leads' AND COLUMN_NAME = 'getInTouchId');
SET @s := IF(@c = 0, 'ALTER TABLE `leads` ADD COLUMN `getInTouchId` INT NULL', 'SELECT 1');
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leads' AND COLUMN_NAME = 'wonAmount');
SET @s := IF(@c = 0, 'ALTER TABLE `leads` ADD COLUMN `wonAmount` DECIMAL(12,2) NULL', 'SELECT 1');
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leads' AND COLUMN_NAME = 'wonAt');
SET @s := IF(@c = 0, 'ALTER TABLE `leads` ADD COLUMN `wonAt` DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leads' AND INDEX_NAME = 'leads_marketing_event_idx');
SET @s := IF(@c = 0, 'CREATE INDEX `leads_marketing_event_idx` ON `leads` (`marketingEventId`)', 'SELECT 1');
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leads' AND INDEX_NAME = 'leads_get_in_touch_idx');
SET @s := IF(@c = 0, 'CREATE INDEX `leads_get_in_touch_idx` ON `leads` (`getInTouchId`)', 'SELECT 1');
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT INTO `leads` (`contactName`, `contactEmail`, `contactPhone`, `company`, `leadSource`, `status`, `enquiryType`, `getInTouchId`, `notes`, `createdAt`, `updatedAt`)
SELECT g.`name`, g.`email`, LEFT(g.`phone`, 20), COALESCE(NULLIF(g.`company`, ''), g.`name`), 'Website', 'New Enquiry', 'contact', g.`id`,
  NULLIF(CONCAT_WS(CHAR(10),
    IF(g.`teamSize` IS NULL OR g.`teamSize` = '', NULL, CONCAT('Team size: ', g.`teamSize`)),
    IF(g.`preferredDate` IS NULL OR g.`preferredDate` = '', NULL, CONCAT('Preferred date: ', g.`preferredDate`)),
    NULLIF(g.`notes`, '')), ''),
  g.`createdAt`, g.`updatedAt`
FROM `get_in_touches` g
WHERE NOT EXISTS (SELECT 1 FROM `leads` l WHERE l.`getInTouchId` = g.`id`);

-- Unified lead pipeline (utils/leadPipeline.js): every website enquiry becomes a lead on the admin
-- Leads Dashboard (Kanban). Columns are added only when missing (the app's sync also adds them),
-- then existing get-in-touch / tasting requests are imported once as "New Enquiry" leads
-- (enquiryType contact, linked by getInTouchId, so a re-run imports nothing twice).
-- Comments stay at the end: migrate.js drops statements that start with a comment.
