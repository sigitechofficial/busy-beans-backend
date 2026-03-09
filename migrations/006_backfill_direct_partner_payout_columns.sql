ALTER TABLE `orders`
ADD COLUMN `directPartnerEmployeePayoutId` VARCHAR(255) NULL AFTER `employeeTransferId`,
ADD COLUMN `directPartnerEmployeePayoutStatus` ENUM('pending', 'in_transit', 'paid', 'failed', 'canceled') NULL AFTER `directPartnerEmployeePayoutId`,
ADD COLUMN `directPartnerEmployeePayoutFailureCode` VARCHAR(100) NULL AFTER `directPartnerEmployeePayoutStatus`,
ADD COLUMN `directPartnerEmployeePayoutFailureMessage` TEXT NULL AFTER `directPartnerEmployeePayoutFailureCode`,
ADD COLUMN `directPartnerEmployeePayoutCreatedAt` DATETIME NULL AFTER `directPartnerEmployeePayoutFailureMessage`,
ADD COLUMN `directPartnerEmployeePayoutPaidAt` DATETIME NULL AFTER `directPartnerEmployeePayoutCreatedAt`;

ALTER TABLE `orders`
ADD COLUMN `employeeOf` ENUM('admin', 'direct-partner') NULL AFTER `employeeId`;

ALTER TABLE `orders`
ADD COLUMN `directPartnerEmployeePayoutAttemptCount` INT NULL DEFAULT 0 AFTER `directPartnerEmployeePayoutPaidAt`,
ADD COLUMN `directPartnerEmployeePayoutLastAttemptAt` DATETIME NULL AFTER `directPartnerEmployeePayoutAttemptCount`,
ADD COLUMN `directPartnerEmployeePayoutLastTriggerSource` VARCHAR(64) NULL AFTER `directPartnerEmployeePayoutLastAttemptAt`;

ALTER TABLE `employees`
ADD COLUMN `directPartnerExternalAccountId` VARCHAR(255) NULL AFTER `stripeConnectAccountId`;

CREATE INDEX `idx_orders_dp_employee_payout_id` ON `orders` (`directPartnerEmployeePayoutId`);
CREATE INDEX `idx_orders_dp_employee_payout_status` ON `orders` (`directPartnerEmployeePayoutStatus`);
CREATE INDEX `idx_orders_employee_of` ON `orders` (`employeeOf`);
CREATE INDEX `idx_orders_dp_payout_attempt_count` ON `orders` (`directPartnerEmployeePayoutAttemptCount`);
CREATE INDEX `idx_orders_dp_payout_last_attempt_at` ON `orders` (`directPartnerEmployeePayoutLastAttemptAt`);
CREATE INDEX `idx_employees_dp_external_account_id` ON `employees` (`directPartnerExternalAccountId`);
