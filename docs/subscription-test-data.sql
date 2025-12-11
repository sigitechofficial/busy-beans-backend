-- Subscription Module - Test Data Setup
-- Run this script to populate test add-ons for the subscription system

-- Insert sample add-ons
INSERT INTO addons (name, description, price, status, deleted, createdAt, updatedAt)
VALUES 
  ('Premium Milk Frother', 'Professional-grade milk frother for perfect cappuccinos and lattes', 30.00, true, false, NOW(), NOW()),
  ('Advanced Water Filter', 'Multi-stage filtration system for the purest coffee taste', 20.00, true, false, NOW(), NOW()),
  ('Cup Warmer Tray', 'Keeps your cups at the perfect temperature all day', 25.00, true, false, NOW(), NOW()),
  ('Coffee Bean Grinder', 'Built-in burr grinder for freshly ground beans', 45.00, true, false, NOW(), NOW()),
  ('Maintenance Package', 'Monthly cleaning supplies and filter replacements', 15.00, true, false, NOW(), NOW());

-- Verify add-ons were created
SELECT * FROM addons WHERE deleted = false;
