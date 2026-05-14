-- Track admin QBO sync state for the PulloutIntentId custom field on invoices.
-- Values:
--   'not-eligible' (default) -> no pullout yet, or admin-skip applies, or gates fail
--   'eligible'               -> gates passed but admin QBO invoice not yet created
--   'synced'                 -> admin QBO invoice now carries the PulloutIntentId custom field
ALTER TABLE `orders`
  ADD COLUMN IF NOT EXISTS `pulloutIntentIdSynced`
  ENUM('not-eligible', 'eligible', 'synced')
  NOT NULL DEFAULT 'not-eligible';

ALTER TABLE `partnerOrders`
  ADD COLUMN IF NOT EXISTS `pulloutIntentIdSynced`
  ENUM('not-eligible', 'eligible', 'synced')
  NOT NULL DEFAULT 'not-eligible';
