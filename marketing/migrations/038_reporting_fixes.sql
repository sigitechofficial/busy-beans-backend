-- Reporting correctness (additive, nothing deleted).
--
-- 1. Campaign Builder canvas / preview events recorded before preview traffic was classified at
--    ingest: mark them like new ones (page_type = 'preview', site = 'campaign-preview') so every
--    report excludes them (utils/reportFilters.js). Website events are never touched.
UPDATE `marketing_analytics_events`
SET `page_type` = 'preview', `site` = 'campaign-preview'
WHERE (`page_type` IS NULL OR `page_type` <> 'preview')
  AND (`site` IS NULL OR `site` <> 'customer-website')
  AND (`pathname` LIKE '/preview/%' OR `pathname` = '/preview'
       OR `pathname` LIKE '/admin/%' OR `pathname` = '/admin');

-- 2. Visitor / new / returning counts read sessions by start time and by visitor + start time.
ALTER TABLE `marketing_sessions`
  ADD KEY `ms_started_idx` (`started_at`),
  ADD KEY `ms_visitor_started_idx` (`visitor_id`, `started_at`);
