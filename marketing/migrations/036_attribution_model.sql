-- Attribution model (tracking spec Phases 1–3). Additive only: nothing is dropped or rewritten;
-- the existing `attribution` JSON on leads stays as it was sent. 037 backfills the new lead
-- columns from that JSON.
--
-- URL columns are TEXT (row-size limit); the API caps them at 2048 characters.
-- Touch JSON shape (server-normalized, see marketing/utils/attribution.js):
--   { channel, source, medium, campaign, content, term, referrer, referrerDomain, landingPage,
--     landingUrl, rawQuery, clickIds, meta, extraUtm, conflict, timestamp, receivedAt }

-- Leads: every touch model, flat columns for reports, click IDs for future offline uploads.
ALTER TABLE `lead_submissions`
  ADD COLUMN `client_submitted_at` DATETIME NULL AFTER `submitted_at`,
  ADD COLUMN `event_id` VARCHAR(64) NULL AFTER `client_submitted_at`,
  ADD COLUMN `form_id` VARCHAR(100) NULL AFTER `event_id`,
  ADD COLUMN `section_id` VARCHAR(100) NULL AFTER `form_id`,
  ADD COLUMN `channel` VARCHAR(100) NULL AFTER `section_id`,
  ADD COLUMN `source` VARCHAR(100) NULL AFTER `channel`,
  ADD COLUMN `medium` VARCHAR(100) NULL AFTER `source`,
  ADD COLUMN `campaign` VARCHAR(255) NULL AFTER `medium`,
  ADD COLUMN `content` VARCHAR(255) NULL AFTER `campaign`,
  ADD COLUMN `term` VARCHAR(500) NULL AFTER `content`,
  ADD COLUMN `first_touch` JSON NULL AFTER `term`,
  ADD COLUMN `last_touch` JSON NULL AFTER `first_touch`,
  ADD COLUMN `last_non_direct_touch` JSON NULL AFTER `last_touch`,
  ADD COLUMN `session_touch` JSON NULL AFTER `last_non_direct_touch`,
  ADD COLUMN `conversion_touch` JSON NULL AFTER `session_touch`,
  ADD COLUMN `first_touch_source` VARCHAR(100) NULL AFTER `conversion_touch`,
  ADD COLUMN `first_touch_medium` VARCHAR(100) NULL AFTER `first_touch_source`,
  ADD COLUMN `first_touch_channel` VARCHAR(100) NULL AFTER `first_touch_medium`,
  ADD COLUMN `last_touch_source` VARCHAR(100) NULL AFTER `first_touch_channel`,
  ADD COLUMN `last_touch_medium` VARCHAR(100) NULL AFTER `last_touch_source`,
  ADD COLUMN `last_touch_channel` VARCHAR(100) NULL AFTER `last_touch_medium`,
  ADD COLUMN `lnd_source` VARCHAR(100) NULL AFTER `last_touch_channel`,
  ADD COLUMN `lnd_medium` VARCHAR(100) NULL AFTER `lnd_source`,
  ADD COLUMN `lnd_channel` VARCHAR(100) NULL AFTER `lnd_medium`,
  ADD COLUMN `gclid` VARCHAR(512) NULL AFTER `lnd_channel`,
  ADD COLUMN `gbraid` VARCHAR(512) NULL AFTER `gclid`,
  ADD COLUMN `wbraid` VARCHAR(512) NULL AFTER `gbraid`,
  ADD COLUMN `dclid` VARCHAR(512) NULL AFTER `wbraid`,
  ADD COLUMN `fbclid` VARCHAR(512) NULL AFTER `dclid`,
  ADD COLUMN `msclkid` VARCHAR(512) NULL AFTER `fbclid`,
  ADD COLUMN `ttclid` VARCHAR(512) NULL AFTER `msclkid`,
  ADD COLUMN `li_fat_id` VARCHAR(512) NULL AFTER `ttclid`,
  ADD COLUMN `twclid` VARCHAR(512) NULL AFTER `li_fat_id`,
  ADD COLUMN `click_ids` JSON NULL AFTER `twclid`,
  ADD COLUMN `referrer_url` TEXT NULL AFTER `click_ids`,
  ADD COLUMN `referrer_domain` VARCHAR(255) NULL AFTER `referrer_url`,
  ADD COLUMN `first_landing_page` TEXT NULL AFTER `referrer_domain`,
  ADD COLUMN `session_landing_page` TEXT NULL AFTER `first_landing_page`,
  ADD COLUMN `landing_page_url` TEXT NULL AFTER `session_landing_page`,
  ADD COLUMN `conversion_page` TEXT NULL AFTER `landing_page_url`,
  ADD COLUMN `raw_query` TEXT NULL AFTER `conversion_page`,
  ADD COLUMN `attribution_conflict` TINYINT(1) NOT NULL DEFAULT 0 AFTER `raw_query`,
  ADD COLUMN `attribution_basis` VARCHAR(16) NULL AFTER `attribution_conflict`,
  ADD UNIQUE KEY `ls_event_id_uq` (`event_id`),
  ADD KEY `ls_channel_submitted_idx` (`channel`, `submitted_at`),
  ADD KEY `ls_source_medium_idx` (`source`, `medium`),
  ADD KEY `ls_campaign_idx` (`campaign`),
  ADD KEY `ls_first_channel_idx` (`first_touch_channel`, `submitted_at`),
  ADD KEY `ls_lnd_channel_idx` (`lnd_channel`, `submitted_at`),
  ADD KEY `ls_gclid_idx` (`gclid`(191)),
  ADD KEY `ls_test_submitted_idx` (`test_mode`, `submitted_at`);

-- Sessions: the session's acquisition touch (set once, from the session's first touchpoint).
ALTER TABLE `marketing_sessions`
  ADD COLUMN `channel` VARCHAR(100) NULL AFTER `engaged_ms`,
  ADD COLUMN `source` VARCHAR(100) NULL AFTER `channel`,
  ADD COLUMN `medium` VARCHAR(100) NULL AFTER `source`,
  ADD COLUMN `campaign` VARCHAR(255) NULL AFTER `medium`,
  ADD COLUMN `content` VARCHAR(255) NULL AFTER `campaign`,
  ADD COLUMN `term` VARCHAR(500) NULL AFTER `content`,
  ADD COLUMN `referrer` TEXT NULL AFTER `term`,
  ADD COLUMN `landing_url` TEXT NULL AFTER `referrer`,
  ADD COLUMN `touch` JSON NULL AFTER `landing_url`,
  ADD COLUMN `last_activity_at` DATETIME NULL AFTER `touch`,
  ADD KEY `ms_channel_started_idx` (`channel`, `started_at`),
  ADD KEY `ms_source_medium_idx` (`source`, `medium`);

UPDATE `marketing_sessions` SET `last_activity_at` = `ended_at` WHERE `last_activity_at` IS NULL;

-- Visitors: first / last / last non-direct touch, click IDs with their click time.
ALTER TABLE `marketing_visitors`
  ADD COLUMN `first_touch` JSON NULL AFTER `last_seen_at`,
  ADD COLUMN `last_touch` JSON NULL AFTER `first_touch`,
  ADD COLUMN `last_non_direct_touch` JSON NULL AFTER `last_touch`,
  ADD COLUMN `click_ids` JSON NULL AFTER `last_non_direct_touch`,
  ADD COLUMN `first_touch_channel` VARCHAR(100) NULL AFTER `click_ids`,
  ADD COLUMN `first_touch_source` VARCHAR(100) NULL AFTER `first_touch_channel`,
  ADD KEY `mv_first_channel_idx` (`first_touch_channel`);

-- Touchpoints: canonical channel + the full normalized touch.
ALTER TABLE `marketing_touchpoints`
  ADD COLUMN `channel` VARCHAR(100) NULL AFTER `category`,
  ADD COLUMN `touch` JSON NULL AFTER `channel`,
  ADD COLUMN `attribution_conflict` TINYINT(1) NOT NULL DEFAULT 0 AFTER `touch`,
  ADD KEY `mt_channel_ts_idx` (`channel`, `timestamp`);
