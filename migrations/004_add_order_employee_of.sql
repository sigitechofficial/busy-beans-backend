-- Migration: Add employeeOf field to orders
-- Date: 2026-03-04
-- Description:
--   Adds employeeOf field on orders to identify commission ownership context.
--   Allowed values:
--   - 'admin'
--   - 'direct-partner'

ALTER TABLE `orders`
ADD COLUMN `employeeOf` ENUM('admin', 'direct-partner') NULL AFTER `employeeId`;

CREATE INDEX `idx_orders_employee_of` ON `orders` (`employeeOf`);

-- Verification
DESCRIBE `orders`;
