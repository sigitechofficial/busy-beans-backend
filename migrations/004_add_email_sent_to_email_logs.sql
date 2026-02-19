-- Add email_sent and error_message to email_logs table

ALTER TABLE `email_logs`
ADD COLUMN `email_sent` VARCHAR(20) NOT NULL DEFAULT 'Success' COMMENT 'Success | Failed';

ALTER TABLE `email_logs`
ADD COLUMN `error_message` TEXT NULL COMMENT 'Error details when email_sent is Failed';
