CREATE TABLE IF NOT EXISTS `email_settings` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `recipientType` VARCHAR(32) NOT NULL,
  `recipientId` INT NOT NULL DEFAULT 0,
  `emailType` VARCHAR(64) NOT NULL,
  `enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email_settings_type_id_email_unique` (`recipientType`, `recipientId`, `emailType`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @has_default := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'supplier'
    AND COLUMN_NAME = 'isDefaultSupplier'
);

SET @sql := IF(
  @has_default = 0,
  'ALTER TABLE `supplier` ADD COLUMN `isDefaultSupplier` TINYINT(1) NOT NULL DEFAULT 0 AFTER `status`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE `supplier`
SET `isDefaultSupplier` = 1
WHERE `deleted` = 0
  AND `supplierName` LIKE '%Corim%'
ORDER BY `id` ASC
LIMIT 1;
