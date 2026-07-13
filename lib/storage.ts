import type { Category } from "@/types/category";
import type { Transaction } from "@/types/transaction";
import type { Wallet } from "@/types/wallet";

const WALLETS_KEY = "finance-wallets";
const CATEGORIES_KEY = "finance-categories";
const TRANSACTIONS_KEY = "finance-transactions";

function safeParse<T>(value: string | null): T | null {
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage write errors.
  }
}

export function loadWallets(): Wallet[] {
  return safeParse<Wallet[]>(window.localStorage.getItem(WALLETS_KEY)) ?? [];
}

export function saveWallets(wallets: Wallet[]) {
  writeStorage(WALLETS_KEY, wallets);
}

export function loadCategories(): Category[] {
  return safeParse<Category[]>(window.localStorage.getItem(CATEGORIES_KEY)) ?? [];
}

export function saveCategories(categories: Category[]) {
  writeStorage(CATEGORIES_KEY, categories);
}

export function loadTransactions(): Transaction[] {
  return safeParse<Transaction[]>(window.localStorage.getItem(TRANSACTIONS_KEY)) ?? [];
}

export function saveTransactions(transactions: Transaction[]) {
  writeStorage(TRANSACTIONS_KEY, transactions);
}
