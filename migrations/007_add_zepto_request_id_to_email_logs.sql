-- Add zeptoRequestId for ZeptoMail webhooks (opened, clicked, etc.)

ALTER TABLE `emailLogs`
ADD COLUMN `zeptoRequestId` VARCHAR(100) NULL COMMENT 'ZeptoMail request_id from send response; used for webhooks';
