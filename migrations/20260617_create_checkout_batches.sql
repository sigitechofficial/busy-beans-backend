CREATE TABLE IF NOT EXISTS `checkout_batches` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `salesRepId` INT NULL,
  `connectAccountId` VARCHAR(255) NULL,
  `partnerType` VARCHAR(64) NULL,
  `batchContext` ENUM('admin', 'partner', 'direct-partner') NOT NULL DEFAULT 'admin',
  `stripeSessionId` VARCHAR(255) NULL,
  `paymentIntentId` VARCHAR(255) NULL,
  `hostedInvoiceUrl` TEXT NULL,
  `grandTotal` DECIMAL(20, 2) NOT NULL DEFAULT 0,
  `totalAdminReceivable` DECIMAL(20, 2) NOT NULL DEFAULT 0,
  `totalPartnerCommission` DECIMAL(20, 2) NOT NULL DEFAULT 0,
  `totalStripeFeeEstimate` DECIMAL(20, 2) NOT NULL DEFAULT 0,
  `status` ENUM('open', 'paid', 'expired', 'cancelled') NOT NULL DEFAULT 'open',
  `invoiceNumbers` JSON NULL,
  `orderIdsSnapshot` JSON NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_checkout_batches_session` (`stripeSessionId`),
  INDEX `idx_checkout_batches_user` (`userId`),
  INDEX `idx_checkout_batches_status` (`status`)
);

CREATE TABLE IF NOT EXISTS `checkout_batch_orders` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `checkoutBatchId` INT NOT NULL,
  `orderId` INT NOT NULL,
  `invoiceNumber` VARCHAR(255) NULL,
  `lineAmount` DECIMAL(20, 2) NOT NULL DEFAULT 0,
  `adminReceivableAmount` DECIMAL(20, 2) NOT NULL DEFAULT 0,
  `localPatnerCommission` DECIMAL(20, 2) NOT NULL DEFAULT 0,
  `proportionalStripeFeeEstimate` DECIMAL(20, 2) NOT NULL DEFAULT 0,
  `proportionalStripeFee` DECIMAL(20, 2) NULL,
  `paidAt` DATETIME NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_checkout_batch_order` (`checkoutBatchId`, `orderId`),
  INDEX `idx_checkout_batch_orders_order` (`orderId`),
  CONSTRAINT `fk_checkout_batch_orders_batch`
    FOREIGN KEY (`checkoutBatchId`) REFERENCES `checkout_batches` (`id`) ON DELETE CASCADE
);
