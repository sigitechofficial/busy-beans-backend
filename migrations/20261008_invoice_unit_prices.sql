SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'items' AND COLUMN_NAME = 'unitPrice');
SET @s := IF(@c = 0, 'ALTER TABLE `items` ADD COLUMN `unitPrice` DECIMAL(10,2) NULL', 'SELECT 1');
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'items' AND COLUMN_NAME = 'priceOverride');
SET @s := IF(@c = 0, 'ALTER TABLE `items` ADD COLUMN `priceOverride` TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'items' AND COLUMN_NAME = 'catalogUnitPrice');
SET @s := IF(@c = 0, 'ALTER TABLE `items` ADD COLUMN `catalogUnitPrice` DECIMAL(10,2) NULL', 'SELECT 1');
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `orderItemPriceLogs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `orderId` INT NOT NULL,
  `productId` INT NULL,
  `productName` VARCHAR(255) NULL,
  `qty` INT NULL,
  `action` VARCHAR(16) NOT NULL,
  `catalogUnitPrice` DECIMAL(10,2) NULL,
  `oldUnitPrice` DECIMAL(10,2) NULL,
  `newUnitPrice` DECIMAL(10,2) NULL,
  `changedByEntity` VARCHAR(32) NULL,
  `changedById` INT NULL,
  `changedByName` VARCHAR(255) NULL,
  `createdAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `order_item_price_logs_order_idx` (`orderId`)
);

-- Editable unit prices on customer invoices (utils/invoiceLinePricing.js): order lines record the
-- unit price charged, whether it was set by hand ("Edit unit price" permission) and the catalog
-- unit price at the time, and orderItemPriceLogs records every custom price change (who / when / old /
-- new). Existing lines are unchanged: price stays the line total, the new columns start empty.
-- Comments stay at the end: migrate.js drops statements that start with a comment.
