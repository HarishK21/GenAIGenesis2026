"use client";

import { useMemo, useState } from "react";

import { TransactionList } from "@/components/dashboard/transaction-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useBankStore } from "@/lib/bank-store";
import { TransactionType } from "@/lib/types";

type Filter = "all" | TransactionType;

const filterOptions: { label: string; value: Filter }[] = [
  { label: "All", value: "all" },
  { label: "Deposits", value: "deposit" },
  { label: "Withdrawals", value: "withdrawal" },
  { label: "Transfers", value: "transfer" }
];

export function ActivityPanel() {
  const transactions = useBankStore((state) => state.transactions);
  const isLoading = useBankStore((state) => state.isLoading);
  const [filter, setFilter] = useState<Filter>("all");

  const filteredTransactions = useMemo(() => {
    if (filter === "all") {
      return transactions;
    }

    return transactions.filter((transaction) => transaction.type === filter);
  }, [filter, transactions]);

  return (
    <section className="space-y-6">
      <div className="glass-card rounded-2xl p-6 border-bank-200/50">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-bank-700">Activity</p>
        <h2 className="mt-2 text-3xl font-semibold text-ink">Recent transaction history</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Filter your transaction history to securely track deposits, withdrawals, and transfers.
        </p>
        {isLoading ? <p className="mt-2 text-sm text-bank-700">Loading stored transactions...</p> : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter activity</CardTitle>
          <CardDescription>Switch views to easily track your account activity.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {filterOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={filter === option.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(option.value)}
              data-telemetry-id={`activity-filter-${option.value}`}
              data-telemetry-area="activity-filter"
            >
              {option.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <CardDescription>{filteredTransactions.length} items in the current view.</CardDescription>
        </CardHeader>
        <CardContent>
          <TransactionList transactions={filteredTransactions} showAccount />
        </CardContent>
      </Card>
    </section>
  );
}
