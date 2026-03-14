"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useTelemetry } from "@/lib/telemetry";

export function ConsentBanner() {
  const { consentStatus, isTelemetryEnabled, setConsentStatus } = useTelemetry();
  const [draftConsent, setDraftConsent] = useState(true);

  if (consentStatus === "declined") {
    return null;
  }

  if (consentStatus === "accepted") {
    return (
      <Card className="border-bank-100 bg-bank-50/70">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-white p-2 text-bank-700">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Fraud protection monitoring is enabled</p>
              <p className="text-sm text-slate-600">
                Only synthetic interaction summaries are shared with the demo fraud dashboard.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConsentStatus("declined")}
            data-telemetry-id="monitoring-disable"
          >
            Disable
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-bank-200">
      <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-ink">Consent for Fraud Protection Monitoring</p>
          <p className="max-w-3xl text-sm text-slate-600">
            This hackathon demo can share safe behavioral summaries like click timing, dwell time,
            and unusual transfer flags with a separate fraud-analysis dashboard. No passwords or raw
            free-text content are collected.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink">
            <Switch checked={draftConsent} onCheckedChange={setDraftConsent} />
            <span>{draftConsent ? "Monitoring on" : "Monitoring off"}</span>
          </label>
          <Button
            onClick={() => setConsentStatus(draftConsent ? "accepted" : "declined")}
            data-telemetry-id="monitoring-save"
          >
            Save preference
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
