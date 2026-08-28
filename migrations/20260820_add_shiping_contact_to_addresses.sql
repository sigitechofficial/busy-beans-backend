-- Add shipingContact column to addresses table
ALTER TABLE `addresses`
  ADD COLUMN `shippingContact` VARCHAR(255) NULL AFTER `lat`;
