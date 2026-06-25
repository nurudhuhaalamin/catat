import { z } from "zod";

/* Skema validasi dipakai bersama oleh worker (server) & web (client). */

export const roleSchema = z.enum(["owner", "admin", "pencatat", "viewer"]);
export type Role = z.infer<typeof roleSchema>;

export const businessCreateSchema = z.object({
  name: z.string().trim().min(1, "Nama usaha wajib diisi").max(120),
  currency: z.string().trim().length(3).default("IDR"),
});

// Provisioning anggota oleh owner/admin (buat akun + peran).
export const memberCreateSchema = z.object({
  email: z.string().trim().email("Email tidak valid"),
  name: z.string().trim().min(1, "Nama wajib diisi").max(120),
  password: z.string().min(8, "Password minimal 8 karakter"),
  role: roleSchema.default("pencatat"),
});

export const passwordResetSchema = z.object({
  password: z.string().min(8, "Password minimal 8 karakter"),
});

export const accountSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  type: z.enum(["cash", "bank", "other"]).default("cash"),
  openingBalanceCents: z.number().int().default(0),
  openingDate: z.number().int().nullable().optional(),
  isArchived: z.boolean().default(false),
  note: z.string().trim().max(500).nullable().optional(),
  clientId: z.string().min(1),
  updatedAt: z.number().int(),
  deletedAt: z.number().int().nullable().optional(),
});

export const contactSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  type: z.enum(["customer", "supplier", "both"]).default("both"),
  phone: z.string().trim().max(40).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
  updatedAt: z.number().int(),
  deletedAt: z.number().int().nullable().optional(),
});

export const categorySchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["income", "expense"]),
  name: z.string().trim().min(1).max(80),
  nature: z.enum(["pendapatan", "modal", "lainnya", "beban", "aset", "prive"]).default("pendapatan"),
  updatedAt: z.number().int(),
  deletedAt: z.number().int().nullable().optional(),
});

export const transactionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["income", "expense", "transfer"]),
  amountCents: z.number().int().positive("Jumlah harus lebih dari 0"),
  accountId: z.string().nullable().optional(),
  toAccountId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  contactId: z.string().nullable().optional(),
  occurredAt: z.number().int(),
  note: z.string().trim().max(500).optional().nullable(),
  clientId: z.string().min(1),
  updatedAt: z.number().int(),
  deletedAt: z.number().int().nullable().optional(),
});

export const debtSchema = z.object({
  id: z.string().min(1),
  contactId: z.string().min(1, "Kontak wajib dipilih"),
  direction: z.enum(["receivable", "payable"]),
  amountCents: z.number().int().positive(),
  paidCents: z.number().int().min(0).default(0),
  categoryId: z.string().nullable().optional(),
  accountId: z.string().nullable().optional(),
  dueDate: z.number().int().nullable().optional(),
  status: z.enum(["open", "partial", "paid"]).default("open"),
  note: z.string().trim().max(500).optional().nullable(),
  clientId: z.string().min(1),
  updatedAt: z.number().int(),
  deletedAt: z.number().int().nullable().optional(),
});

export const debtPaymentSchema = z.object({
  id: z.string().min(1),
  debtId: z.string().min(1),
  amountCents: z.number().int().positive(),
  paidAt: z.number().int(),
  accountId: z.string().nullable().optional(),
  note: z.string().trim().max(500).optional().nullable(),
  clientId: z.string().min(1),
  updatedAt: z.number().int(),
  deletedAt: z.number().int().nullable().optional(),
});

// Entitas yang ikut protokol sync (outbox + delta-pull).
export const syncableEntities = ["accounts", "contacts", "categories", "transactions", "debts", "debtPayments"] as const;
export type SyncableEntity = (typeof syncableEntities)[number];

// Satu mutasi dalam antrian outbox dari perangkat.
export const syncMutationSchema = z.object({
  entity: z.enum(syncableEntities),
  op: z.enum(["upsert", "delete"]),
  data: z.record(z.unknown()),
});

export const syncPushSchema = z.object({
  businessId: z.string().min(1),
  mutations: z.array(syncMutationSchema).max(500),
});

export type SyncMutation = z.infer<typeof syncMutationSchema>;
export type SyncPushBody = z.infer<typeof syncPushSchema>;
