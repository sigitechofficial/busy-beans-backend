-- Add open, click, and soft-bounce tracking columns (updated by ZeptoMail webhook)

ALTER TABLE `emailLogs`
ADD COLUMN `firstOpenedAt` DATETIME NULL COMMENT 'First time email was opened',
ADD COLUMN `lastOpenedAt` DATETIME NULL COMMENT 'Most recent open time',
ADD COLUMN `openCount` INT NOT NULL DEFAULT 0 COMMENT 'Number of times email was opened',
ADD COLUMN `clickCount` INT NOT NULL DEFAULT 0 COMMENT 'Number of times links were clicked',
ADD COLUMN `softBouncedAt` DATETIME NULL COMMENT 'When soft bounce was reported',
ADD COLUMN `softBounceReason` TEXT NULL COMMENT 'Soft bounce reason/diagnostic';
