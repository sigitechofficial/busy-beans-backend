-- Migration: Direct Partner Employee Payout - Phase 1 (Non-breaking)
-- Date: 2026-03-04
-- Description:
--   Adds nullable columns needed for direct-partner employee bank payout tracking.
--   This migration is intentionally non-breaking:
--   - No existing column is modified or removed
--   - No NOT NULL constraints are introduced
--   - Existing employeeTransferId flow remains unchanged

-- ============================================
-- Step 1: Add payout-tracking fields to orders
-- ============================================

ALTER TABLE `orders`
ADD COLUMN `directPartnerEmployeePayoutId` VARCHAR(255) NULL AFTER `employeeTransferId`,
ADD COLUMN `directPartnerEmployeePayoutStatus` ENUM('pending', 'in_transit', 'paid', 'failed', 'canceled') NULL AFTER `directPartnerEmployeePayoutId`,
ADD COLUMN `directPartnerEmployeePayoutFailureCode` VARCHAR(100) NULL AFTER `directPartnerEmployeePayoutStatus`,
ADD COLUMN `directPartnerEmployeePayoutFailureMessage` TEXT NULL AFTER `directPartnerEmployeePayoutFailureCode`,
ADD COLUMN `directPartnerEmployeePayoutCreatedAt` DATETIME NULL AFTER `directPartnerEmployeePayoutFailureMessage`,
ADD COLUMN `directPartnerEmployeePayoutPaidAt` DATETIME NULL AFTER `directPartnerEmployeePayoutCreatedAt`;

-- ============================================
-- Step 2: Add direct-partner bank destination field to employees
-- ============================================
-- Stores external account id (ba_/card_) attached under partner connected account

ALTER TABLE `employees`
ADD COLUMN `directPartnerExternalAccountId` VARCHAR(255) NULL AFTER `stripeConnectAccountId`;

-- ============================================
-- Step 3: Add indexes for lookup/filter performance
-- ============================================

CREATE INDEX `idx_orders_dp_employee_payout_id`
ON `orders` (`directPartnerEmployeePayoutId`);

CREATE INDEX `idx_orders_dp_employee_payout_status`
ON `orders` (`directPartnerEmployeePayoutStatus`);

CREATE INDEX `idx_employees_dp_external_account_id`
ON `employees` (`directPartnerExternalAccountId`);

-- ============================================
-- Verification
-- ============================================

DESCRIBE `orders`;
DESCRIBE `employees`;
