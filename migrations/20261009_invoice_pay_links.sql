SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'payToken');
SET @s := IF(@c = 0, 'ALTER TABLE `orders` ADD COLUMN `payToken` VARCHAR(64) NULL', 'SELECT 1');
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'payLinkLegacy');
SET @s := IF(@c = 0, 'ALTER TABLE `orders` ADD COLUMN `payLinkLegacy` TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'partnerOrders' AND COLUMN_NAME = 'payToken');
SET @s := IF(@c = 0, 'ALTER TABLE `partnerOrders` ADD COLUMN `payToken` VARCHAR(64) NULL', 'SELECT 1');
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'partnerOrders' AND COLUMN_NAME = 'payLinkLegacy');
SET @s := IF(@c = 0, 'ALTER TABLE `partnerOrders` ADD COLUMN `payLinkLegacy` TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND INDEX_NAME = 'orders_pay_token_idx');
SET @s := IF(@c = 0, 'CREATE UNIQUE INDEX `orders_pay_token_idx` ON `orders` (`payToken`)', 'SELECT 1');
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'partnerOrders' AND INDEX_NAME = 'partner_orders_pay_token_idx');
SET @s := IF(@c = 0, 'CREATE UNIQUE INDEX `partner_orders_pay_token_idx` ON `partnerOrders` (`payToken`)', 'SELECT 1');
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE `orders` SET `payLinkLegacy` = 1 WHERE `payToken` IS NULL;

UPDATE `partnerOrders` SET `payLinkLegacy` = 1 WHERE `payToken` IS NULL;

-- Invoice pay links (utils/payLink.js): every invoice gets a random pay code (payToken, created
-- when the invoice email is built) that the "Pay now" link carries, so an order number alone no
-- longer opens a payment page. Every order that exists before this release (payLinkLegacy = 1, paid
-- or not, emailed or not) keeps its old links working without a code: emails, PDFs and links copied
-- from the website all stay valid. Leave PAY_LINK_LEGACY_UNTIL unset to keep that forever.
-- Comments stay at the end: migrate.js drops statements that start with a comment.
