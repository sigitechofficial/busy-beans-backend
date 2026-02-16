-- Add partnerOrderId to emailLogs; make orderId nullable for local-partner logs
-- (Table/column names match Sequelize default camelCase.)

ALTER TABLE `emailLogs`
ADD COLUMN `partnerOrderId` INT NULL COMMENT 'Set when orderType is local-partner';

ALTER TABLE `emailLogs`
MODIFY COLUMN `orderId` INT NULL COMMENT 'Set when orderType is customer';
