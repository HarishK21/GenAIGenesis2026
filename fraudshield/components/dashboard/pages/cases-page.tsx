"use client";

import { useEffect, useState } from "react";

import { CasesTable } from "@/components/dashboard/cases-table";
import { DataState } from "@/components/dashboard/data-state";
import {
  useFraudDashboard
} from "@/components/dashboard/dashboard-data-provider";
import { PageHeader } from "@/components/dashboard/page-header";
import { RiskBadge } from "@/components/dashboard/risk-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { formatDateTime } from "@/lib/fraud/selectors";

export function CasesPage() {
  const { cases, getSession, loadingState, updateCaseStatus } = useFraudDashboard();
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCaseId && cases[0]) {
      setActiveCaseId(cases[0].id);
    }
  }, [activeCaseId, cases]);

  if (loadingState === "loading" && cases.length === 0) {
    return (
      <DataState
        title="Loading cases"
        description="Pulling analyst-created cases that came from flagged sessions."
      />
    );
  }

  const activeCase = cases.find((caseRecord) => caseRecord.id === activeCaseId) ?? cases[0];
  const activeSession = activeCase ? getSession(activeCase.sessionId) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cases"
        description="Track escalated sessions, move them into investigation, and resolve them when the analyst workflow is complete."
        actions={<Badge variant="neutral">{cases.length} open or recent cases</Badge>}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Case Queue</CardTitle>
            <CardDescription>
              Cases are generated from policy thresholds and tracked with analyst updates.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-2 pt-0">
            <CasesTable
              cases={cases}
              activeCaseId={activeCase?.id ?? null}
              onSelectCase={setActiveCaseId}
              onUpdateStatus={updateCaseStatus}
            />
          </CardContent>
        </Card>

        {activeCase ? (
          <Card id="case-detail-card">
            <CardHeader>
              <CardTitle>Case Detail</CardTitle>
              <CardDescription>
                Session-linked case context for investigation and disposition.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                <p className="text-sm text-slate-400">Case ID</p>
                <p className="mt-2 text-lg font-semibold text-slate-50">{activeCase.id}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                <p className="text-sm text-slate-400">Priority</p>
                <div className="mt-2">
                  <RiskBadge
                    value={
                      activeCase.priority === "Critical"
                        ? "High"
                        : activeCase.priority === "High"
                          ? "Medium"
                          : "Low"
                    }
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                <p className="text-sm text-slate-400">Assigned analyst</p>
                <p className="mt-2 text-lg font-semibold text-slate-50">
                  {activeCase.assignedAnalyst}
                </p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                <p className="text-sm text-slate-400">Created</p>
                <p className="mt-2 text-lg font-semibold text-slate-50">
                  {formatDateTime(activeCase.createdTime)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                <p className="text-sm text-slate-400">Status</p>
                <p className="mt-2 text-lg font-semibold text-slate-50">
                  {activeCase.status}
                </p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                <p className="text-sm text-slate-400">Summary</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {activeCase.summary}
                </p>
                {activeSession ? (
                  <p className="mt-3 text-sm text-slate-500">
                    Session {activeSession.sessionId} is currently{" "}
                    {activeSession.summary.status} with analyst decision{" "}
                    {activeSession.analystDecision}.
                  </p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => updateCaseStatus(activeCase.id, "Investigating")}
                >
                  Mark investigating
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateCaseStatus(activeCase.id, "Resolved")}
                >
                  Resolve
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <DataState
            title="No cases yet"
            description="Escalate a risky session from the session detail page to create a case."
          />
        )}
      </div>
    </div>
  );
}
