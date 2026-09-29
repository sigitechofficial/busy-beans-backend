-- Analytics correctness (Phase 7).
-- Every event records which page it happened on (page_slug), whether that page is a
-- Campaign Builder landing page or an ordinary site page (page_type), and which app sent it
-- (site). landing_page_slug/landing_page_id stay reserved for real landing-page events.
ALTER TABLE `marketing_analytics_events`
  ADD COLUMN `page_slug` VARCHAR(200) NULL AFTER `landing_page_slug`,
  ADD COLUMN `page_type` VARCHAR(32) NULL AFTER `page_slug`,
  ADD COLUMN `site` VARCHAR(32) NULL AFTER `page_type`,
  ADD KEY `mae_lp_slug_ts_idx` (`landing_page_slug`, `timestamp`),
  ADD KEY `mae_page_slug_ts_idx` (`page_slug`, `timestamp`),
  ADD KEY `mae_event_type_ts_idx` (`event_type`, `timestamp`),
  ADD KEY `mae_session_ts_idx` (`session_id`, `timestamp`);

-- Sessions: where the visit started (written once, never overwritten), where it last touched a
-- landing page, how many pages it viewed, and total active (engaged) time.
ALTER TABLE `marketing_sessions`
  ADD COLUMN `entry_pathname` VARCHAR(500) NULL AFTER `landing_page_slug`,
  ADD COLUMN `entry_landing_page_slug` VARCHAR(200) NULL AFTER `entry_pathname`,
  ADD COLUMN `last_landing_page_slug` VARCHAR(200) NULL AFTER `entry_landing_page_slug`,
  ADD COLUMN `page_count` INT NOT NULL DEFAULT 0 AFTER `last_landing_page_slug`,
  ADD COLUMN `engaged_ms` BIGINT NOT NULL DEFAULT 0 AFTER `page_count`,
  ADD KEY `ms_entry_lp_slug_idx` (`entry_landing_page_slug`);
