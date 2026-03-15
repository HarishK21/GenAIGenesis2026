import Link from "next/link";

import { RiskBadge } from "@/components/dashboard/risk-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/fraud/selectors";
import { type AlertRecord } from "@/lib/fraud/types";

export function AlertsTable({ alerts }: { alerts: AlertRecord[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Alert ID</TableHead>
          <TableHead>Session</TableHead>
          <TableHead>Severity</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>Timestamp</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {alerts.map((alert) => (
          <TableRow key={alert.id}>
            <TableCell className="font-medium text-slate-100">{alert.id}</TableCell>
            <TableCell>{alert.sessionId}</TableCell>
            <TableCell>
              <RiskBadge value={alert.severity} />
            </TableCell>
            <TableCell>{alert.reason}</TableCell>
            <TableCell>{formatDateTime(alert.timestamp)}</TableCell>
            <TableCell>
              <Link href={`/dashboard/sessions/${alert.sessionId}`} className="inline-flex">
                <RiskBadge value={alert.status} />
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
