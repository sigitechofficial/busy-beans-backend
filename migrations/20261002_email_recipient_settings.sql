CREATE TABLE IF NOT EXISTS `email_recipient_settings` (
  `settingKey` VARCHAR(64) NOT NULL,
  `value` TEXT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`settingKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Email recipients set in the admin panel (Email Configuration, Recipients) instead of addresses
-- hard-coded in the email helpers. Key / value rows. A missing key uses the code default
-- (utils/emailRecipients.js): developer copy = the address the helpers used before, switched on.
-- The comment is after the statement: migrate.js drops statements that start with a comment.
