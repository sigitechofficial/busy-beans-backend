ALTER TABLE `users`
ADD COLUMN IF NOT EXISTS `approvedByAdmin` DATETIME NULL DEFAULT NULL;

-- Existing verified customers remain able to log in
UPDATE `users`
SET `approvedByAdmin` = `verifiedAt`
WHERE `verifiedAt` IS NOT NULL
  AND `approvedByAdmin` IS NULL;
