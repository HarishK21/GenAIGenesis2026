"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert
} from "lucide-react";

import {
  useFraudDashboard
} from "@/components/dashboard/dashboard-data-provider";
import { DataState } from "@/components/dashboard/data-state";
import { EventTimeline } from "@/components/dashboard/event-timeline";
import { MetricGrid } from "@/components/dashboard/metric-grid";
import { PageHeader } from "@/components/dashboard/page-header";
import { RiskBadge } from "@/components/dashboard/risk-badge";
import { RiskFactorList } from "@/components/dashboard/risk-factor-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  formatCurrency,
  formatDateTime,
  formatDuration
} from "@/lib/fraud/selectors";

export function SessionDetailPage({ sessionId }: { sessionId: string }) {
  const {
    escalateSessionCase,
    flagSessionForReview,
    getSession,
    loadingState,
    markSessionSafe
  } = useFraudDashboard();
  const session = getSession(sessionId);

  if (loadingState === "loading" && !session) {
    return (
      <DataState
        title="Loading session detail"
        description="Reconstructing the session timeline and behavior metrics."
      />
    );
  }

  if (!session) {
    return (
      <DataState
        title="Session not found"
        description="The requested session could not be loaded from the current telemetry snapshot."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Session ${session.sessionId}`}
        description="Inspect summary telemetry, weighted risk factors, and the transfer review path before making an analyst decision."
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/sessions">
              <ArrowLeft className="h-4 w-4" />
              Back to sessions
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Session Summary</CardTitle>
            <CardDescription>
              Current state, transfer amount, and latest analyst decision.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-col gap-4 rounded-2xl border border-white/8 bg-white/[0.02] p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-slate-400">Current risk score</p>
                <div className="mt-2 flex items-center gap-3">
                  <p className="text-4xl font-semibold text-slate-50">
                    {session.summary.currentRiskScore}
                  </p>
                  <RiskBadge value={session.summary.status} />
                </div>
              </div>
              <div className="text-sm text-slate-400">
                <p>Analyst decision</p>
                <p className="mt-2 text-lg font-semibold text-slate-100">
                  {session.analystDecision}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                <p className="text-sm text-slate-400">Session ID</p>
                <p className="mt-2 text-lg font-semibold text-slate-50">
                  {session.sessionId}
                </p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                <p className="text-sm text-slate-400">Current status</p>
                <div className="mt-2">
                  <RiskBadge value={session.summary.status} />
                </div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                <p className="text-sm text-slate-400">Session duration</p>
                <p className="mt-2 text-lg font-semibold text-slate-50">
                  {formatDuration(session.summary.totalSessionDuration)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                <p className="text-sm text-slate-400">Transfer amount</p>
                <p className="mt-2 text-lg font-semibold text-slate-50">
                  {formatCurrency(session.summary.transferAmount)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                <p className="text-sm text-slate-400">Submitted</p>
                <p className="mt-2 text-lg font-semibold text-slate-50">
                  {session.summary.submitted ? "Yes" : "No"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                <p className="text-sm text-slate-400">Last active time</p>
                <p className="mt-2 text-lg font-semibold text-slate-50">
                  {formatDateTime(session.summary.lastEventTime)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 md:col-span-2 xl:col-span-3">
                <p className="text-sm text-slate-400">Observed geo region</p>
                <p className="mt-2 text-lg font-semibold text-slate-50">
                  {session.geoRegion}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Location anomaly signal:{" "}
                  <span className="font-semibold text-slate-200">
                    {session.summary.unusualLocationFlag ? "Triggered" : "Not triggered"}
                  </span>
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                <p className="text-sm text-slate-400">Account context</p>
                <p className="mt-2 text-lg font-semibold text-slate-50">
                  {session.accountHolder}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {session.accountId} • {session.geoRegion}
                </p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                <p className="text-sm text-slate-400">Device</p>
                <p className="mt-2 text-lg font-semibold text-slate-50">
                  {session.deviceLabel}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {session.summary.topFlags.map((flag) => (
                    <Badge key={flag} variant="neutral">
                      {flag}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Analyst Decision Area</CardTitle>
            <CardDescription>
              Persisted analyst workflow state used for case triage and model feedback.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.06] p-4">
              <p className="text-sm text-cyan-100">Current analyst state</p>
              <p className="mt-2 text-2xl font-semibold text-slate-50">
                {session.analystDecision}
              </p>
            </div>

            <Button
              className="w-full justify-start"
              variant="secondary"
              onClick={() => markSessionSafe(session.sessionId)}
            >
              <ShieldCheck className="h-4 w-4" />
              Mark as Safe
            </Button>
            <Button
              className="w-full justify-start"
              variant="default"
              onClick={() => flagSessionForReview(session.sessionId)}
            >
              <ShieldAlert className="h-4 w-4" />
              Flag for Review
            </Button>
            <Button
              className="w-full justify-start"
              variant="danger"
              onClick={() => escalateSessionCase(session.sessionId)}
            >
              <TriangleAlert className="h-4 w-4" />
              Escalate Case
            </Button>

            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
              <p className="text-sm text-slate-400">Review note</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                High-level telemetry suggests{" "}
                {session.summary.status === "High Risk"
                  ? "a strong need for manual follow-up."
                  : session.summary.status === "Watch"
                    ? "a watch-state session that may need secondary review."
                    : "a relatively low-risk interaction pattern."}
              </p>
              {session.summary.submitted ? (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-100">
                  <CheckCircle2 className="h-4 w-4" />
                  Transfer has been submitted
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <RiskFactorList session={session} />
        <MetricGrid session={session} />
      </div>

      <EventTimeline events={session.events} />
    </div>
  );
}
