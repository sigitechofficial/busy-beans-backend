-- Phase 3 hardening: deterministic retries + payout attempt metadata
ALTER TABLE `orders`
  ADD COLUMN `directPartnerEmployeePayoutAttemptCount` INT NULL DEFAULT 0 AFTER `directPartnerEmployeePayoutPaidAt`,
  ADD COLUMN `directPartnerEmployeePayoutLastAttemptAt` DATETIME NULL AFTER `directPartnerEmployeePayoutAttemptCount`,
  ADD COLUMN `directPartnerEmployeePayoutLastTriggerSource` VARCHAR(64) NULL AFTER `directPartnerEmployeePayoutLastAttemptAt`;

CREATE INDEX `idx_orders_dp_payout_attempt_count`
  ON `orders` (`directPartnerEmployeePayoutAttemptCount`);

CREATE INDEX `idx_orders_dp_payout_last_attempt_at`
  ON `orders` (`directPartnerEmployeePayoutLastAttemptAt`);
