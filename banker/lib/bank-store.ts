"use client";

import { create } from "zustand";

import { demoAccounts, demoTransactions, demoUser } from "@/lib/demo-data";
import { Account, BankSnapshot, DemoUser, TransferRequest, Transaction } from "@/lib/types";

interface BankState {
  user: DemoUser;
  accounts: Account[];
  transactions: Transaction[];
  error: string | null;
  hasLoaded: boolean;
  isLoading: boolean;
  isSubmittingTransfer: boolean;
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  submitTransfer: (payload: TransferRequest) => Promise<BankSnapshot>;
  updateUser: (payload: Partial<DemoUser>) => Promise<BankSnapshot>;
  depositFunds: (accountId: string, amount: number) => Promise<BankSnapshot>;
  resetData: () => Promise<BankSnapshot>;
}

let bootstrapPromise: Promise<void> | null = null;

async function fetchSnapshot() {
  const response = await fetch("/api/bank/state", {
    method: "GET",
    cache: "no-store"
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? "Unable to load demo banking data from MongoDB.");
  }

  return (await response.json()) as BankSnapshot;
}

async function postTransfer(payload: TransferRequest) {
  const response = await fetch("/api/bank/transfer", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "Unable to submit the demo transfer.");
  }

  return (await response.json()) as BankSnapshot;
}

async function postUserProfile(payload: Partial<DemoUser>) {
  const response = await fetch("/api/bank/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "Unable to update the user profile.");
  }

  return (await response.json()) as BankSnapshot;
}

async function postDeposit(accountId: string, amount: number) {
  const response = await fetch("/api/bank/deposit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, amount })
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "Unable to deposit funds.");
  }

  return (await response.json()) as BankSnapshot;
}

async function postResetData() {
  const response = await fetch("/api/bank/reset", {
    method: "POST"
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "Unable to reset the demo data.");
  }

  return (await response.json()) as BankSnapshot;
}

function applySnapshot(set: (partial: Partial<BankState>) => void, snapshot: BankSnapshot) {
  set({
    user: snapshot.user,
    accounts: snapshot.accounts,
    transactions: snapshot.transactions,
    error: null,
    hasLoaded: true,
    isLoading: false
  });
}

export const useBankStore = create<BankState>((set, get) => ({
  user: demoUser,
  accounts: demoAccounts,
  transactions: demoTransactions,
  error: null,
  hasLoaded: false,
  isLoading: false,
  isSubmittingTransfer: false,
  initialize: async () => {
    if (get().hasLoaded) {
      return;
    }

    if (bootstrapPromise) {
      return bootstrapPromise;
    }

    set({ isLoading: true, error: null });

    bootstrapPromise = fetchSnapshot()
      .then((snapshot) => {
        applySnapshot(set, snapshot);
      })
      .catch((error) => {
        set({
          error: error instanceof Error ? error.message : "Unable to load MongoDB data.",
          isLoading: false
        });
      })
      .finally(() => {
        bootstrapPromise = null;
      });

    return bootstrapPromise;
  },
  refresh: async () => {
    set({ isLoading: true, error: null });

    try {
      const snapshot = await fetchSnapshot();
      applySnapshot(set, snapshot);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Unable to refresh MongoDB data.",
        isLoading: false
      });
    }
  },
  submitTransfer: async (payload) => {
    set({ isSubmittingTransfer: true, error: null });

    try {
      const snapshot = await postTransfer(payload);
      applySnapshot(set, snapshot);
      set({ isSubmittingTransfer: false });
      return snapshot;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to store the transfer.";
      set({
        error: message,
        isSubmittingTransfer: false
      });
      throw error;
    }
  },
  updateUser: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const snapshot = await postUserProfile(payload);
      applySnapshot(set, snapshot);
      return snapshot;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update profile.";
      set({ error: message, isLoading: false });
      throw error;
    }
  },
  depositFunds: async (accountId, amount) => {
    set({ isLoading: true, error: null });
    try {
      const snapshot = await postDeposit(accountId, amount);
      applySnapshot(set, snapshot);
      return snapshot;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to deposit funds.";
      set({ error: message, isLoading: false });
      throw error;
    }
  },
  resetData: async () => {
    set({ isLoading: true, error: null });
    try {
      const snapshot = await postResetData();
      applySnapshot(set, snapshot);
      return snapshot;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to reset data.";
      set({ error: message, isLoading: false });
      throw error;
    }
  }
}));
