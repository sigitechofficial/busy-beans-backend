-- Lead conversion % = visits that produced a lead / visits (never above 100%).
-- lead_sessions: distinct sessions with a lead on that page that day.
ALTER TABLE `marketing_daily_page_stats`
  ADD COLUMN `lead_sessions` INT NOT NULL DEFAULT 0 AFTER `leads`;

-- Daily page stats are a derived cache: clear it so every day is rebuilt from the events
-- (and gets lead_sessions) the next time a report is read.
DELETE FROM `marketing_daily_page_stats`;
DELETE FROM `marketing_daily_rollup_runs`;
