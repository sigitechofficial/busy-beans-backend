CREATE TABLE IF NOT EXISTS `subAdmins` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `status` TINYINT(1) DEFAULT 1,
  `phoneNumber` VARCHAR(255) DEFAULT NULL,
  `countryCode` VARCHAR(255) DEFAULT NULL,
  `deleted` TINYINT(1) DEFAULT 0,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  `deletedAt` DATETIME DEFAULT NULL,
  `verificationRequired` TINYINT(1) NOT NULL DEFAULT 0,
  `verificationContext` VARCHAR(50) DEFAULT NULL,
  `verificationOtp` INT(11) DEFAULT NULL,
  `verificationOtpExpiresAt` DATETIME DEFAULT NULL,
  `loginVerificationDone` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `subAdmins_email_unique` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `permissions`
  ADD COLUMN `subAdminId` INT(11) DEFAULT NULL;

ALTER TABLE `permissions`
  ADD KEY `permissions_subAdminId` (`subAdminId`);

ALTER TABLE `permissions`
  ADD CONSTRAINT `permissions_ibfk_subAdminId`
  FOREIGN KEY (`subAdminId`) REFERENCES `subAdmins` (`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;
