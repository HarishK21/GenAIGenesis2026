"use client";

import { ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useBankStore } from "@/lib/bank-store";

export function SiteHeader() {
  const user = useBankStore((state) => state.user);

  return (
    <header className="border-b border-border/80 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 lg:px-8">
        <div className="space-y-1">
          <p className="font-[family-name:var(--font-display)] text-2xl font-semibold text-ink">
            NorthMaple Bank
          </p>
          <p className="text-sm text-slate-600">Hackathon Demo / Fictional Banking Sandbox</p>
        </div>

        <div className="flex items-center gap-3">
          <Badge className="hidden items-center gap-1 sm:inline-flex">
            <ShieldCheck className="h-3.5 w-3.5" />
            Demo Environment - Synthetic Data
          </Badge>
          <div className="flex items-center gap-3 rounded-full border border-border bg-white px-3 py-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-bank-100 text-sm font-semibold text-bank-700">
              {user.avatarInitials}
            </div>
            <div className="hidden text-sm sm:block">
              <p className="font-semibold text-ink">{user.displayName}</p>
              <p className="text-slate-500">Personal profile</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
