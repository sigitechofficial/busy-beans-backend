-- Track supplier email resend attempts and last sent time on orders and partnerOrders

ALTER TABLE `orders`
ADD COLUMN `supplierEmailSendCount` INT NULL DEFAULT 0,
ADD COLUMN `supplierEmailLastSentAt` DATETIME NULL;

ALTER TABLE `partnerOrders`
ADD COLUMN `supplierEmailSendCount` INT NULL DEFAULT 0,
ADD COLUMN `supplierEmailLastSentAt` DATETIME NULL;

