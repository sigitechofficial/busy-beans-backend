-- Migration: Add Employee Commission Fields
-- Date: 2025-01-12
-- Description: Adds commission percentage and Stripe Connect account fields to employees table
--              and employee commission fields to orders table

-- ============================================
-- Step 1: Add fields to employees table
-- ============================================

-- Add commissionPercentage field (DECIMAL(5,2) - allows up to 100.00%)
ALTER TABLE `employees` 
ADD COLUMN `commissionPercentage` DECIMAL(5,2) DEFAULT 0.00 AFTER `employeeOf`;

-- Add stripeConnectAccountId field (VARCHAR(255) - stores Stripe Connect account ID)
ALTER TABLE `employees` 
ADD COLUMN `stripeConnectAccountId` VARCHAR(255) NULL AFTER `commissionPercentage`;

-- ============================================
-- Step 2: Add fields to orders table
-- ============================================

-- Add employeeId field (INT - foreign key to employees table)
ALTER TABLE `orders`
ADD COLUMN `employeeId` INT(11) NULL AFTER `type`;

-- Add AppliedEmployeeCommisionPercentage field (DECIMAL(5,2) - stores the percentage applied)
ALTER TABLE `orders`
ADD COLUMN `AppliedEmployeeCommisionPercentage` DECIMAL(5,2) NULL AFTER `employeeId`;

-- Add employeeCommisionAmount field (DECIMAL(20,2) - stores the commission amount)
ALTER TABLE `orders`
ADD COLUMN `employeeCommisionAmount` DECIMAL(20,2) DEFAULT 0.00 AFTER `AppliedEmployeeCommisionPercentage`;

-- ============================================
-- Step 3: Add foreign key constraint
-- ============================================

-- Add foreign key for employeeId in orders table
ALTER TABLE `orders`
ADD CONSTRAINT `orders_employeeId_fk` 
FOREIGN KEY (`employeeId`) REFERENCES `employees` (`id`) 
ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- Step 4: Add index for better query performance
-- ============================================

-- Add index on employeeId for faster lookups
CREATE INDEX `idx_orders_employeeId` ON `orders` (`employeeId`);

-- ============================================
-- Verification: Check the changes
-- ============================================

-- Verify employees table structure
DESCRIBE `employees`;

-- Verify orders table structure
DESCRIBE `orders`;

-- Check foreign key constraint
SELECT 
    CONSTRAINT_NAME,
    TABLE_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'orders'
AND COLUMN_NAME = 'employeeId'
AND REFERENCED_TABLE_NAME IS NOT NULL;
