-- v2: akun kas/bank, sifat kategori (nature), kolom akun pada transaksi/piutang/hutang.

-- Akun kas/bank
CREATE TABLE `accounts` (
  `id` text PRIMARY KEY NOT NULL,
  `business_id` text NOT NULL,
  `name` text NOT NULL,
  `type` text DEFAULT 'cash' NOT NULL,
  `opening_balance_cents` integer DEFAULT 0 NOT NULL,
  `opening_date` integer,
  `is_archived` integer DEFAULT 0 NOT NULL,
  `note` text,
  `client_id` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `deleted_at` integer,
  FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE cascade
);
CREATE INDEX `accounts_business_idx` ON `accounts` (`business_id`);
CREATE UNIQUE INDEX `accounts_client_uniq` ON `accounts` (`business_id`, `client_id`);
CREATE INDEX `accounts_sync_idx` ON `accounts` (`business_id`, `updated_at`);

-- Sifat kategori
ALTER TABLE `categories` ADD COLUMN `nature` text DEFAULT 'pendapatan' NOT NULL;
UPDATE `categories` SET `nature` = 'beban' WHERE `kind` = 'expense';

-- Kolom akun kas/bank pada transaksi (+ tipe transfer ditangani di aplikasi)
ALTER TABLE `transactions` ADD COLUMN `account_id` text;
ALTER TABLE `transactions` ADD COLUMN `to_account_id` text;

-- Kolom kategori & akun pada piutang/hutang
ALTER TABLE `debts` ADD COLUMN `category_id` text;
ALTER TABLE `debts` ADD COLUMN `account_id` text;

-- Akun pada pembayaran piutang/hutang
ALTER TABLE `debt_payments` ADD COLUMN `account_id` text;

-- Seed 1 akun "Kas" untuk tiap usaha yang sudah ada.
INSERT INTO `accounts` (`id`, `business_id`, `name`, `type`, `opening_balance_cents`, `is_archived`, `client_id`, `created_at`, `updated_at`)
SELECT
  lower(hex(randomblob(16))),
  `id`,
  'Kas',
  'cash',
  0,
  0,
  lower(hex(randomblob(16))),
  CAST(strftime('%s','now') AS INTEGER) * 1000,
  CAST(strftime('%s','now') AS INTEGER) * 1000
FROM `businesses`
WHERE `deleted_at` IS NULL;
