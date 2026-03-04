-- Ensure email open/click counters always start at 0

ALTER TABLE `emailLogs`
MODIFY COLUMN `openCount` INT NOT NULL DEFAULT 0 COMMENT 'Number of times email was opened';

ALTER TABLE `emailLogs`
MODIFY COLUMN `clickCount` INT NOT NULL DEFAULT 0 COMMENT 'Number of times links were clicked';

-- Correct historical rows that look like "auto-open at creation" baseline
UPDATE `emailLogs`
SET `openCount` = 0
WHERE `openCount` = 1
  AND `firstOpenedAt` IS NULL
  AND `lastOpenedAt` IS NULL;
