-- Migration Script: Fix subscriptionAddons table to allow NULL addonId for "extra" type addons
-- This allows custom/extra addons that don't exist in the addons table

-- Step 0: Find the actual foreign key constraint name (run this first to see the constraint name)
-- Uncomment the line below to see all foreign keys on subscriptionAddons table:
-- SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptionAddons' AND COLUMN_NAME = 'addonId' AND REFERENCED_TABLE_NAME IS NOT NULL;

-- Step 1: Drop the existing foreign key constraint (if it exists)
-- Try common constraint names. Replace with the actual name from Step 0 if different.
-- Option A: If constraint name is subscriptionaddons_ibfk_14
SET @constraint_name = (
    SELECT CONSTRAINT_NAME 
    FROM information_schema.KEY_COLUMN_USAGE 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'subscriptionAddons' 
    AND COLUMN_NAME = 'addonId' 
    AND REFERENCED_TABLE_NAME = 'addons'
    LIMIT 1
);

SET @drop_sql = IF(@constraint_name IS NOT NULL, 
    CONCAT('ALTER TABLE `subscriptionAddons` DROP FOREIGN KEY `', @constraint_name, '`'),
    'SELECT "No foreign key constraint found on addonId column" AS message'
);

PREPARE stmt FROM @drop_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

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
