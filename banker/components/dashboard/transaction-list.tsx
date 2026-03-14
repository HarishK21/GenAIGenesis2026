"use client";

import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency, formatTimestamp } from "@/lib/formatters";
import { Transaction } from "@/lib/types";

interface TransactionListProps {
  transactions: Transaction[];
  compact?: boolean;
  showAccount?: boolean;
}

function getIcon(transaction: Transaction) {
  if (transaction.type === "deposit") {
    return ArrowDownLeft;
  }

  if (transaction.type === "transfer") {
    return ArrowRightLeft;
  }

  return ArrowUpRight;
}

export function TransactionList({
  transactions,
  compact = false,
  showAccount = false
}: TransactionListProps) {
  return (
    <div className="space-y-3" data-telemetry-area="activity-list">
      {transactions.map((transaction) => {
        const Icon = getIcon(transaction);
        const signedAmount =
          transaction.direction === "in"
            ? `+${formatCurrency(transaction.amount)}`
            : `-${formatCurrency(transaction.amount)}`;

        return (
          <div
            key={transaction.id}
            className={cn(
              "flex items-center justify-between gap-4 rounded-xl border border-border bg-white px-4 py-3",
              compact && "py-2.5"
            )}
            data-telemetry-id={`transaction-${transaction.id}`}
            data-telemetry-area="activity-list"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-bank-50 p-2 text-bank-700">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-ink">{transaction.title}</p>
                  <Badge variant="neutral" className="capitalize">
                    {transaction.type}
                  </Badge>
                </div>
                <p className="text-sm text-slate-600">{transaction.subtitle}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatTimestamp(transaction.occurredAt)}
                  {showAccount && transaction.accountId ? ` • ${transaction.accountId}` : ""}
                </p>
              </div>
            </div>

            <div
              className={cn(
                "text-right text-sm font-semibold",
                transaction.direction === "in" ? "text-bank-700" : "text-slate-700"
              )}
            >
              {signedAmount}
            </div>
          </div>
        );
      })}
    </div>
  );
}
