import { Id } from "convex/_generated/dataModel";

import { computeStakeholderMetrics } from "@/convex/_shared/metrics/stakeholder";

function connId(value: string) {
  return value as Id<"orgConnections">;
}

function dashboardId(value: string) {
  return value as Id<"dashboards">;
}

describe("computeStakeholderMetrics", () => {
  it("aggregates core KPI trends", () => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const windowStart = Date.UTC(2025, 0, 1, 0, 0, 0, 0);
    const now = Date.UTC(2025, 0, 7, 12, 0, 0, 0);

    const connection = connId("conn1");
    const dashboard = dashboardId("dash1");

    const result = computeStakeholderMetrics({
      days: 7,
      now,
      connections: [
        {
          _id: connection,
          createdAt: windowStart,
        },
      ],
      audits: [
        {
          connectionId: connection,
          createdAt: windowStart + 30 * 60 * 1000,
          status: "success",
          durationMs: 4500,
        },
        {
          connectionId: connection,
          createdAt: windowStart + DAY_MS + 10 * 60 * 1000,
          status: "error",
          durationMs: null,
        },
        {
          connectionId: connection,
          createdAt: windowStart + 2 * DAY_MS + 20 * 60 * 1000,
          status: "success",
          durationMs: 5000,
        },
      ],
      dashboards: [
        {
          _id: dashboard,
          createdAt: windowStart + DAY_MS,
        },
      ],
      tiles: Array.from({ length: 4 }).map(() => ({
        dashboardId: dashboard,
      })),
    });

    expect(result.range.days).toBe(7);
    expect(result.range.start).toBe(new Date(windowStart).toISOString());
    expect(result.range.end).toBe(new Date(Date.UTC(2025, 0, 8, 0, 0, 0, 0) - 1).toISOString());

    expect(result.metrics.ttfi.currentMinutes).toBeCloseTo(30, 5);
    expect(result.metrics.ttfi.sampleSize).toBe(1);

    expect(result.metrics.nlAccuracy.currentRate).toBe(1);
    expect(result.metrics.nlAccuracy.sampleSize).toBe(3);

    expect(result.metrics.dashboardAdoption.currentRate).toBe(1);
    expect(result.metrics.dashboardAdoption.sampleSize).toBe(1);

    expect(result.metrics.performance.currentNlP95Ms).toBe(5000);
    expect(result.metrics.performance.sampleSize).toBe(2);

    expect(result.metrics.trustSafety.currentIncidents).toBe(1);
    expect(result.metrics.trustSafety.sampleSize).toBe(3);

    expect(result.metrics.ttfi.trend).toHaveLength(7);
    expect(result.metrics.nlAccuracy.trend).toHaveLength(7);
    expect(result.metrics.dashboardAdoption.trend).toHaveLength(7);
    expect(result.metrics.performance.trend).toHaveLength(7);
    expect(result.metrics.trustSafety.trend).toHaveLength(7);
  });
});
