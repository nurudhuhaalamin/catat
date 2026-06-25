-- Migrasi awal: tabel auth (better-auth) + tabel inti v1.
-- Diterapkan oleh: wrangler d1 migrations apply catat [--local|--remote]

-- ============================ better-auth ============================
CREATE TABLE `user` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `email` text NOT NULL,
  `email_verified` integer DEFAULT 0 NOT NULL,
  `image` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);

CREATE TABLE `session` (
  `id` text PRIMARY KEY NOT NULL,
  `expires_at` integer NOT NULL,
  `token` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `ip_address` text,
  `user_agent` text,
  `user_id` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade
);
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);
CREATE INDEX `session_user_idx` ON `session` (`user_id`);

CREATE TABLE `account` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `provider_id` text NOT NULL,
  `user_id` text NOT NULL,
  `access_token` text,
  `refresh_token` text,
  `id_token` text,
  `access_token_expires_at` integer,
  `refresh_token_expires_at` integer,
  `scope` text,
  `password` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade
);
CREATE INDEX `account_user_idx` ON `account` (`user_id`);

CREATE TABLE `verification` (
  `id` text PRIMARY KEY NOT NULL,
  `identifier` text NOT NULL,
  `value` text NOT NULL,
  `expires_at` integer NOT NULL,
  `created_at` integer,
  `updated_at` integer
);
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);

-- ============================ aplikasi (v1) ============================
CREATE TABLE `businesses` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `owner_user_id` text NOT NULL,
  `currency` text DEFAULT 'IDR' NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `deleted_at` integer,
  FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON DELETE cascade
);
CREATE INDEX `businesses_owner_idx` ON `businesses` (`owner_user_id`);

CREATE TABLE `memberships` (
  `id` text PRIMARY KEY NOT NULL,
  `business_id` text NOT NULL,
  `user_id` text NOT NULL,
  `role` text DEFAULT 'staff' NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade
);
CREATE UNIQUE INDEX `memberships_business_user_uniq` ON `memberships` (`business_id`, `user_id`);
CREATE INDEX `memberships_user_idx` ON `memberships` (`user_id`);

CREATE TABLE `invitations` (
  `id` text PRIMARY KEY NOT NULL,
  `business_id` text NOT NULL,
  `email` text NOT NULL,
  `role` text DEFAULT 'staff' NOT NULL,
  `token` text NOT NULL,
  `invited_by` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `created_at` integer NOT NULL,
  `expires_at` integer NOT NULL,
  FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE cascade,
  FOREIGN KEY (`invited_by`) REFERENCES `user`(`id`)
);
CREATE UNIQUE INDEX `invitations_token_unique` ON `invitations` (`token`);
CREATE INDEX `invitations_business_idx` ON `invitations` (`business_id`);

CREATE TABLE `contacts` (
  `id` text PRIMARY KEY NOT NULL,
  `business_id` text NOT NULL,
  `name` text NOT NULL,
  `type` text DEFAULT 'both' NOT NULL,
  `phone` text,
  `note` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `deleted_at` integer,
  FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE cascade
);
CREATE INDEX `contacts_business_idx` ON `contacts` (`business_id`);

CREATE TABLE `categories` (
  `id` text PRIMARY KEY NOT NULL,
  `business_id` text NOT NULL,
  `kind` text NOT NULL,
  `name` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `deleted_at` integer,
  FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE cascade
);
CREATE INDEX `categories_business_idx` ON `categories` (`business_id`);

CREATE TABLE `transactions` (
  `id` text PRIMARY KEY NOT NULL,
  `business_id` text NOT NULL,
  `type` text NOT NULL,
  `amount_cents` integer NOT NULL,
  `category_id` text,
  `contact_id` text,
  `occurred_at` integer NOT NULL,
  `note` text,
  `created_by` text NOT NULL,
  `client_id` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `deleted_at` integer,
  FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE cascade,
  FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`),
  FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`),
  FOREIGN KEY (`created_by`) REFERENCES `user`(`id`)
);
CREATE INDEX `transactions_business_idx` ON `transactions` (`business_id`, `occurred_at`);
CREATE UNIQUE INDEX `transactions_client_uniq` ON `transactions` (`business_id`, `client_id`);
CREATE INDEX `transactions_sync_idx` ON `transactions` (`business_id`, `updated_at`);

CREATE TABLE `debts` (
  `id` text PRIMARY KEY NOT NULL,
  `business_id` text NOT NULL,
  `contact_id` text NOT NULL,
  `direction` text NOT NULL,
  `amount_cents` integer NOT NULL,
  `paid_cents` integer DEFAULT 0 NOT NULL,
  `due_date` integer,
  `status` text DEFAULT 'open' NOT NULL,
  `note` text,
  `created_by` text NOT NULL,
  `client_id` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `deleted_at` integer,
  FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE cascade,
  FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`),
  FOREIGN KEY (`created_by`) REFERENCES `user`(`id`)
);
CREATE INDEX `debts_business_idx` ON `debts` (`business_id`, `status`);
CREATE UNIQUE INDEX `debts_client_uniq` ON `debts` (`business_id`, `client_id`);
CREATE INDEX `debts_sync_idx` ON `debts` (`business_id`, `updated_at`);

CREATE TABLE `debt_payments` (
  `id` text PRIMARY KEY NOT NULL,
  `business_id` text NOT NULL,
  `debt_id` text NOT NULL,
  `amount_cents` integer NOT NULL,
  `paid_at` integer NOT NULL,
  `transaction_id` text,
  `note` text,
  `client_id` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `deleted_at` integer,
  FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE cascade,
  FOREIGN KEY (`debt_id`) REFERENCES `debts`(`id`) ON DELETE cascade,
  FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`)
);
CREATE INDEX `debt_payments_debt_idx` ON `debt_payments` (`debt_id`);
CREATE UNIQUE INDEX `debt_payments_client_uniq` ON `debt_payments` (`business_id`, `client_id`);
CREATE INDEX `debt_payments_sync_idx` ON `debt_payments` (`business_id`, `updated_at`);
