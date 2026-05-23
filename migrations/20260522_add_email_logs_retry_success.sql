-- Track whether an email log row is from a successful resend/retry attempt

    ALTER TABLE `emailLogs`
    ADD COLUMN `retrySuccess` TINYINT(1) NULL DEFAULT NULL
    COMMENT 'NULL = initial send; 1 = retry succeeded; 0 = retry failed';
