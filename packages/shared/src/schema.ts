import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/* -------------------------------------------------------------------------- */
/*  better-auth tables                                                        */
/*  Skema ini mengikuti default better-auth (core). Dioper ke drizzleAdapter  */
/*  di worker/src/auth.ts. Jangan ubah nama kolom tanpa update konfigurasi.   */
/* -------------------------------------------------------------------------- */

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => ({ userIdx: index("session_user_idx").on(t.userId) }),
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({ userIdx: index("account_user_idx").on(t.userId) }),
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (t) => ({ identifierIdx: index("verification_identifier_idx").on(t.identifier) }),
);

/* -------------------------------------------------------------------------- */
/*  App tables (v1 inti)                                                       */
/*  Aturan multi-tenant: SEMUA tabel data punya business_id dan setiap query  */
/*  WAJIB difilter business_id + cek membership (lihat worker middleware).     */
/*  Uang selalu disimpan sebagai integer "sen" (amount_cents).                 */
/* -------------------------------------------------------------------------- */

// Lini usaha. Satu pemilik bisa punya banyak.
export const businesses = sqliteTable(
  "businesses",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    currency: text("currency").notNull().default("IDR"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => ({ ownerIdx: index("businesses_owner_idx").on(t.ownerUserId) }),
);

// Keanggotaan tim + peran per lini usaha: owner | admin | staff.
export const memberships = sqliteTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "admin", "staff"] }).notNull().default("staff"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    uniqMember: uniqueIndex("memberships_business_user_uniq").on(t.businessId, t.userId),
    userIdx: index("memberships_user_idx").on(t.userId),
  }),
);

// Undangan anggota tim (sebelum mereka punya akun / menerima).
export const invitations = sqliteTable(
  "invitations",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role", { enum: ["owner", "admin", "staff"] }).notNull().default("staff"),
    token: text("token").notNull().unique(),
    invitedBy: text("invited_by")
      .notNull()
      .references(() => user.id),
    status: text("status", { enum: ["pending", "accepted", "revoked"] })
      .notNull()
      .default("pending"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({ businessIdx: index("invitations_business_idx").on(t.businessId) }),
);

// Kontak: pelanggan / pemasok (untuk piutang & hutang).
export const contacts = sqliteTable(
  "contacts",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type", { enum: ["customer", "supplier", "both"] }).notNull().default("both"),
    phone: text("phone"),
    note: text("note"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => ({ businessIdx: index("contacts_business_idx").on(t.businessId) }),
);

// Kategori pemasukan / pengeluaran.
export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["income", "expense"] }).notNull(),
    name: text("name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => ({ businessIdx: index("categories_business_idx").on(t.businessId) }),
);

// Transaksi kas (uang masuk / keluar). Append-oriented: edit = soft-delete + entri baru.
// clientId = UUID dari perangkat, dipakai untuk dedupe idempoten saat sync push.
export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["income", "expense"] }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    categoryId: text("category_id").references(() => categories.id),
    contactId: text("contact_id").references(() => contacts.id),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
    note: text("note"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    clientId: text("client_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => ({
    businessIdx: index("transactions_business_idx").on(t.businessId, t.occurredAt),
    clientUniq: uniqueIndex("transactions_client_uniq").on(t.businessId, t.clientId),
    syncIdx: index("transactions_sync_idx").on(t.businessId, t.updatedAt),
  }),
);

// Piutang (receivable) & hutang (payable).
export const debts = sqliteTable(
  "debts",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id),
    direction: text("direction", { enum: ["receivable", "payable"] }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    paidCents: integer("paid_cents").notNull().default(0),
    dueDate: integer("due_date", { mode: "timestamp_ms" }),
    status: text("status", { enum: ["open", "partial", "paid"] }).notNull().default("open"),
    note: text("note"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    clientId: text("client_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => ({
    businessIdx: index("debts_business_idx").on(t.businessId, t.status),
    clientUniq: uniqueIndex("debts_client_uniq").on(t.businessId, t.clientId),
    syncIdx: index("debts_sync_idx").on(t.businessId, t.updatedAt),
  }),
);

// Pembayaran cicilan piutang/hutang.
export const debtPayments = sqliteTable(
  "debt_payments",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    debtId: text("debt_id")
      .notNull()
      .references(() => debts.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }).notNull(),
    transactionId: text("transaction_id").references(() => transactions.id),
    note: text("note"),
    clientId: text("client_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => ({
    debtIdx: index("debt_payments_debt_idx").on(t.debtId),
    clientUniq: uniqueIndex("debt_payments_client_uniq").on(t.businessId, t.clientId),
    syncIdx: index("debt_payments_sync_idx").on(t.businessId, t.updatedAt),
  }),
);

export const schema = {
  user,
  session,
  account,
  verification,
  businesses,
  memberships,
  invitations,
  contacts,
  categories,
  transactions,
  debts,
  debtPayments,
};

export { sql };
