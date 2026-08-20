CREATE TABLE IF NOT EXISTS `dailyDigestSends` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `reportDate` DATE NOT NULL COMMENT 'Business day (America/New_York) the digest covers',
  `recipientType` ENUM('admin', 'partner') NOT NULL,
  `recipientId` INT NOT NULL COMMENT 'account.id for admin, salesRep.id for partner',
  `status` ENUM('pending', 'sent', 'failed') NOT NULL DEFAULT 'pending',
  `recipients` VARCHAR(500) NULL COMMENT 'Email address(es) used for this send attempt',
  `errorMessage` TEXT NULL,
  `sentAt` DATETIME NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_daily_digest_recipient_day` (`reportDate`, `recipientType`, `recipientId`),
  INDEX `idx_daily_digest_status` (`status`)
);
