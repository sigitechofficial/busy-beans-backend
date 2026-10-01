-- Reporting Phase A: order revenue in reports filters paid orders by paid_at
-- (services/reports.service.js orderMetrics, customer reports). Additive index only.
ALTER TABLE `marketing_order_attribution`
  ADD KEY `moa_status_paid_idx` (`status`, `paid_at`);
