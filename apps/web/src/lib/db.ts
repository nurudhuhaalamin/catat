import Dexie, { type Table } from "dexie";

// Catatan: timestamp disimpan sebagai epoch ms (number) agar konsisten dengan server.

interface LocalBase {
  id: string;
  businessId: string;
  updatedAt: number;
  createdAt?: number;
  deletedAt?: number | null;
}

export interface LContact extends LocalBase {
  name: string;
  type: "customer" | "supplier" | "both";
  phone?: string | null;
  note?: string | null;
}

export interface LCategory extends LocalBase {
  kind: "income" | "expense";
  name: string;
}

export interface LTransaction extends LocalBase {
  type: "income" | "expense";
  amountCents: number;
  categoryId?: string | null;
  contactId?: string | null;
  occurredAt: number;
  note?: string | null;
  clientId: string;
}

export interface LDebt extends LocalBase {
  contactId: string;
  direction: "receivable" | "payable";
  amountCents: number;
  paidCents: number;
  dueDate?: number | null;
  status: "open" | "partial" | "paid";
  note?: string | null;
  clientId: string;
}

export interface LDebtPayment extends LocalBase {
  debtId: string;
  amountCents: number;
  paidAt: number;
  note?: string | null;
  clientId: string;
}

export type SyncEntity = "contacts" | "categories" | "transactions" | "debts" | "debtPayments";

export interface OutboxItem {
  localId?: number;
  businessId: string;
  entity: SyncEntity;
  op: "upsert" | "delete";
  data: Record<string, unknown>;
  createdAt: number;
}

export interface MetaItem {
  key: string;
  value: unknown;
}

class CatatDB extends Dexie {
  contacts!: Table<LContact, string>;
  categories!: Table<LCategory, string>;
  transactions!: Table<LTransaction, string>;
  debts!: Table<LDebt, string>;
  debtPayments!: Table<LDebtPayment, string>;
  outbox!: Table<OutboxItem, number>;
  meta!: Table<MetaItem, string>;

  constructor() {
    super("catat");
    this.version(1).stores({
      contacts: "id, businessId, updatedAt",
      categories: "id, businessId, kind, updatedAt",
      transactions: "id, businessId, occurredAt, updatedAt",
      debts: "id, businessId, status, updatedAt",
      debtPayments: "id, businessId, debtId, updatedAt",
      outbox: "++localId, businessId, createdAt",
      meta: "key",
    });
  }
}

export const db = new CatatDB();

export function tableFor(entity: SyncEntity): Table<LocalBase, string> {
  return db[entity] as unknown as Table<LocalBase, string>;
}
