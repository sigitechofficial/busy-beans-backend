-- Reporting Phase B: the page a lead was submitted on, with the same key as analytics events
-- (utils/analyticsPayload.resolvePageContext: /lp/{slug} → landing_page + slug; other paths →
-- site + path slug). Lets form / conversion-page reports join leads to page events. Additive;
-- 041 backfills existing leads from page_url.
ALTER TABLE `lead_submissions`
  ADD COLUMN `page_type` VARCHAR(32) NULL AFTER `landing_page_slug`,
  ADD COLUMN `page_slug` VARCHAR(200) NULL AFTER `page_type`;
