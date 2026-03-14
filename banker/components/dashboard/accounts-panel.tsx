"use client";

import { RefreshCw, Wallet } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatTimestamp } from "@/lib/formatters";
import { useBankStore } from "@/lib/bank-store";

export function AccountsPanel() {
  const accounts = useBankStore((state) => state.accounts);
  const isLoading = useBankStore((state) => state.isLoading);

  return (
    <section className="space-y-6">
      <div className="glass-card rounded-2xl p-6 border-bank-200/50">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-bank-700">Accounts</p>
        <h2 className="mt-2 text-3xl font-semibold text-ink">Available balances</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Each card securely displays your account name, masked number, available balance, and
          the last update timestamp.
        </p>
        {isLoading ? <p className="mt-2 text-sm text-bank-700">Loading balances...</p> : null}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {accounts.map((account) => (
          <Card
            className="glass-card transition-all duration-300 hover:-translate-y-1 hover:shadow-xl group"
            key={account.id}
            data-telemetry-id={`account-card-${account.id}`}
            data-telemetry-event="account_card_click"
            data-telemetry-area="account-card"
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="rounded-full bg-bank-100/50 p-2.5 text-bank-700 transition-colors group-hover:bg-bank-100">
                  <Wallet className="h-5 w-5" />
                </div>
                <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {account.id}
                </span>
              </div>
              <CardTitle className="mt-4">{account.name}</CardTitle>
              <CardDescription>{account.maskedNumber}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-sm text-slate-500">Available balance</p>
                <p className="mt-2 text-3xl font-semibold text-ink">{formatCurrency(account.balance)}</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <RefreshCw className="h-4 w-4" />
                Last updated {formatTimestamp(account.lastUpdated)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
