import type {
  businesses,
  memberships,
  contacts,
  categories,
  transactions,
  debts,
  debtPayments,
  invitations,
} from "./schema.js";

export type Business = typeof businesses.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Debt = typeof debts.$inferSelect;
export type DebtPayment = typeof debtPayments.$inferSelect;

export interface BusinessWithRole extends Business {
  role: Membership["role"];
}

// Respons delta-pull: baris berubah per entitas + cursor baru.
export interface SyncPullResult {
  cursor: number;
  changes: {
    contacts: Contact[];
    categories: Category[];
    transactions: Transaction[];
    debts: Debt[];
    debtPayments: DebtPayment[];
  };
}

// Helper format uang (sen -> tampilan).
export function formatMoney(cents: number, currency = "IDR"): string {
  const value = cents / 100;
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency,
      minimumFractionDigits: currency === "IDR" ? 0 : 2,
    }).format(value);
  } catch {
    return value.toLocaleString("id-ID");
  }
}
