-- Migration: Add Employee Transfer ID Field
-- Date: 2025-01-14
-- Description: Adds employeeTransferId field to orders table to store Stripe transfer ID

-- ============================================
-- Add employeeTransferId field to orders table
-- ============================================

-- Add employeeTransferId field (VARCHAR(255) - stores Stripe transfer ID)
ALTER TABLE `orders`
ADD COLUMN `employeeTransferId` VARCHAR(255) NULL AFTER `employeeCommisionAmount`;

-- ============================================
-- Verification: Check the changes
-- ============================================

-- Verify orders table structure
DESCRIBE `orders`;
