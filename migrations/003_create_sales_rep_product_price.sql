-- Migration: Create Sales Rep Product Price Table
-- Date: 2025-01-27
-- Description: Creates a table to store custom product prices for each sales rep

-- ============================================
-- Step 1: Create salesRepProductPrices table
-- ============================================

CREATE TABLE IF NOT EXISTS `salesRepProductPrices` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `productId` INT(11) NOT NULL,
  `salesRepId` INT(11) NOT NULL,
  `price` DECIMAL(20,2) NOT NULL DEFAULT 0.00,
  `status` TINYINT(1) DEFAULT 1,
  `deleted` TINYINT(1) DEFAULT 0,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_product_salesrep` (`productId`, `salesRepId`),
  KEY `productId_index` (`productId`),
  KEY `salesRepId_index` (`salesRepId`),
  CONSTRAINT `salesRepProductPrices_productId_fk` 
    FOREIGN KEY (`productId`) REFERENCES `products` (`id`) 
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `salesRepProductPrices_salesRepId_fk` 
    FOREIGN KEY (`salesRepId`) REFERENCES `salesReps` (`id`) 
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Verification: Check the table structure
-- ============================================

DESCRIBE `salesRepProductPrices`;

-- Check foreign key constraints
SELECT 
    CONSTRAINT_NAME,
    TABLE_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'salesRepProductPrices'
AND REFERENCED_TABLE_NAME IS NOT NULL;
