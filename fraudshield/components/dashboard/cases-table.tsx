import Link from "next/link";

import { RiskBadge } from "@/components/dashboard/risk-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/fraud/selectors";
import { type CaseRecord } from "@/lib/fraud/types";
import { cn } from "@/lib/utils";

export function CasesTable({
  cases,
  activeCaseId,
  onSelectCase,
  onUpdateStatus
}: {
  cases: CaseRecord[];
  activeCaseId: string | null;
  onSelectCase: (caseId: string) => void;
  onUpdateStatus: (caseId: string, status: CaseRecord["status"]) => void;
}) {
  const handleOpenCase = (caseId: string) => {
    onSelectCase(caseId);

    const detailCard = document.getElementById("case-detail-card");
    if (detailCard) {
      detailCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Case ID</TableHead>
          <TableHead>Session</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Assigned Analyst</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cases.map((caseRecord) => (
          <TableRow
            key={caseRecord.id}
            className={cn(
              activeCaseId === caseRecord.id && "bg-cyan-400/[0.06]"
            )}
          >
            <TableCell className="font-medium text-slate-100">
              {caseRecord.id}
            </TableCell>
            <TableCell>
              <Link
                href={`/dashboard/sessions/${caseRecord.sessionId}`}
                className="text-cyan-200 hover:text-cyan-100"
              >
                {caseRecord.sessionId}
              </Link>
            </TableCell>
            <TableCell>
              <RiskBadge value={caseRecord.priority === "Critical" ? "High" : caseRecord.priority === "High" ? "Medium" : "Low"} />
            </TableCell>
            <TableCell>{caseRecord.assignedAnalyst}</TableCell>
            <TableCell>{formatDateTime(caseRecord.createdTime)}</TableCell>
            <TableCell>{caseRecord.status}</TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => handleOpenCase(caseRecord.id)}>
                  Open case
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onUpdateStatus(caseRecord.id, "Investigating")}
                >
                  Investigating
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onUpdateStatus(caseRecord.id, "Resolved")}
                >
                  Resolve
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
