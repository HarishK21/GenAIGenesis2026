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
  }
}));
