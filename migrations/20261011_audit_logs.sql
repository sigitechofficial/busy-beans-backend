CREATE TABLE IF NOT EXISTS `auditLogs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `entityType` VARCHAR(32) NOT NULL,
  `entityId` INT NULL,
  `action` VARCHAR(40) NOT NULL,
  `summary` VARCHAR(255) NULL,
  `changes` TEXT NULL,
  `actorEntity` VARCHAR(32) NULL,
  `actorId` INT NULL,
  `actorName` VARCHAR(255) NULL,
  `createdAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `audit_logs_entity_idx` (`entityType`, `entityId`)
);

-- Audit trail (utils/auditTrail.js): who created / changed / deleted customers (details, approval,
-- category discounts, partner / employee assignment), local partners (details, status, partner type,
-- credit limit, price list), suppliers, sub-admins and employees (details, status, permissions).
-- Only the changed fields are stored (old and new value), never passwords, tokens or bank details.
-- Comments stay at the end: migrate.js drops statements that start with a comment.
