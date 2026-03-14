"use client";

import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/layout/site-header";
import { Sidebar } from "@/components/layout/sidebar";
import { useBankStore } from "@/lib/bank-store";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const error = useBankStore((state) => state.error);

  return (
    <div className="min-h-screen">
      <div className="flex min-h-screen w-full flex-col lg:flex-row">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <SiteHeader />
          <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
            <div className="flex w-full flex-col gap-6">
              <section className="glass-card rounded-2xl p-5 animate-fade-in-up border-bank-200/50">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-bank-700">
                      Welcome Back
                    </p>
                    <h1 className="mt-2 text-2xl font-semibold text-ink">
                      Your NorthMaple Banking Overview
                    </h1>
                    <p className="mt-2 max-w-3xl text-sm text-slate-600">
                      Manage your accounts, view your recent activity, and securely transfer funds from your personal banking dashboard.
                    </p>
                  </div>
                </div>
              </section>

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
