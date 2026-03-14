"use client";

import { useEffect } from "react";

import { TelemetryProvider } from "@/lib/telemetry";
import { useBankStore } from "@/lib/bank-store";

function BankBootstrap() {
  const initialize = useBankStore((state) => state.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TelemetryProvider>
      <BankBootstrap />
      {children}
    </TelemetryProvider>
  );
}
