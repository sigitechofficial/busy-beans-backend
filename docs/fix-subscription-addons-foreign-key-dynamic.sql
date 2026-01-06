-- Migration Script: Fix subscriptionAddons table to allow NULL addonId for "extra" type addons
-- This version dynamically finds and drops the foreign key constraint
-- Works on both localhost and cPanel (where constraint names may differ)

-- Step 1: Find the actual foreign key constraint name
SET @constraint_name = (
    SELECT CONSTRAINT_NAME 
    FROM information_schema.KEY_COLUMN_USAGE 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'subscriptionAddons' 
    AND COLUMN_NAME = 'addonId' 
    AND REFERENCED_TABLE_NAME = 'addons'
    LIMIT 1
);

-- Step 2: Drop the foreign key constraint if it exists
SET @drop_sql = IF(@constraint_name IS NOT NULL, 
    CONCAT('ALTER TABLE `subscriptionAddons` DROP FOREIGN KEY `', @constraint_name, '`'),
    'SELECT "No foreign key constraint found on addonId column - proceeding..." AS message'
);

PREPARE stmt FROM @drop_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 3: Modify the addonId column to allow NULL
ALTER TABLE `subscriptionAddons` 
MODIFY COLUMN `addonId` INT NULL;

-- Step 4: Recreate the foreign key constraint (it will now allow NULL values)
ALTER TABLE `subscriptionAddons` 
ADD CONSTRAINT `subscriptionaddons_ibfk_addonId` 
FOREIGN KEY (`addonId`) 
REFERENCES `addons` (`id`) 
ON DELETE CASCADE 
ON UPDATE CASCADE;

-- Verify the change
DESCRIBE `subscriptionAddons`;
