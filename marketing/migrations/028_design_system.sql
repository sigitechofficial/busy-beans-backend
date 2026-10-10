-- Page design system (Phase 10): the optional `designSystem` block (named theme + token
-- presets, see utils/designSystem.js) is stored per landing page (draft + published copy, so a
-- theme change goes live on publish like sections do) and per custom template (so pages
-- created from an imported template inherit it).
ALTER TABLE `landing_pages`
  ADD COLUMN `design_system` JSON NULL AFTER `settings`,
  ADD COLUMN `published_design_system` JSON NULL AFTER `design_system`;

ALTER TABLE `custom_templates`
  ADD COLUMN `design_system` JSON NULL AFTER `initial_sections`;
