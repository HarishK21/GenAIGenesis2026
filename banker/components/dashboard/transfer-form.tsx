"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Radar, Shield, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/formatters";
import { useBankStore } from "@/lib/bank-store";
import { useTelemetry } from "@/lib/telemetry";

interface TransferFormProps {
  intent?: string;
}

interface FormState {
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  note: string;
}

export function TransferForm({ intent }: TransferFormProps) {
  const accounts = useBankStore((state) => state.accounts);
  const submitTransfer = useBankStore((state) => state.submitTransfer);
  const isSubmittingTransfer = useBankStore((state) => state.isSubmittingTransfer);
  const bankError = useBankStore((state) => state.error);
  const { isTelemetryEnabled, markReviewTransfer, markSubmitTransfer, recordHesitation, sessionId } =
    useTelemetry();

  const [form, setForm] = useState<FormState>({
    fromAccountId: "chequing",
    toAccountId: "savings",
    amount: "",
    note: intent === "bill" ? "Bill payment" : ""
  });
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const hesitationTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (hesitationTimerRef.current) {
        window.clearTimeout(hesitationTimerRef.current);
      }
    };
  }, []);

  const amountValue = Number(form.amount);
  const fromAccount = accounts.find((account) => account.id === form.fromAccountId);
  const toAccount = accounts.find((account) => account.id === form.toAccountId);
  const hasValidAmount = Number.isFinite(amountValue) && amountValue > 0;
  const hasSufficientFunds = fromAccount ? amountValue <= fromAccount.balance : false;
  const canSubmit = Boolean(
    fromAccount &&
      toAccount &&
      form.fromAccountId !== form.toAccountId &&
      hasValidAmount &&
      hasSufficientFunds
  );

  const reviewRows = useMemo(
    () => [
      { label: "From account", value: fromAccount?.name ?? "--" },
      { label: "To account", value: toAccount?.name ?? "--" },
      { label: "Amount", value: Number.isFinite(amountValue) && amountValue > 0 ? formatCurrency(amountValue) : "--" },
      { label: "Note summary", value: form.note ? `${form.note.length} characters` : "No note added" }
    ],
    [amountValue, form.note, fromAccount?.name, toAccount?.name]
  );

  function scheduleHesitation(reason: string) {
    if (!isTelemetryEnabled) {
      return;
    }

    if (hesitationTimerRef.current) {
      window.clearTimeout(hesitationTimerRef.current);
    }

    hesitationTimerRef.current = window.setTimeout(() => {
      recordHesitation(reason);
    }, 1600);
  }

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setSuccessMessage(null);
    setForm((current) => ({ ...current, [field]: value }));
    scheduleHesitation(`pause_after_${field}`);
  }

  function validateForm() {
    if (!canSubmit) {
      if (form.fromAccountId === form.toAccountId) {
        setError("Choose two different accounts for the transfer.");
      } else if (!Number.isFinite(amountValue) || amountValue <= 0) {
        setError("Enter a transfer amount greater than zero.");
      } else {
        setError("The amount must stay within the available balance of the selected account.");
      }
      return false;
    }

    setError(null);
    return true;
  }

  function handleReview() {
    if (!validateForm()) {
      return;
    }

    markReviewTransfer({
      transferAmount: amountValue,
      noteLength: form.note.length,
      fromAccountId: form.fromAccountId,
      toAccountId: form.toAccountId
    });
    setIsReviewOpen(true);
  }

  async function completeTransfer() {
    if (!validateForm()) {
      return;
    }

    try {
      const snapshot = await submitTransfer({
        fromAccountId: form.fromAccountId as "chequing" | "savings",
        toAccountId: form.toAccountId as "chequing" | "savings",
        amount: amountValue,
        note: form.note
      });

      const summary = markSubmitTransfer(amountValue, {
        fromAccountId: form.fromAccountId,
        toAccountId: form.toAccountId,
        noteLength: form.note.length
      });

      setIsReviewOpen(false);
      setSuccessMessage(
        summary
          ? `Transfer complete. ${formatCurrency(
              amountValue
            )} moved successfully and session ${summary.sessionId} was monitored for security.`
          : `Transfer complete. ${formatCurrency(
              amountValue
            )} moved successfully.`
      );

      const nextFrom = snapshot.accounts.find((account) => account.id === form.fromAccountId)?.id ?? "chequing";
      const nextTo =
        snapshot.accounts.find((account) => account.id !== nextFrom)?.id ?? (nextFrom === "chequing" ? "savings" : "chequing");

      setForm({
        fromAccountId: nextFrom,
        toAccountId: nextTo,
        amount: "",
        note: ""
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "The transfer could not be stored in MongoDB.");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await completeTransfer();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
      <Card className="glass-card" data-telemetry-area="transfer-form">
        <CardHeader>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-bank-700">Transfer</p>
          <CardTitle className="text-3xl">Move money between accounts</CardTitle>
          <CardDescription>
            Securely transfer funds between your accounts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-5 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-ink">From account</span>
                <select
                  value={form.fromAccountId}
                  onChange={(event) => updateField("fromAccountId", event.target.value)}
                  className="flex h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-ink shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bank-300"
                  data-telemetry-id="transfer-from-account"
                  data-telemetry-field="fromAccount"
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-ink">To account</span>
                <select
                  value={form.toAccountId}
                  onChange={(event) => updateField("toAccountId", event.target.value)}
                  className="flex h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-ink shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bank-300"
                  data-telemetry-id="transfer-to-account"
                  data-telemetry-field="toAccount"
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">Amount</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={form.amount}
                onChange={(event) => updateField("amount", event.target.value)}
                data-telemetry-id="transfer-amount"
                data-telemetry-field="amount"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">Optional note</span>
              <Textarea
                placeholder="Internal transfer note"
                value={form.note}
                onChange={(event) => updateField("note", event.target.value)}
                data-telemetry-id="transfer-note"
                data-telemetry-field="note"
              />
            </label>

            {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
            {!error && bankError ? <p className="text-sm font-medium text-rose-600">{bankError}</p> : null}
            {successMessage ? <p className="text-sm font-medium text-bank-700">{successMessage}</p> : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={handleReview}
                data-telemetry-id="transfer-review"
              >
                Review Transfer
              </Button>
              <Button
                type="submit"
                data-telemetry-id="transfer-submit"
                data-telemetry-role="primary-cta"
                data-telemetry-area="submit-zone"
                disabled={isSubmittingTransfer}
              >
                {isSubmittingTransfer ? "Saving..." : "Submit Transfer"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-bank-700" />
              Security monitoring signals
            </CardTitle>
            <CardDescription>
              Signals are monitored to ensure your account remains secure.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-600">
            <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
              <Radar className="mt-0.5 h-4 w-4 text-bank-700" />
              <p>Dwell time, first-click delay, rapid navigation, and click sequences between key UI areas.</p>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
              <Sparkles className="mt-0.5 h-4 w-4 text-bank-700" />
              <p>Typing-speed summaries, backspace counts, field focus changes, and hesitation counts.</p>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-bank-700" />
              <p>Transfer amount, unusual location risk, and review-to-submit delay for fraud prevention.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Security notes</CardTitle>
            <CardDescription>Your account is protected with advanced security measures.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>All interactions are securely monitored to protect your account.</p>
            <p>Telemetry is opt-in via the monitoring banner and can be disabled at any time.</p>
            <p>The current telemetry session ID is <span className="font-medium text-ink">{sessionId}</span>.</p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review transfer</DialogTitle>
            <DialogDescription>
              Confirm the details below before sending the transfer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
            {reviewRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4 text-sm">
                <span className="text-slate-500">{row.label}</span>
                <span className="font-medium text-ink">{row.value}</span>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsReviewOpen(false)}>
              Back
            </Button>
            <Button
              type="button"
              onClick={() => void completeTransfer()}
              disabled={isSubmittingTransfer}
            >
              {isSubmittingTransfer ? "Saving..." : "Submit Transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
