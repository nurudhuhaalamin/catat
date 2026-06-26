-- Lockout login per-IP (rate-limit brute-force).
CREATE TABLE `login_attempts` (
  `ip` text PRIMARY KEY NOT NULL,
  `fails` integer DEFAULT 0 NOT NULL,
  `locked_until` integer,
  `updated_at` integer NOT NULL
);
