-- Add stripeCustomerIdForPartner to users table (Stripe customer on connected account for direct-partner)

ALTER TABLE `users`
ADD COLUMN `stripeCustomerIdForPartner` VARCHAR(255) NULL COMMENT 'Stripe customer ID on connected account for direct-partner';
