"use client";

import { ConsentBanner } from "@/components/consent-banner";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/layout/site-header";
import { Sidebar } from "@/components/layout/sidebar";
import { useBankStore } from "@/lib/bank-store";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const error = useBankStore((state) => state.error);

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col lg:flex-row">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <SiteHeader />
          <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
            <div className="mx-auto flex max-w-6xl flex-col gap-6">
              <section className="rounded-2xl border border-bank-100 bg-gradient-to-br from-bank-50 via-white to-white p-5 shadow-card">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-bank-700">
                      NorthMaple Sandbox
                    </p>
                    <h1 className="mt-2 text-2xl font-semibold text-ink">
                      Fictional online banking experience for fraud-monitoring demos
                    </h1>
                    <p className="mt-2 max-w-3xl text-sm text-slate-600">
                      This interface uses synthetic balances, synthetic transactions, and lightweight
                      telemetry to illustrate how a bank-like front end might feed a separate fraud
                      analysis dashboard.
                    </p>
                  </div>
                  <Badge className="self-start md:self-center">Demo Environment - Synthetic Data</Badge>
                </div>
              </section>

              <ConsentBanner />
              {error ? (
                <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                  MongoDB sync warning: {error}
                </section>
              ) : null}
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
