"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, ArrowRightLeft, ReceiptText, WalletCards } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionList } from "@/components/dashboard/transaction-list";
import { formatCurrency, formatTimestamp } from "@/lib/formatters";
import { useBankStore } from "@/lib/bank-store";

export function HomeDashboard() {
  const user = useBankStore((state) => state.user);
  const accounts = useBankStore((state) => state.accounts);
  const allTransactions = useBankStore((state) => state.transactions);
  const isLoading = useBankStore((state) => state.isLoading);
  const transactions = useMemo(() => allTransactions.slice(0, 4), [allTransactions]);

  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <Card className="overflow-hidden bg-gradient-to-br from-white via-white to-bank-50/70">
        <CardHeader className="pb-4">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-bank-700">Home</p>
          <CardTitle className="text-3xl">Hello, {user.firstName}</CardTitle>
          <CardDescription className="max-w-2xl text-base">
            Your fictional NorthMaple snapshot keeps the layout bank-like while staying clearly in a
            demo environment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 rounded-2xl border border-bank-100 bg-white/80 p-5 sm:grid-cols-2">
            <div>
              <p className="text-sm text-slate-500">Combined available balance</p>
              <p className="mt-2 text-3xl font-semibold text-ink">{formatCurrency(totalBalance)}</p>
              <p className="mt-2 text-sm text-slate-500">
                {isLoading ? "Refreshing MongoDB demo data..." : `Last refresh ${formatTimestamp(accounts[0]?.lastUpdated ?? new Date().toISOString())}`}
              </p>
            </div>
            <div className="grid gap-3 sm:justify-end">
              <Button asChild size="lg">
                <Link
                  href="/transfer"
                  data-telemetry-id="quick-transfer"
                  data-telemetry-role="primary-cta"
                  data-telemetry-area="hero-actions"
                >
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  Transfer Money
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/transfer" data-telemetry-id="quick-pay-bill" data-telemetry-area="hero-actions">
                  <ReceiptText className="mr-2 h-4 w-4" />
                  Pay Bill
                </Link>
              </Button>
            </div>
          </div>

          <p className="text-sm text-slate-500">
            Bill pay is intentionally simplified and represented through the same transfer sandbox to
            keep the prototype compact.
          </p>
        </CardContent>
      </Card>

      <Card data-telemetry-area="account-summary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WalletCards className="h-5 w-5 text-bank-700" />
            Account summary
          </CardTitle>
          <CardDescription>Two synthetic accounts for a clean, believable banking snapshot.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {accounts.map((account) => (
            <Link
              key={account.id}
              href="/accounts"
              className="block rounded-xl border border-border bg-surface px-4 py-4 transition-colors hover:border-bank-200 hover:bg-bank-50/70"
              data-telemetry-id={`account-card-${account.id}`}
              data-telemetry-event="account_card_click"
              data-telemetry-area="account-summary"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-ink">{account.name}</p>
                  <p className="text-sm text-slate-500">{account.maskedNumber}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-4 text-xl font-semibold text-ink">{formatCurrency(account.balance)}</p>
              <p className="mt-1 text-xs text-slate-500">Updated {formatTimestamp(account.lastUpdated)}</p>
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Preview of the most recent synthetic transactions.</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/activity" data-telemetry-id="home-view-activity">
              View all activity
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <TransactionList transactions={transactions} compact />
        </CardContent>
      </Card>
    </div>
  );
}
