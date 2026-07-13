"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  PencilLine,
  PlusCircle,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet as WalletIcon,
} from "lucide-react";
import { calculateSummary, formatCurrency, formatDate } from "@/lib/format";
import {
  loadCategories,
  loadTransactions,
  loadWallets,
  saveCategories,
  saveTransactions,
  saveWallets,
} from "@/lib/storage";
import type { Transaction, TransactionType } from "@/types/transaction";
import type { Wallet } from "@/types/wallet";
import type { Category, CategoryType } from "@/types/category";

type TransactionFormState = {
  description: string;
  amount: string;
  type: TransactionType;
  date: string;
  categoryId?: string | null;
  walletId?: string | null;
};

type WalletFormState = {
  name: string;
  icon: string;
  color: string;
  saldo_awal: string;
};

type CategoryFormState = {
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
};

type ModalMode = "transaction" | "wallet" | "category" | null;

const MONTH_OPTIONS = [
  { value: 1, label: "Januari" },
  { value: 2, label: "Februari" },
  { value: 3, label: "Maret" },
  { value: 4, label: "April" },
  { value: 5, label: "Mei" },
  { value: 6, label: "Juni" },
  { value: 7, label: "Juli" },
  { value: 8, label: "Agustus" },
  { value: 9, label: "September" },
  { value: 10, label: "Oktober" },
  { value: 11, label: "November" },
  { value: 12, label: "Desember" },
];

const CATEGORY_COLOR_OPTIONS = [
  { label: "Slate", value: "bg-slate-200" },
  { label: "Red", value: "bg-red-200" },
  { label: "Green", value: "bg-green-200" },
  { label: "Blue", value: "bg-blue-200" },
  { label: "Yellow", value: "bg-yellow-200" },
  { label: "Purple", value: "bg-purple-200" },
  { label: "Orange", value: "bg-orange-200" },
  { label: "Pink", value: "bg-pink-200" },
];

const CATEGORY_ICON_OPTIONS = ["💼", "💻", "🧾", "🍔", "🚗", "🏠", "🛒", "🎁", "📚", "🏥", "🎮", "✨"];

const TODAY = new Date();
const CURRENT_MONTH = TODAY.getMonth() + 1;
const CURRENT_YEAR = TODAY.getFullYear();

const initialFormState: TransactionFormState = {
  description: "",
  amount: "",
  type: "income",
  date: new Date().toISOString().slice(0, 10),
  categoryId: null,
  walletId: null,
};

const initialWalletFormState: WalletFormState = {
  name: "",
  icon: "",
  color: "bg-slate-200",
  saldo_awal: "0",
};

const DEFAULT_CATEGORIES: Category[] = [
  { id: "income-gaji", name: "Gaji", type: "income", color: "bg-emerald-100", icon: "💼" },
  { id: "income-freelance", name: "Freelance", type: "income", color: "bg-sky-100", icon: "🧑‍💻" },
  { id: "income-lainnya", name: "Lainnya", type: "income", color: "bg-slate-200", icon: "🧾" },
  { id: "expense-makanan", name: "Makanan", type: "expense", color: "bg-rose-100", icon: "🍔" },
  { id: "expense-transportasi", name: "Transportasi", type: "expense", color: "bg-fuchsia-100", icon: "🚗" },
  { id: "expense-lainnya", name: "Lainnya", type: "expense", color: "bg-slate-200", icon: "🧾" },
];

function getFallbackCategoryId(type: CategoryType, categories: Category[]) {
  return (
    categories.find((category) => category.type === type && category.name.toLowerCase() === "lainnya")?.id ||
    categories.find((category) => category.type === type)?.id ||
    categories[0]?.id ||
    ""
  );
}

function ensureDefaultCategories(categories: Category[]) {
  const categoryTypes: CategoryType[] = ["income", "expense"];
  return categoryTypes.reduce<Category[]>((result, type) => {
    const ownsFallback = result.some((category) => category.type === type && category.name.toLowerCase() === "lainnya");
    if (!ownsFallback) {
      return [
        ...result,
        {
          id: `${type}-lainnya`,
          name: "Lainnya",
          type,
          color: "bg-slate-200",
          icon: "🧾",
        },
      ];
    }
    return result;
  }, categories);
}

export default function FinanceApp() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [form, setForm] = useState<TransactionFormState>(initialFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [reportMonthDraft, setReportMonthDraft] = useState(CURRENT_MONTH);
  const [reportYearDraft, setReportYearDraft] = useState(CURRENT_YEAR);
  const [reportMonth, setReportMonth] = useState(CURRENT_MONTH);
  const [reportYear, setReportYear] = useState(CURRENT_YEAR);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>({
    name: "",
    type: "expense",
    color: "bg-slate-200",
    icon: "🧾",
  });
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [walletForm, setWalletForm] = useState<WalletFormState>(initialWalletFormState);
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(null);

  useEffect(() => {
    if (!categories.length) return;

    setForm((current) => {
      if (current.categoryId && categories.some((category) => category.id === current.categoryId)) {
        return current;
      }

      return {
        ...current,
        categoryId: getFallbackCategoryId(current.type, categories),
      };
    });
  }, [categories]);

  useEffect(() => {
    const storedCategories = loadCategories();
    const nextCategories = ensureDefaultCategories(Array.isArray(storedCategories) ? storedCategories : DEFAULT_CATEGORIES);
    setCategories(nextCategories);

    const storedTransactions = loadTransactions();
    if (Array.isArray(storedTransactions)) {
      setTransactions(
        storedTransactions.map((transaction) => ({
          ...transaction,
          categoryId:
            transaction.categoryId && nextCategories.some((category) => category.id === transaction.categoryId)
              ? transaction.categoryId
              : getFallbackCategoryId(transaction.type, nextCategories),
        }))
      );
    }

    const storedWallets = loadWallets();
    if (Array.isArray(storedWallets)) {
      setWallets(storedWallets);
    }

    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    saveTransactions(transactions);
  }, [isLoaded, transactions]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    saveWallets(wallets);
  }, [isLoaded, wallets]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    saveCategories(categories);
  }, [isLoaded, categories]);

  useEffect(() => {
    if (!modalMode) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [modalMode]);

  function closeModal() {
    setModalMode(null);
  }

  function openAddTransaction() {
    setBottomSheetOpen(false);
    setModalMode("transaction");
    setEditingId(null);
    setForm({
      ...initialFormState,
      categoryId: getFallbackCategoryId("income", categories),
    });
  }

  function openAddWallet() {
    setBottomSheetOpen(false);
    setModalMode("wallet");
    setEditingWalletId(null);
    setWalletForm(initialWalletFormState);
  }

  function openEditWallet(wallet: Wallet) {
    setModalMode("wallet");
    setEditingWalletId(wallet.id);
    setWalletForm({
      name: wallet.name,
      icon: wallet.icon || "",
      color: wallet.color || "bg-slate-200",
      saldo_awal: String(wallet.saldo_awal),
    });
  }

  function saveWallet(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const name = walletForm.name.trim();
    const icon = walletForm.icon.trim();
    const color = walletForm.color.trim() || "bg-slate-200";
    const saldo_awal = Number(Number(walletForm.saldo_awal || 0).toFixed(2));
    if (!name || saldo_awal < 0) {
      return;
    }

    if (editingWalletId) {
      setWallets((current) =>
        current.map((wallet) => {
          if (wallet.id !== editingWalletId) return wallet;
          const delta = saldo_awal - wallet.saldo_awal;
          return {
            ...wallet,
            name,
            icon: icon || wallet.icon,
            color,
            saldo_awal,
            saldo_saat_ini: Number((wallet.saldo_saat_ini + delta).toFixed(2)),
          };
        })
      );
    } else {
      setWallets((current) => [
        {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name,
          icon: icon || "👛",
          color,
          saldo_awal,
          saldo_saat_ini: saldo_awal,
        },
        ...current,
      ]);
    }

    setWalletForm(initialWalletFormState);
    setEditingWalletId(null);
    setModalMode(null);
  }

  function deleteWallet(id: string) {
    if (!window.confirm("Hapus wallet ini?")) return;
    setWallets((current) => current.filter((wallet) => wallet.id !== id));
  }

  function openManageCategories() {
    setBottomSheetOpen(false);
    setModalMode("category");
    setEditingCategoryId(null);
    setCategoryForm({ name: "", type: "expense", color: "bg-slate-200", icon: "🧾" });
  }

  function openEditCategory(category: Category) {
    setModalMode("category");
    setEditingCategoryId(category.id);
    setCategoryForm({
      name: category.name,
      type: category.type,
      color: category.color,
      icon: category.icon,
    });
  }

  function saveCategory(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const name = categoryForm.name.trim();
    const color = categoryForm.color.trim() || "bg-slate-200";
    const icon = categoryForm.icon.trim() || "🧾";

    if (!name) {
      return;
    }

    if (editingCategoryId) {
      setCategories((current) =>
        current.map((category) =>
          category.id === editingCategoryId ? { ...category, name, color, icon } : category
        )
      );
    } else {
      setCategories((current) => [
        {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name,
          type: categoryForm.type,
          color,
          icon,
        },
        ...current,
      ]);
    }

    setEditingCategoryId(null);
    setCategoryForm({ name: "", type: "expense", color: "bg-slate-200", icon: "🧾" });
    setModalMode(null);
  }

  function deleteCategory(id: string) {
    const categoryToDelete = categories.find((category) => category.id === id);
    if (!categoryToDelete) return;

    if (!window.confirm("Hapus kategori ini? Transaksi yang menggunakan kategori ini akan dipindahkan ke Lainnya.")) {
      return;
    }

    const fallbackId = getFallbackCategoryId(categoryToDelete.type, categories.filter((category) => category.id !== id));

    setTransactions((current) =>
      current.map((transaction) =>
        transaction.categoryId === id ? { ...transaction, categoryId: fallbackId } : transaction
      )
    );
    setCategories((current) => current.filter((category) => category.id !== id));
  }

  const filteredTransactions = useMemo(() => {
    if (!selectedDate) return transactions;
    return transactions.filter((t) => t.date === selectedDate);
  }, [transactions, selectedDate]);

  const summary = useMemo(() => calculateSummary(filteredTransactions), [filteredTransactions]);

  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredTransactions]);

  const incomeTransactions = useMemo(
    () => sortedTransactions.filter((t) => t.type === "income"),
    [sortedTransactions]
  );

  const expenseTransactions = useMemo(
    () => sortedTransactions.filter((t) => t.type === "expense"),
    [sortedTransactions]
  );

  const reportYearOptions = useMemo(() => {
    const years = new Set<number>([CURRENT_YEAR, reportYear, reportYearDraft]);
    transactions.forEach((transaction) => {
      const year = Number(transaction.date.slice(0, 4));
      if (!Number.isNaN(year)) {
        years.add(year);
      }
    });

    return Array.from(years).sort((a, b) => b - a);
  }, [reportYear, reportYearDraft, transactions]);

  const reportTransactions = useMemo(() => {
    const month = String(reportMonth).padStart(2, "0");
    const prefix = `${reportYear}-${month}`;
    return transactions
      .filter((transaction) => transaction.date.startsWith(prefix))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [reportMonth, reportYear, transactions]);

  const reportSummary = useMemo(() => calculateSummary(reportTransactions), [reportTransactions]);

  const reportChartData = useMemo(
    () => [
      { name: "Pemasukan", total: reportSummary.income },
      { name: "Pengeluaran", total: reportSummary.expense },
      { name: "Sisa Saldo", total: reportSummary.balance },
    ],
    [reportSummary]
  );

  const categoryBreakdown = useMemo(() => {
    const totals = new Map<string, { category: Category | undefined; total: number; count: number; type: TransactionType }>();

    reportTransactions.forEach((transaction) => {
      const category = categories.find((item) => item.id === transaction.categoryId);
      const key = transaction.categoryId || `${transaction.type}-uncategorized`;
      const current = totals.get(key);

      totals.set(key, {
        category,
        total: (current?.total ?? 0) + transaction.amount,
        count: (current?.count ?? 0) + 1,
        type: transaction.type,
      });
    });

    return Array.from(totals.values()).sort((a, b) => b.total - a.total);
  }, [categories, reportTransactions]);

  const selectedReportMonthLabel = MONTH_OPTIONS.find((month) => month.value === reportMonth)?.label ?? "";

  function applyReportFilter() {
    setReportMonth(reportMonthDraft);
    setReportYear(reportYearDraft);
  }

  function resetForm() {
    setForm(initialFormState);
    setEditingId(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const description = form.description.trim();
    const amount = Number(form.amount);

    if (!description || !amount || amount <= 0) {
      return;
    }

    if (!form.categoryId) {
      return;
    }

    const payload = {
      description,
      amount: Number(amount.toFixed(2)),
      type: form.type,
      date: form.date || new Date().toISOString().slice(0, 10),
      categoryId: form.categoryId,
      walletId: form.walletId ?? null,
    };

    if (editingId) {
      // find original to revert wallet changes
      const original = transactions.find((t) => t.id === editingId);

      setTransactions((current) =>
        current.map((transaction) => (transaction.id === editingId ? { ...transaction, ...payload } : transaction))
      );

      if (original) {
        // revert original wallet
        if (original.walletId) {
          setWallets((cur) =>
            cur.map((w) => {
              if (w.id !== original.walletId) return w;
              const adj = original.type === "income" ? -original.amount : original.type === "expense" ? original.amount : 0;
              return { ...w, saldo_saat_ini: Number((w.saldo_saat_ini + adj).toFixed(2)) };
            })
          );
        }

        // apply to new wallet
        if (payload.walletId) {
          setWallets((cur) =>
            cur.map((w) => {
              if (w.id !== payload.walletId) return w;
              const adj = payload.type === "income" ? payload.amount : payload.type === "expense" ? -payload.amount : 0;
              return { ...w, saldo_saat_ini: Number((w.saldo_saat_ini + adj).toFixed(2)) };
            })
          );
        }
      }
    } else {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setTransactions((current) => [{ id, ...payload }, ...current]);

      if (payload.walletId) {
        setWallets((cur) =>
          cur.map((w) => {
            if (w.id !== payload.walletId) return w;
            const adj = payload.type === "income" ? payload.amount : payload.type === "expense" ? -payload.amount : 0;
            return { ...w, saldo_saat_ini: Number((w.saldo_saat_ini + adj).toFixed(2)) };
          })
        );
      }
    }

    resetForm();
  }

  function handleEdit(transaction: Transaction) {
    setEditingId(transaction.id);
    setForm({
      description: transaction.description,
      amount: transaction.amount.toString(),
      type: transaction.type,
      date: transaction.date,
      categoryId: categories.some((category) => category.id === transaction.categoryId)
        ? transaction.categoryId
        : getFallbackCategoryId(transaction.type, categories),
      walletId: transaction.walletId ?? null,
    });
  }

  function handleDelete(transactionId: string) {
    const toDelete = transactions.find((t) => t.id === transactionId);
    setTransactions((current) => current.filter((transaction) => transaction.id !== transactionId));

    if (toDelete && toDelete.walletId) {
      setWallets((cur) =>
        cur.map((w) => {
          if (w.id !== toDelete.walletId) return w;
          const adj = toDelete.type === "income" ? -toDelete.amount : toDelete.type === "expense" ? toDelete.amount : 0;
          return { ...w, saldo_saat_ini: Number((w.saldo_saat_ini + adj).toFixed(2)) };
        })
      );
    }

    if (editingId === transactionId) {
      resetForm();
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.16),_transparent_45%),linear-gradient(135deg,_#f8fbff_0%,_#eef4ff_100%)] px-4 py-4 text-slate-800">
      <div className="mx-auto flex w-full max-w-screen-xl flex-col gap-4">
        <header className="rounded-[20px] border border-slate-200/70 bg-white/80 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur md:max-h-[90px] md:overflow-hidden">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0 max-w-2xl">
              <div className="mb-1 hidden items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-100 sm:inline-flex">
                <WalletIcon size={14} />
                Personal Finance
              </div>
              <h1 className="text-base font-semibold leading-tight tracking-tight text-slate-900 sm:text-3xl">
                Kelola uangmu dengan lebih tenang
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Pantau pemasukan, pengeluaran, dan saldo terbaru dari satu tempat.
              </p>
            </div>
            <div className="flex w-full shrink-0 items-center md:w-auto">
              <div className="w-full rounded-2xl bg-slate-900 px-3 py-2 text-white shadow-lg sm:px-4 sm:py-3 md:w-auto">
                <p className="text-xs text-slate-300">Saldo saat ini</p>
                <p className="mt-0.5 text-sm font-semibold sm:text-xl">{formatCurrency(summary.balance)}</p>
              </div>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-4 lg:flex lg:items-stretch">
          <div className="col-span-2 rounded-[20px] border border-slate-200/70 bg-white/80 p-4 shadow-[0_10px_25px_rgba(15,23,42,0.05)] backdrop-blur lg:w-[28%] lg:min-w-[250px]">
            <div className="flex h-full flex-col justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-500">Filter tanggal</p>
                <p className="text-sm font-semibold text-slate-900">Lihat transaksi berdasarkan tanggal</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <label className="min-w-0">
                  <input
                    type="date"
                    value={selectedDate ?? ""}
                    onChange={(e) => setSelectedDate(e.target.value || null)}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:ring-1 focus:ring-sky-300"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Hari Ini
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Tampilkan Semua
                </button>
              </div>
            </div>
          </div>
          <div className="contents lg:grid lg:flex-1 lg:grid-cols-3 lg:gap-4">
            <div className="h-full rounded-[20px] border border-emerald-100 bg-emerald-50 p-4 shadow-sm transition-all">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-emerald-700">Total pemasukan</p>
                <div className="rounded-2xl bg-emerald-100 p-1.5 text-emerald-600">
                  <TrendingUp size={16} />
                </div>
              </div>
              <p className="mt-2 text-xl font-semibold text-emerald-800">{formatCurrency(summary.income)}</p>
            </div>

            <div className="h-full rounded-[20px] border border-rose-100 bg-rose-50 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-rose-700">Total pengeluaran</p>
                <div className="rounded-2xl bg-rose-100 p-1.5 text-rose-600">
                  <TrendingDown size={16} />
                </div>
              </div>
              <p className="mt-2 text-xl font-semibold text-rose-800">{formatCurrency(summary.expense)}</p>
            </div>

            <div className="col-span-2 h-full rounded-[20px] border border-sky-100 bg-sky-50 p-4 shadow-sm lg:col-span-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-sky-700">Total asset</p>
                <div className="rounded-2xl bg-sky-100 p-1.5 text-sky-600">
                  <WalletIcon size={16} />
                </div>
              </div>
              <p className="mt-2 text-xl font-semibold text-sky-800">{formatCurrency(wallets.reduce((s, w) => s + w.saldo_saat_ini, 0))}</p>
              <p className="mt-1 text-sm text-slate-600">{wallets.length} wallet • Terbesar: {wallets.length ? wallets.reduce((a, b) => (a.saldo_saat_ini > b.saldo_saat_ini ? a : b)).name : '-'}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-4">
          <form
            onSubmit={handleSubmit}
            className="flex h-full min-w-0 flex-col rounded-[20px] border border-slate-200/70 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.06)] lg:min-h-[520px]"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-slate-500">
                  {editingId ? "Edit transaksi" : "Tambah transaksi"}
                </p>
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingId ? "Perbarui catatan keuangan" : "Catat pemasukan atau pengeluaran"}
                </h2>
              </div>
              <div className="rounded-2xl bg-slate-100 p-1.5 text-slate-600">
                <PlusCircle size={18} />
              </div>
            </div>

            <div className="mt-4 flex-1 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-700">Deskripsi</span>
                <input
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-sky-500 focus:bg-white"
                  placeholder="Contoh: Gaji bulanan"
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  required
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-700">Jumlah</span>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-sky-500 focus:bg-white"
                    placeholder="0"
                    value={form.amount}
                    onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-700">Jenis</span>
                  <select
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-sky-500 focus:bg-white"
                    value={form.type}
                    onChange={(event) =>
                      setForm((current) => {
                        const nextType = event.target.value as TransactionType;
                        const validCategoryId = categories.some(
                          (category) => category.id === current.categoryId && category.type === nextType
                        )
                          ? current.categoryId
                          : getFallbackCategoryId(nextType, categories);

                        return {
                          ...current,
                          type: nextType,
                          categoryId: validCategoryId,
                        };
                      })
                    }
                  >
                    <option value="income">Pemasukan</option>
                    <option value="expense">Pengeluaran</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-700">Kategori</span>
                  <select
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-sky-500 focus:bg-white"
                    value={form.categoryId ?? ""}
                    onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value || null }))}
                    required
                  >
                    <option value="">Pilih kategori</option>
                    {categories.filter((category) => category.type === form.type).map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.icon} {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-700">Wallet</span>
                  <select
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-sky-500 focus:bg-white"
                    value={form.walletId ?? ""}
                    onChange={(event) => setForm((current) => ({ ...current, walletId: event.target.value || null }))}
                  >
                    <option value="">Tidak ada</option>
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-700">Tanggal</span>
                <input
                  type="date"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-sky-500 focus:bg-white"
                  value={form.date}
                  onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                  required
                />
              </label>
            </div>

            <div className="mt-auto grid gap-2 pt-4 sm:grid-cols-2">
              <button
                type="submit"
                className="h-12 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                {editingId ? "Simpan perubahan" : "Tambah transaksi"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Batal
              </button>
            </div>
          </form>
          <div className="flex h-full min-w-0 flex-col rounded-[20px] border border-slate-200/70 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.06)] lg:min-h-[520px]">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-slate-500">Daftar Wallet</p>
                <h2 className="text-lg font-semibold text-slate-900">Semua wallet</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={openManageCategories}
                  className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Kelola Kategori
                </button>
                <button
                  type="button"
                  onClick={openAddWallet}
                  className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Tambah Wallet
                </button>
              </div>
            </div>

            <div className="mt-3 flex-1 pr-0 lg:overflow-y-auto lg:pr-1">
              {wallets.length === 0 ? (
                <div className="flex min-h-[120px] items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500 lg:min-h-[220px]">
                  Belum ada wallet. Tambahkan wallet terlebih dahulu.
                </div>
              ) : (
                <div className="space-y-2">
                  {wallets.map((wallet) => (
                    <div key={wallet.id} className={`rounded-[20px] border p-3 ${wallet.color || "bg-slate-100"}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">{wallet.icon || "👛"}</div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">{wallet.name}</p>
                            <p className="text-sm text-slate-600">{formatCurrency(wallet.saldo_saat_ini)}</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => openEditWallet(wallet)}
                            className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteWallet(wallet.id)}
                            className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex min-h-0 min-w-0 flex-col rounded-[20px] border border-slate-200/70 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.06)] lg:min-h-[520px]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-emerald-700">Daftar Pemasukan</p>
                  <p className="text-lg font-semibold text-emerald-800">{formatCurrency(incomeTransactions.reduce((s, t) => s + t.amount, 0))}</p>
                  <p className="text-xs text-emerald-700">{incomeTransactions.length} transaksi</p>
                </div>
                <div className="rounded-2xl bg-emerald-100 p-1.5 text-emerald-600">
                  <TrendingUp size={16} />
                </div>
              </div>
              <div className="mt-3 min-h-0 flex-1 pr-0 lg:overflow-y-auto lg:pr-1">
                {incomeTransactions.length === 0 ? (
                  <div className="flex min-h-[120px] items-center justify-center rounded-2xl border border-dashed border-emerald-100 bg-emerald-50/30 p-3 text-center text-sm text-emerald-700 lg:min-h-[180px]">
                    Tidak ada pemasukan pada tanggal ini.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {incomeTransactions.slice(0, 5).map((transaction) => (
                      <div
                        key={transaction.id}
                        className="rounded-2xl border border-emerald-100 bg-white p-2.5 transition hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-400">{formatDate(transaction.date)}</span>
                            </div>
                            <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">{transaction.description}</p>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {(() => {
                                const category = categories.find((item) => item.id === transaction.categoryId);
                                return (
                                  <span className={`inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-xs font-semibold text-slate-700 ${category?.color || "bg-slate-100"}`}>
                                    {category?.icon ?? "🏷️"} {category?.name ?? "Lainnya"}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold text-emerald-600">+{formatCurrency(transaction.amount)}</p>
                            <div className="mt-1 flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleEdit(transaction)}
                                className="rounded-xl border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:text-sky-600"
                                aria-label={`Edit ${transaction.description}`}
                              >
                                <PencilLine size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(transaction.id)}
                                className="rounded-xl border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:text-rose-600"
                                aria-label={`Hapus ${transaction.description}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
          </div>

          <div className="flex min-h-0 min-w-0 flex-col rounded-[20px] border border-slate-200/70 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.06)] lg:min-h-[520px]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-rose-700">Daftar Pengeluaran</p>
                  <p className="text-lg font-semibold text-rose-800">{formatCurrency(expenseTransactions.reduce((s, t) => s + t.amount, 0))}</p>
                  <p className="text-xs text-rose-700">{expenseTransactions.length} transaksi</p>
                </div>
                <div className="rounded-2xl bg-rose-100 p-1.5 text-rose-600">
                  <TrendingDown size={16} />
                </div>
              </div>
              <div className="mt-3 min-h-0 flex-1 pr-0 lg:overflow-y-auto lg:pr-1">
                {expenseTransactions.length === 0 ? (
                  <div className="flex min-h-[120px] items-center justify-center rounded-2xl border border-dashed border-rose-100 bg-rose-50/30 p-3 text-center text-sm text-rose-700 lg:min-h-[180px]">
                    Tidak ada pengeluaran pada tanggal ini.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {expenseTransactions.slice(0, 5).map((transaction) => (
                      <div
                        key={transaction.id}
                        className="rounded-2xl border border-rose-100 bg-white p-2.5 transition hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-400">{formatDate(transaction.date)}</span>
                            </div>
                            <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">{transaction.description}</p>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {(() => {
                                const category = categories.find((item) => item.id === transaction.categoryId);
                                return (
                                  <span className={`inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-xs font-semibold text-slate-700 ${category?.color || "bg-slate-100"}`}>
                                    {category?.icon ?? "🏷️"} {category?.name ?? "Lainnya"}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold text-rose-600">-{formatCurrency(transaction.amount)}</p>
                            <div className="mt-1 flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleEdit(transaction)}
                                className="rounded-xl border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:text-sky-600"
                                aria-label={`Edit ${transaction.description}`}
                              >
                                <PencilLine size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(transaction.id)}
                                className="rounded-xl border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:text-rose-600"
                                aria-label={`Hapus ${transaction.description}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
          </div>
        </section>

        <section className="rounded-[20px] border border-slate-200/70 bg-white/90 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Laporan</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900 sm:text-2xl">Laporan Keuangan</h2>
              <p className="mt-1 text-sm text-slate-600">
                Ringkasan bulanan dari transaksi yang sudah tercatat di dashboard.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(130px,_1fr)_minmax(110px,_1fr)_auto] lg:min-w-[460px]">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-700">Bulan</span>
                <select
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-sky-500 focus:bg-white"
                  value={reportMonthDraft}
                  onChange={(event) => setReportMonthDraft(Number(event.target.value))}
                >
                  {MONTH_OPTIONS.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-700">Tahun</span>
                <select
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-sky-500 focus:bg-white"
                  value={reportYearDraft}
                  onChange={(event) => setReportYearDraft(Number(event.target.value))}
                >
                  {reportYearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={applyReportFilter}
                className="h-12 self-end rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Terapkan
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-[20px] border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-sm font-medium text-emerald-700">Total Pemasukan</p>
              <p className="mt-2 text-xl font-semibold text-emerald-800">{formatCurrency(reportSummary.income)}</p>
            </div>
            <div className="rounded-[20px] border border-rose-100 bg-rose-50 p-4">
              <p className="text-sm font-medium text-rose-700">Total Pengeluaran</p>
              <p className="mt-2 text-xl font-semibold text-rose-800">{formatCurrency(reportSummary.expense)}</p>
            </div>
            <div className="rounded-[20px] border border-sky-100 bg-sky-50 p-4">
              <p className="text-sm font-medium text-sky-700">Sisa Saldo</p>
              <p className="mt-2 text-xl font-semibold text-sky-800">{formatCurrency(reportSummary.balance)}</p>
            </div>
            <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-700">Jumlah Transaksi</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">{reportTransactions.length}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="min-w-0 rounded-[20px] border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Grafik Bulanan</p>
                  <p className="text-xs text-slate-500">
                    {selectedReportMonthLabel} {reportYear}
                  </p>
                </div>
              </div>
              <div className="h-[220px] sm:h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                      tickFormatter={(value: number) => `${Math.round(value / 1000)}rb`}
                    />
                    <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                    <Bar dataKey="total" fill="#0f172a" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="min-w-0 rounded-[20px] border border-slate-200 bg-white p-4">
              <div className="mb-3">
                <p className="text-sm font-semibold text-slate-900">Breakdown Kategori</p>
                <p className="text-xs text-slate-500">Diurutkan dari nominal terbesar.</p>
              </div>
              {categoryBreakdown.length === 0 ? (
                <div className="flex min-h-[210px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
                  Belum ada transaksi pada periode ini.
                </div>
              ) : (
                <div className="space-y-2">
                  {categoryBreakdown.map((item) => (
                    <div key={`${item.type}-${item.category?.id ?? item.category?.name ?? "lainnya"}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {item.category?.icon ? `${item.category.icon} ` : ""}
                            {item.category?.name ?? "Lainnya"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {item.type === "income" ? "Pemasukan" : "Pengeluaran"} - {item.count} transaksi
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold text-slate-900">{formatCurrency(item.total)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="min-w-0 rounded-[20px] border border-slate-200 bg-white p-4">
              <div className="mb-3">
                <p className="text-sm font-semibold text-slate-900">Ringkasan Wallet</p>
                <p className="text-xs text-slate-500">Saldo terkini masing-masing wallet.</p>
              </div>
              {wallets.length === 0 ? (
                <div className="flex min-h-[120px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500 lg:min-h-[180px]">
                  Belum ada wallet.
                </div>
              ) : (
                <div className="space-y-2">
                  {wallets.map((wallet) => (
                    <div key={wallet.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {wallet.icon ? `${wallet.icon} ` : ""}
                          {wallet.name}
                        </p>
                        <p className="text-xs text-slate-500">Saldo wallet</p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-slate-900">{formatCurrency(wallet.saldo_saat_ini)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="min-w-0 rounded-[20px] border border-slate-200 bg-white p-4">
              <div className="mb-3">
                <p className="text-sm font-semibold text-slate-900">Riwayat Bulanan</p>
                <p className="text-xs text-slate-500">
                  Transaksi {selectedReportMonthLabel} {reportYear} sesuai filter laporan.
                </p>
              </div>
              <div className="overflow-hidden">
                <table className="w-full table-fixed text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <th className="w-[30%] py-2 pr-2 font-semibold sm:w-auto sm:pr-3">Tanggal</th>
                      <th className="py-2 pr-2 font-semibold sm:pr-3">Deskripsi</th>
                      <th className="hidden py-2 pr-3 font-semibold sm:table-cell">Kategori</th>
                      <th className="hidden py-2 pr-3 font-semibold sm:table-cell">Jenis</th>
                      <th className="py-2 text-right font-semibold">Nominal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500">
                          Tidak ada transaksi pada periode ini.
                        </td>
                      </tr>
                    ) : (
                      reportTransactions.map((transaction) => {
                        const category = categories.find((item) => item.id === transaction.categoryId);

                        return (
                          <tr key={transaction.id} className="border-b border-slate-100 last:border-0">
                            <td className="py-3 pr-2 text-slate-600 sm:pr-3">{formatDate(transaction.date)}</td>
                            <td className="truncate py-3 pr-2 font-medium text-slate-900 sm:pr-3">{transaction.description}</td>
                            <td className="hidden py-3 pr-3 text-slate-600 sm:table-cell">{category?.name ?? "Lainnya"}</td>
                            <td className="hidden py-3 pr-3 text-slate-600 sm:table-cell">
                              {transaction.type === "income" ? "Pemasukan" : "Pengeluaran"}
                            </td>
                            <td className={`py-3 text-right font-semibold ${transaction.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                              {transaction.type === "income" ? "+" : "-"}
                              {formatCurrency(transaction.amount)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {bottomSheetOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 px-4 pb-6 backdrop-blur-sm">
            <div className="w-full max-w-xl rounded-t-[28px] bg-white p-6 shadow-2xl transition-transform duration-300">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Tambah item</p>
                  <p className="text-sm text-slate-500">Pilih aksi untuk mulai.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setBottomSheetOpen(false)}
                  className="rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-200"
                >
                  Tutup
                </button>
              </div>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={openAddTransaction}
                  className="w-full rounded-2xl bg-slate-900 px-4 py-4 text-left text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  💸 Tambah Transaksi
                </button>
                <button
                  type="button"
                  onClick={openAddWallet}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                >
                  💳 Tambah Wallet
                </button>
              </div>
            </div>
          </div>
        )}

        {modalMode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
            <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-[28px] bg-white p-6 shadow-2xl transition-all duration-300">
              <div className="mb-6 flex shrink-0 items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-500">
                    {modalMode === "wallet"
                      ? editingWalletId
                        ? "Edit Wallet"
                        : "Tambah Wallet"
                      : modalMode === "category"
                      ? editingCategoryId
                        ? "Edit Kategori"
                        : "Tambah Kategori"
                      : editingId
                      ? "Edit Transaksi"
                      : "Tambah Transaksi"}
                  </p>
                  <h2 className="text-2xl font-semibold text-slate-900">
                    {modalMode === "wallet"
                      ? "Kelola wallet baru"
                      : modalMode === "category"
                      ? "Kelola kategori"
                      : "Catat transaksi baru"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-200"
                >
                  Tutup
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {modalMode === "wallet" ? (
                  <form onSubmit={saveWallet} className="space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Nama Wallet</span>
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-500 focus:bg-white"
                      value={walletForm.name}
                      onChange={(event) => setWalletForm((current) => ({ ...current, name: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Icon (emoji)</span>
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-500 focus:bg-white"
                      value={walletForm.icon}
                      onChange={(event) => setWalletForm((current) => ({ ...current, icon: event.target.value }))}
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Warna</span>
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-500 focus:bg-white"
                        value={walletForm.color}
                        onChange={(event) => setWalletForm((current) => ({ ...current, color: event.target.value }))}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Saldo awal</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-500 focus:bg-white"
                        value={walletForm.saldo_awal}
                        onChange={(event) => setWalletForm((current) => ({ ...current, saldo_awal: event.target.value }))}
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-3 pt-2">
                    <button
                      type="submit"
                      className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                    >
                      Simpan Wallet
                    </button>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Batal
                    </button>
                  </div>
                  </form>
                ) : modalMode === "category" ? (
                  <>
                    <form onSubmit={saveCategory} className="space-y-4">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Nama Kategori</span>
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-500 focus:bg-white"
                        value={categoryForm.name}
                        onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))}
                        required
                      />
                    </label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">Jenis</span>
                        <select
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-500 focus:bg-white"
                          value={categoryForm.type}
                          onChange={(event) => setCategoryForm((current) => ({ ...current, type: event.target.value as CategoryType }))}
                          disabled={Boolean(editingCategoryId)}
                        >
                          <option value="income">Pemasukan</option>
                          <option value="expense">Pengeluaran</option>
                        </select>
                      </label>
                      <div className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">Icon</span>
                        <div className="flex flex-wrap gap-2">
                          {CATEGORY_ICON_OPTIONS.map((iconOption) => {
                            const isSelected = categoryForm.icon === iconOption;

                            return (
                              <button
                                key={iconOption}
                                type="button"
                                onClick={() => setCategoryForm((current) => ({ ...current, icon: iconOption }))}
                                className={`flex h-11 w-11 items-center justify-center rounded-2xl border bg-slate-50 text-xl transition hover:bg-white ${
                                  isSelected ? "border-slate-900 shadow-sm" : "border-slate-200"
                                }`}
                                aria-label={`Pilih icon ${iconOption}`}
                              >
                                {iconOption}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Warna</span>
                      <div className="flex flex-wrap gap-3">
                        {CATEGORY_COLOR_OPTIONS.map((colorOption) => {
                          const isSelected = categoryForm.color === colorOption.value;

                          return (
                            <button
                              key={colorOption.value}
                              type="button"
                              onClick={() => setCategoryForm((current) => ({ ...current, color: colorOption.value }))}
                              className={`h-10 w-10 rounded-full border border-slate-200 ${colorOption.value} ${
                                isSelected ? "outline-2 outline-offset-2 outline-slate-900" : "outline-0"
                              }`}
                              aria-label={`Pilih warna ${colorOption.label}`}
                              title={colorOption.label}
                            />
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 pt-2">
                      <button
                        type="submit"
                        className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                      >
                        {editingCategoryId ? "Simpan kategori" : "Tambah kategori"}
                      </button>
                      <button
                        type="button"
                        onClick={closeModal}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Batal
                      </button>
                    </div>
                    </form>

                    <div className="mt-8 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">Kategori yang sudah ada</p>
                        <p className="text-sm text-slate-500">Edit atau hapus kategori yang sudah tidak dibutuhkan.</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {categories.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-center text-slate-500">
                          Belum ada kategori.
                        </div>
                      ) : (
                        categories.map((category) => (
                          <div key={category.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="flex items-center gap-3">
                              <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl text-lg ${category.color}`}>
                                {category.icon}
                              </span>
                              <div>
                                <p className="font-semibold text-slate-900">{category.name}</p>
                                <p className="text-sm text-slate-500">{category.type === "income" ? "Pemasukan" : "Pengeluaran"}</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => openEditCategory(category)}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteCategory(category.id)}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-rose-50 hover:text-rose-600"
                              >
                                Hapus
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  </>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Deskripsi</span>
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-500 focus:bg-white"
                      placeholder="Contoh: Gaji bulanan"
                      value={form.description}
                      onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                      required
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Jumlah</span>
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-500 focus:bg-white"
                        placeholder="0"
                        value={form.amount}
                        onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                        required
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Jenis</span>
                      <select
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-500 focus:bg-white"
                        value={form.type}
                        onChange={(event) =>
                          setForm((current) => {
                            const nextType = event.target.value as TransactionType;
                            const validCategoryId = categories.some(
                              (category) => category.id === current.categoryId && category.type === nextType
                            )
                              ? current.categoryId
                              : getFallbackCategoryId(nextType, categories);

                            return {
                              ...current,
                              type: nextType,
                              categoryId: validCategoryId,
                            };
                          })
                        }
                      >
                        <option value="income">Pemasukan</option>
                        <option value="expense">Pengeluaran</option>
                      </select>
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Kategori</span>
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-500 focus:bg-white"
                      value={form.categoryId ?? ""}
                      onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value || null }))}
                      required
                    >
                      <option value="">Pilih kategori</option>
                      {categories.filter((category) => category.type === form.type).map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.icon} {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Wallet</span>
                      <select
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-500 focus:bg-white"
                        value={form.walletId ?? ""}
                        onChange={(event) => setForm((current) => ({ ...current, walletId: event.target.value || null }))}
                      >
                        <option value="">Tidak ada</option>
                        {wallets.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Tanggal</span>
                      <input
                        type="date"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-500 focus:bg-white"
                        value={form.date}
                        onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                        required
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-3 pt-2">
                    <button
                      type="submit"
                      className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                    >
                      {editingId ? "Simpan perubahan" : "Tambah transaksi"}
                    </button>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Batal
                    </button>
                  </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setBottomSheetOpen(true)}
          className="fixed bottom-4 right-4 z-40 inline-flex h-[60px] w-[60px] items-center justify-center rounded-full bg-slate-900 text-white shadow-2xl transition-transform duration-200 hover:scale-105"
          aria-label="Tambah"
        >
          <PlusCircle size={28} />
        </button>
      </div>
    </div>
  );
}
