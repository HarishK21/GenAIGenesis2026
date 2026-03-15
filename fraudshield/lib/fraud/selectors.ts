import {
  type AlertRecord,
  type AlertSeverity,
  type FraudSession,
  type OverviewMetricCard,
  type OverviewMetrics,
  type RiskStatus
} from "@/lib/fraud/types";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

const compactFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  notation: "compact"
});

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto"
});

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export function formatCompactNumber(value: number) {
  return compactFormatter.format(value);
}

export function formatDuration(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatRelativeTime(value: string) {
  const target = new Date(value).getTime();
  const deltaInSeconds = Math.round((target - Date.now()) / 1000);

  if (Math.abs(deltaInSeconds) < 60) {
    return relativeTimeFormatter.format(deltaInSeconds, "second");
  }

  const deltaInMinutes = Math.round(deltaInSeconds / 60);

  if (Math.abs(deltaInMinutes) < 60) {
    return relativeTimeFormatter.format(deltaInMinutes, "minute");
  }

  const deltaInHours = Math.round(deltaInMinutes / 60);

  return relativeTimeFormatter.format(deltaInHours, "hour");
}

export function getStatusTone(status: RiskStatus) {
  switch (status) {
    case "High Risk":
      return "critical";
    case "Watch":
      return "warning";
    default:
      return "neutral";
  }
}

export function getSeverityTone(severity: AlertSeverity) {
  switch (severity) {
    case "High":
      return "critical";
    case "Medium":
      return "warning";
    default:
      return "success";
  }
}

export function getOverviewMetrics(
  sessions: FraudSession[],
  alerts: AlertRecord[]
): OverviewMetrics {
  const activeSessions = sessions.filter((session) => {
    const lastEventAge = Date.now() - new Date(session.summary.lastEventTime).getTime();

    return lastEventAge <= 15 * 60_000;
  }).length;

  const flaggedSessions = sessions.filter(
    (session) => session.summary.status !== "Normal"
  ).length;

  const highRiskTransfers = sessions.filter(
    (session) =>
      session.summary.status === "High Risk" || session.summary.transferAmount >= 8000
  ).length;

  const averageRiskScore = sessions.length
    ? Math.round(
        sessions.reduce(
          (total, session) => total + session.summary.currentRiskScore,
          0
        ) / sessions.length
      )
    : 0;

  const riskDistribution = [
    {
      label: "Normal",
      count: sessions.filter((session) => session.summary.status === "Normal").length
    },
    {
      label: "Watch",
      count: sessions.filter((session) => session.summary.status === "Watch").length
    },
    {
      label: "High Risk",
      count: sessions.filter((session) => session.summary.status === "High Risk").length
    }
  ];

  const bucketCount = 6;
  const bucketSizeMs = 60 * 60_000;

  const alertsOverTime = Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart =
      Date.now() - (bucketCount - index) * bucketSizeMs;
    const bucketEnd = bucketStart + bucketSizeMs;
    const bucketAlerts = alerts.filter((alert) => {
      const timestamp = new Date(alert.timestamp).getTime();

      return timestamp >= bucketStart && timestamp < bucketEnd;
    });

    return {
      label: new Intl.DateTimeFormat("en-US", {
        hour: "numeric"
      }).format(new Date(bucketStart)),
      low: bucketAlerts.filter((alert) => alert.severity === "Low").length,
      medium: bucketAlerts.filter((alert) => alert.severity === "Medium").length,
      high: bucketAlerts.filter((alert) => alert.severity === "High").length,
      total: bucketAlerts.length
    };
  });

  const recentFlaggedSessions = sessions
    .sort((left, right) =>
      right.summary.lastEventTime.localeCompare(left.summary.lastEventTime)
    )
    .slice(0, 5);

  const recentAlerts = alerts.slice(0, 6);

  return {
    activeSessions,
    flaggedSessions,
    highRiskTransfers,
    averageRiskScore,
    riskDistribution,
    alertsOverTime,
    recentFlaggedSessions,
    recentAlerts
  };
}

export function getOverviewMetricCards(metrics: OverviewMetrics): OverviewMetricCard[] {
  return [
    {
      label: "Active Sessions",
      value: String(metrics.activeSessions),
      change: "5s sync",
      tone: "neutral"
    },
    {
      label: "Flagged Sessions",
      value: String(metrics.flaggedSessions),
      change: `${Math.round(
        (metrics.flaggedSessions / Math.max(metrics.activeSessions, 1)) * 100
      )}% of active`,
      tone: "warning"
    },
    {
      label: "High Risk Transfers",
      value: String(metrics.highRiskTransfers),
      change: "Priority queue",
      tone: "critical"
    },
    {
      label: "Average Risk Score",
      value: String(metrics.averageRiskScore),
      change: metrics.averageRiskScore >= 50 ? "Elevated" : "Stable",
      tone: metrics.averageRiskScore >= 50 ? "critical" : "success"
    }
  ];
}
