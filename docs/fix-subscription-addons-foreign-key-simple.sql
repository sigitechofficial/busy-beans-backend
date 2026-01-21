-- Simple Migration Script: Fix subscriptionAddons table to allow NULL addonId
-- Use this if the dynamic version doesn't work on your MySQL version
-- This version manually finds the constraint name first

-- FIRST: Run this query to find the constraint name:
-- SELECT CONSTRAINT_NAME 
-- FROM information_schema.KEY_COLUMN_USAGE 
-- WHERE TABLE_SCHEMA = DATABASE() 
-- AND TABLE_NAME = 'subscriptionAddons' 
-- AND COLUMN_NAME = 'addonId' 
-- AND REFERENCED_TABLE_NAME = 'addons';

-- Then replace 'YOUR_CONSTRAINT_NAME_HERE' below with the actual name from above

-- Step 1: Drop the existing foreign key constraint
-- Replace 'YOUR_CONSTRAINT_NAME_HERE' with the actual constraint name
ALTER TABLE `subscriptionAddons` 
DROP FOREIGN KEY `YOUR_CONSTRAINT_NAME_HERE`;

-- Step 2: Modify the addonId column to allow NULL
ALTER TABLE `subscriptionAddons` 
MODIFY COLUMN `addonId` INT NULL;

-- Step 3: Recreate the foreign key constraint (it will now allow NULL values)
ALTER TABLE `subscriptionAddons` 
ADD CONSTRAINT `subscriptionaddons_ibfk_addonId` 
FOREIGN KEY (`addonId`) 
REFERENCES `addons` (`id`) 
ON DELETE CASCADE 
ON UPDATE CASCADE;

-- Verify the change
DESCRIBE `subscriptionAddons`;
