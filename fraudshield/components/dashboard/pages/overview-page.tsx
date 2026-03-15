"use client";

import { Activity, AlertTriangle, BarChart3, ShieldAlert } from "lucide-react";

import { AlertsOverTimeChart } from "@/components/dashboard/alerts-over-time-chart";
import { DataState } from "@/components/dashboard/data-state";
import {
  useDashboardPolling,
  useFraudDashboard
} from "@/components/dashboard/dashboard-data-provider";
import { PageHeader } from "@/components/dashboard/page-header";
import { RecentAlertsList } from "@/components/dashboard/recent-alerts-list";
import { RiskDistributionChart } from "@/components/dashboard/risk-distribution-chart";
import { SessionFilters } from "@/components/dashboard/session-filters";
import { SessionTable } from "@/components/dashboard/session-table";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  getOverviewMetricCards,
  getOverviewMetrics
} from "@/lib/fraud/selectors";

const summaryIcons = [Activity, ShieldAlert, AlertTriangle, BarChart3] as const;

export function OverviewPage() {
  const { alerts, loadingState, monitoring, sessions } = useFraudDashboard();

  useDashboardPolling(true);

  if (loadingState === "loading" && sessions.length === 0) {
    return (
      <DataState
        title="Loading fraud telemetry"
        description="Pulling the latest behavioral session summaries and alert signals."
      />
    );
  }

  const metrics = getOverviewMetrics(sessions, alerts);
  const metricCards = getOverviewMetricCards(metrics);
  const modelComparison = monitoring?.comparison ?? null;
  const showAiUpliftPanel = (modelComparison?.aiAssessedSessions ?? 0) > 0;
  const f1DeltaLabel = modelComparison
    ? `${modelComparison.uplift.f1Delta >= 0 ? "+" : ""}${(
        modelComparison.uplift.f1Delta * 100
      ).toFixed(1)} pts`
    : "--";
  const precisionDeltaLabel = modelComparison
    ? `${modelComparison.uplift.precisionDelta >= 0 ? "+" : ""}${(
        modelComparison.uplift.precisionDelta * 100
      ).toFixed(1)} pts`
    : "--";
  const falsePositiveDeltaLabel = modelComparison
    ? `${modelComparison.uplift.falsePositiveRateDelta >= 0 ? "+" : ""}${(
        modelComparison.uplift.falsePositiveRateDelta * 100
      ).toFixed(1)} pts`
    : "--";
  const addedLatencyLabel = modelComparison
    ? `${modelComparison.latencyMs.additionalAiCost} ms`
    : "--";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fraud Analyst Dashboard"
        description="Monitor incoming behavioral telemetry from the banking site, spot risky transfer sessions, and move cleanly from alert triage into case escalation."
        actions={
          <>
            <Badge variant="info">Auto-refresh every 5 seconds</Badge>
            <SessionFilters />
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((item, index) => {
          const Icon = summaryIcons[index];

          return (
            <SummaryCard
              key={item.label}
              title={item.label}
              value={item.value}
              subtitle={item.change}
              tone={item.tone}
              icon={Icon}
            />
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <RiskDistributionChart data={metrics.riskDistribution} />
        <AlertsOverTimeChart data={metrics.alertsOverTime} />
      </div>

      {showAiUpliftPanel ? (
        <Card>
          <CardHeader>
            <CardTitle>AI Uplift Validation</CardTitle>
            <CardDescription>
              Side-by-side comparison of alert-tier classification quality for rules-only
              scoring versus rules plus AI co-assessment on the same filtered session set.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
              <p className="text-sm text-slate-400">Evaluated labels</p>
              <p className="mt-2 text-2xl font-semibold text-slate-50">
                {modelComparison?.evaluatedLabeledSessions ?? 0}
              </p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
              <p className="text-sm text-slate-400">F1 uplift</p>
              <p className="mt-2 text-2xl font-semibold text-slate-50">{f1DeltaLabel}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
              <p className="text-sm text-slate-400">Precision uplift</p>
              <p className="mt-2 text-2xl font-semibold text-slate-50">
                {precisionDeltaLabel}
              </p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
              <p className="text-sm text-slate-400">False positive delta</p>
              <p className="mt-2 text-2xl font-semibold text-slate-50">
                {falsePositiveDeltaLabel}
              </p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 md:col-span-2 xl:col-span-2">
              <p className="text-sm text-slate-400">AI-assessed sessions</p>
              <p className="mt-2 text-2xl font-semibold text-slate-50">
                {modelComparison?.aiAssessedSessions ?? 0}
              </p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 md:col-span-2 xl:col-span-2">
              <p className="text-sm text-slate-400">Added AI latency</p>
              <p className="mt-2 text-2xl font-semibold text-slate-50">{addedLatencyLabel}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Recent Sessions</CardTitle>
            <CardDescription>
              Most recent sessions across all risk levels, including normal traffic.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-2 pt-0">
            <SessionTable sessions={metrics.recentFlaggedSessions} compact />
          </CardContent>
        </Card>
        <RecentAlertsList alerts={metrics.recentAlerts} />
      </div>
    </div>
  );
}
