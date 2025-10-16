import type { Id } from "../../_generated/dataModel";

type TrendPoint = { date: string; value: number | null; sampleSize?: number | null };

const DAY_MS = 24 * 60 * 60 * 1000;

function clampDays(days: number | undefined) {
  if (!days) return 14;
  return Math.min(Math.max(Math.floor(days), 7), 90);
}

function startOfDay(ms: number) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function buildDayWindows(days: number, endMs: number) {
  const windows: { date: string; start: number; end: number }[] = [];
  const startMs = endMs - days * DAY_MS;
  for (let i = 0; i < days; i++) {
    const start = startMs + i * DAY_MS;
    const end = start + DAY_MS;
    windows.push({ date: new Date(start).toISOString().slice(0, 10), start, end });
  }
  return windows;
}

function average(values: number[]) {
  if (!values.length) return null;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

function percentile(values: number[], p: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[idx];
}

function round(value: number | null, digits = 2) {
  if (value === null) return null;
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

type ConnectionRecord = {
  _id: Id<"orgConnections">;
  createdAt: number;
};

type AuditRecord = {
  connectionId: Id<"orgConnections">;
  createdAt: number;
  status: "success" | "error";
  durationMs?: number | null;
};

type DashboardRecord = {
  _id: Id<"dashboards">;
  createdAt: number;
};

type DashboardTileRecord = {
  dashboardId: Id<"dashboards">;
};

export type StakeholderMetricsArgs = {
  days?: number;
  now?: number;
  connections: ConnectionRecord[];
  audits: AuditRecord[];
  dashboards: DashboardRecord[];
  tiles: DashboardTileRecord[];
};

export function computeStakeholderMetrics(args: StakeholderMetricsArgs) {
  const days = clampDays(args.days);
  const now = args.now ?? Date.now();
  const todayEnd = startOfDay(now) + DAY_MS;
  const windows = buildDayWindows(days, todayEnd);
  const windowStart = windows[0]?.start ?? todayEnd - days * DAY_MS;

  const auditsInRange = args.audits.filter((audit) => audit.createdAt >= windowStart && audit.createdAt < todayEnd);

  const tilesByDashboard = new Map<string, number>();
  for (const tile of args.tiles) {
    const key = tile.dashboardId.toString();
    tilesByDashboard.set(key, (tilesByDashboard.get(key) ?? 0) + 1);
  }

  const ttfiRecords: { minutes: number; occurredAt: number }[] = [];
  for (const conn of args.connections) {
    const firstSuccess = args.audits
      .filter((audit) =>
        audit.connectionId === conn._id &&
        audit.status === "success" &&
        audit.createdAt >= conn.createdAt
      )
      .sort((a, b) => a.createdAt - b.createdAt)[0];
    if (!firstSuccess) continue;
    const diffMinutes = (firstSuccess.createdAt - conn.createdAt) / (60 * 1000);
    if (diffMinutes >= 0) {
      ttfiRecords.push({ minutes: diffMinutes, occurredAt: firstSuccess.createdAt });
    }
  }

  const ttfiTrend = windows.map((win) => {
    const values = ttfiRecords
      .filter((entry) => entry.occurredAt >= win.start && entry.occurredAt < win.end)
      .map((entry) => entry.minutes);
    return { date: win.date, value: round(average(values), 1), sampleSize: values.length } as TrendPoint;
  });
  const lastTtfiValue = [...ttfiTrend].reverse().find((point) => point.value !== null)?.value ?? null;

  const accuracyTrend = windows.map((win) => {
    const dayAudits = auditsInRange.filter((audit) => audit.createdAt >= win.start && audit.createdAt < win.end);
    const total = dayAudits.length;
    const success = dayAudits.filter((audit) => audit.status === "success").length;
    const rate = total ? success / total : null;
    return { date: win.date, value: rate !== null ? round(rate, 4) : null, sampleSize: total } as TrendPoint;
  });
  const lastAccuracy = [...accuracyTrend].reverse().find((p) => p.value !== null)?.value ?? null;

  const dashboardsInRange = args.dashboards.filter((d) => d.createdAt >= windowStart && d.createdAt < todayEnd);
  const adoptionTrend = windows.map((win) => {
    const dayDashboards = dashboardsInRange.filter((dash) => dash.createdAt >= win.start && dash.createdAt < win.end);
    const totals = dayDashboards.length;
    if (!totals) return { date: win.date, value: null, sampleSize: 0 } as TrendPoint;
    const adopted = dayDashboards.filter((dash) => (tilesByDashboard.get(dash._id.toString()) ?? 0) >= 4).length;
    return { date: win.date, value: round(adopted / totals, 4), sampleSize: totals } as TrendPoint;
  });
  const lastAdoption = [...adoptionTrend].reverse().find((p) => p.value !== null)?.value ?? null;

  const performanceTrend = windows.map((win) => {
    const dayDurations = auditsInRange
      .filter((audit) => audit.createdAt >= win.start && audit.createdAt < win.end && audit.status === "success")
      .map((audit) => audit.durationMs ?? 0)
      .filter((v) => v > 0);
    const p95 = percentile(dayDurations, 0.95);
    return { date: win.date, value: p95 !== null ? round(p95, 0) : null, sampleSize: dayDurations.length } as TrendPoint;
  });
  const lastPerformance = [...performanceTrend].reverse().find((p) => p.value !== null)?.value ?? null;

  const trustTrend = windows.map((win) => {
    const dayErrors = auditsInRange.filter((audit) =>
      audit.createdAt >= win.start && audit.createdAt < win.end && audit.status === "error"
    ).length;
    return { date: win.date, value: dayErrors || null, sampleSize: dayErrors } as TrendPoint;
  });
  const lastTrust = [...trustTrend].reverse().find((p) => p.value !== null)?.value ?? 0;

  const auditCoverage = auditsInRange.length ? 1 : null;

  return {
    generatedAt: now,
    range: {
      days,
      start: new Date(windowStart).toISOString(),
      end: new Date(todayEnd - 1).toISOString(),
    },
    dataSources: [
      { key: "queryAudits", label: "Query Audits", detail: "NL→SQL execution logs" },
      { key: "dashboards", label: "Dashboards", detail: "Dashboard creation & tile counts" },
      { key: "orgConnections", label: "Connections", detail: "Connection onboarding timeline" },
    ] as const,
    metrics: {
      ttfi: {
        currentMinutes: lastTtfiValue,
        targetMinutes: 10,
        trend: ttfiTrend,
        sampleSize: ttfiRecords.length,
      },
      nlAccuracy: {
        currentRate: lastAccuracy,
        targetRate: 0.8,
        trend: accuracyTrend,
        sampleSize: auditsInRange.length,
      },
      dashboardAdoption: {
        currentRate: lastAdoption,
        targetRate: 0.7,
        trend: adoptionTrend,
        sampleSize: dashboardsInRange.length,
      },
      performance: {
        currentNlP95Ms: lastPerformance,
        targetNlP95Ms: 8000,
        trend: performanceTrend,
        sampleSize: auditsInRange.filter((a) => a.status === "success").length,
      },
      trustSafety: {
        currentIncidents: lastTrust ?? 0,
        trend: trustTrend,
        auditCoverage,
        sampleSize: auditsInRange.length,
      },
    },
  } as const;
}
