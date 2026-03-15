"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, ArrowRightLeft, ReceiptText, WalletCards } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConsentBanner } from "@/components/consent-banner";
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
    <div className="flex flex-col gap-6">
      <ConsentBanner />

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr] animate-fade-in-up">
        <Card className="glass-card overflow-hidden">
        <CardHeader className="pb-4">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-bank-700">Home</p>
          <CardTitle className="text-3xl">Hello, {user.firstName}</CardTitle>
          <CardDescription className="max-w-2xl text-base">
            Your NorthMaple Bank dashboard provides a clear, secure overview of your finances.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 animate-fade-in-up delay-75">
          <div className="grid gap-4 rounded-2xl border border-white/20 bg-white/40 backdrop-blur-md p-5 sm:grid-cols-2 shadow-sm">
            <div>
              <p className="text-sm text-slate-500">Combined available balance</p>
              <p className="mt-2 text-3xl font-semibold text-ink">{formatCurrency(totalBalance)}</p>
              <p className="mt-2 text-sm text-slate-500">
                {isLoading ? "Refreshing data..." : `Last refresh ${formatTimestamp(accounts[0]?.lastUpdated ?? new Date().toISOString())}`}
              </p>
            </div>
            <div className="grid gap-3 sm:justify-end">
              <Button asChild size="lg" className="transition-all duration-300 hover:-translate-y-1 shadow-md hover:shadow-xl bg-gradient-to-r from-bank-600 to-bank-500">
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
              <Button asChild variant="outline" size="lg" className="transition-all duration-300 hover:-translate-y-1 hover:shadow-md bg-bank-50 border-bank-200 text-bank-800 hover:bg-bank-100">
                <Link href="/transfer" data-telemetry-id="quick-pay-bill" data-telemetry-area="hero-actions">
                  <ReceiptText className="mr-2 h-4 w-4" />
                  Pay Bill
                </Link>
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="transition-all duration-300 hover:-translate-y-1 hover:shadow-md bg-bank-50 border-bank-200 text-bank-800 hover:bg-bank-100 sm:col-span-2"
                data-telemetry-id="quick-deposit" 
                data-telemetry-area="hero-actions"
                onClick={async () => {
                  if (accounts.length > 0) {
                    await useBankStore.getState().depositFunds(accounts[0].id, 1000);
                  }
                }}
                disabled={isLoading}
              >
                <WalletCards className="mr-2 h-4 w-4" />
                Quick Deposit ($1k)
              </Button>
            </div>
          </div>

          <p className="text-sm text-slate-500">
            Bill pay is integrated securely to streamline your everyday transactions.
          </p>
        </CardContent>
      </Card>

      <Card className="glass-card animate-fade-in-up delay-150" data-telemetry-area="account-summary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WalletCards className="h-5 w-5 text-bank-700" />
            Account summary
          </CardTitle>
          <CardDescription>Your active accounts and available balances.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {accounts.map((account) => (
            <Link
              key={account.id}
              href="/accounts"
              className="block rounded-xl border border-white/30 bg-white/40 px-4 py-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:bg-white/60 hover:border-white/50"
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

      <Card className="glass-card xl:col-span-2 animate-fade-in-up delay-300">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Your most recent transactions across all accounts.</CardDescription>
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
    </div>
  );
}
