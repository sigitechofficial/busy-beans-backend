-- Page-level presentation settings, e.g. {"chrome":"site"|"minimal"}:
-- "site" = storefront header/footer around the landing page (default),
-- "minimal" = logo-only header and slim footer (conversion-focused campaigns).
ALTER TABLE `landing_pages`
  ADD COLUMN `settings` JSON NULL AFTER `form_settings`;
