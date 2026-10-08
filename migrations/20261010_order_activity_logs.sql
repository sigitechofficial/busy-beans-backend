CREATE TABLE IF NOT EXISTS `orderActivityLogs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `orderId` INT NULL,
  `partnerOrderId` INT NULL,
  `action` VARCHAR(40) NOT NULL,
  `summary` VARCHAR(255) NULL,
  `details` TEXT NULL,
  `actorEntity` VARCHAR(32) NULL,
  `actorId` INT NULL,
  `actorName` VARCHAR(255) NULL,
  `createdAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `order_activity_order_idx` (`orderId`),
  KEY `order_activity_partner_order_idx` (`partnerOrderId`)
);

-- Order / invoice activity history (utils/orderActivity.js): who did what and when on an order or
-- partner order (invoice edited with before / after totals and lines, sent, deleted, status changes,
-- supplier assigned, marked paid, cheque added or edited, tracking number, paid online). Unit price
-- changes stay in orderItemPriceLogs and are merged into the same timeline by the activity API.
-- Comments stay at the end: migrate.js drops statements that start with a comment.
