"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TrendPoint = { date: string; value: number | null; sampleSize?: number | null };

type StakeholderMetricsResponse = {
  generatedAt: number;
  range: { days: number; start: string; end: string };
  dataSources: { key: string; label: string; detail: string }[];
  metrics: {
    ttfi: {
      currentMinutes: number | null;
      targetMinutes: number;
      trend: TrendPoint[];
      sampleSize: number;
    };
    nlAccuracy: {
      currentRate: number | null;
      targetRate: number;
      trend: TrendPoint[];
      sampleSize: number;
    };
    dashboardAdoption: {
      currentRate: number | null;
      targetRate: number;
      trend: TrendPoint[];
      sampleSize: number;
    };
    performance: {
      currentNlP95Ms: number | null;
      targetNlP95Ms: number;
      trend: TrendPoint[];
      sampleSize: number;
    };
    trustSafety: {
      currentIncidents: number;
      trend: TrendPoint[];
      auditCoverage: number | null;
      sampleSize: number;
    };
  };
};

type MetricCardProps = {
  title: string;
  description: string;
  trend: TrendPoint[];
  current: number | null;
  target?: number | null;
  format: "minutes" | "percent" | "milliseconds" | "count";
  highlight?: "success" | "warning" | "danger";
  sampleSize?: number;
};

const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const percentFormat = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 });

function formatMetricValue(value: number | null, format: MetricCardProps["format"]) {
  if (value === null || value === undefined) return "–";
  switch (format) {
    case "percent":
      return percentFormat.format(value);
    case "minutes":
      return `${numberFormat.format(value)} min`;
    case "milliseconds":
      return `${numberFormat.format(value / 1000)} s`;
    case "count":
    default:
      return numberFormat.format(value);
  }
}

function computeDelta(trend: TrendPoint[]) {
  if (!trend.length) return null;
  const last = [...trend].reverse().find((point) => point.value !== null)?.value;
  const previous = [...trend]
    .reverse()
    .filter((_, idx) => idx > 0)
    .find((point) => point.value !== null)?.value;
  if (last === undefined || last === null || previous === undefined || previous === null) return null;
  return last - previous;
}

function MetricCard({ title, description, current, target, trend, format, sampleSize }: MetricCardProps) {
  const delta = computeDelta(trend);
  const deltaLabel = delta === null ? "–" : formatMetricValue(delta, format);
  const chartData = useMemo(
    () =>
      trend.map((point) => ({
        date: point.date,
        value: point.value ?? 0,
      })),
    [trend]
  );

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-semibold tracking-tight">
            {formatMetricValue(current, format)}
          </span>
          <span className="text-xs text-muted-foreground">
            {delta === null ? "No change" : delta >= 0 ? `▲ ${deltaLabel}` : `▼ ${formatMetricValue(Math.abs(delta), format)}`}
          </span>
        </div>
        {target !== undefined && target !== null && (
          <p className="text-xs text-muted-foreground">Target: {formatMetricValue(target, format)}</p>
        )}
        {typeof sampleSize === "number" && (
          <p className="text-xs text-muted-foreground">Sample size: {sampleSize}</p>
        )}
        <div className="h-32">
          <ResponsiveContainer>
            <AreaChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(value: number) => formatMetricValue(value, format)}
              />
              <Area
                type="monotone"
                dataKey="value"
                strokeWidth={2}
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary) / 0.15)"
                fillOpacity={0.2}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function StakeholderMetricsClient() {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [data, setData] = useState<StakeholderMetricsResponse | null>(null);
  const [selectedRange, setSelectedRange] = useState("14");

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setState("loading");
    fetch(`/api/metrics/stakeholder?days=${selectedRange}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load metrics");
        return res.json();
      })
      .then((payload) => {
        if (!cancelled) {
          setData(payload);
          setState("ready");
        }
      })
      .catch((error) => {
        if ((error as Error).name === "AbortError") return;
        console.error(error);
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedRange]);

  if (state === "loading") {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 5 }).map((_, idx) => (
          <Card key={idx} className="animate-pulse space-y-4">
            <CardHeader>
              <CardTitle className="h-4 w-40 rounded bg-muted" />
              <CardDescription className="h-3 w-56 rounded bg-muted" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-8 w-24 rounded bg-muted" />
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="h-32 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (state === "error" || !data) {
    return (
      <Card className="border-destructive/40 bg-destructive/10 text-destructive">
        <CardHeader>
          <CardTitle>Unable to load metrics</CardTitle>
          <CardDescription>Please try again later or contact the engineering team.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { metrics } = data;
  const rangeLabel = `${data.range.start.slice(0, 10)} → ${data.range.end.slice(0, 10)}`;
  const generatedAt = new Date(data.generatedAt);
  const generatedAtLabel = generatedAt.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const rangeOptions = [
    { label: "Last 7 days", value: "7" },
    { label: "Last 14 days", value: "14" },
    { label: "Last 30 days", value: "30" },
    { label: "Last 60 days", value: "60" },
    { label: "Last 90 days", value: "90" },
  ];

  return (
    <div className="space-y-4">
      <Card className="border-muted-foreground/10 bg-muted/40">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              KPI Overview
            </CardTitle>
            <CardDescription>
              Auto-refreshing daily snapshots. Adjust the lookback window to compare trends.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center">
            <div className="flex items-center gap-2">
              <span>Last updated</span>
              <Badge variant="secondary">{generatedAtLabel}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span>Window</span>
              <Select value={selectedRange} onValueChange={setSelectedRange}>
                <SelectTrigger size="sm" aria-label="Select time range">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  {rangeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {data.dataSources.map((item) => (
              <Badge key={item.key} variant="outline" className="bg-background/60">
                {item.label}
                <span className="text-muted-foreground">• {item.detail}</span>
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Range: {rangeLabel}</p>
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            <li>Stakeholders sign in with Clerk viewer access and open “Stakeholder Metrics” from the dashboard menu.</li>
            <li>Confirm the last updated badge and data source tags before presenting metrics.</li>
            <li>Select the desired lookback window (7–90 days) to align with the reporting cadence.</li>
          </ul>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard
        title="Time to First Insight"
        description="Average minutes from connection to first successful NL answer"
        trend={metrics.ttfi.trend}
        current={metrics.ttfi.currentMinutes}
        target={metrics.ttfi.targetMinutes}
        format="minutes"
          sampleSize={metrics.ttfi.sampleSize}
        />
        <MetricCard
        title="NL Accuracy"
        description="Proportion of natural language queries returning success on first attempt"
        trend={metrics.nlAccuracy.trend}
        current={metrics.nlAccuracy.currentRate}
        target={metrics.nlAccuracy.targetRate}
        format="percent"
          sampleSize={metrics.nlAccuracy.sampleSize}
        />
        <MetricCard
        title="Dashboard Adoption"
        description="Share of dashboards kept with ≥4 tiles on creation day"
        trend={metrics.dashboardAdoption.trend}
        current={metrics.dashboardAdoption.currentRate}
        target={metrics.dashboardAdoption.targetRate}
        format="percent"
          sampleSize={metrics.dashboardAdoption.sampleSize}
        />
        <MetricCard
        title="Answer Performance"
        description="P95 latency (ms) for NL answers over time"
        trend={metrics.performance.trend}
        current={metrics.performance.currentNlP95Ms}
        target={metrics.performance.targetNlP95Ms}
        format="milliseconds"
          sampleSize={metrics.performance.sampleSize}
        />
        <MetricCard
        title="Trust & Safety"
        description="Recorded incidents (errors) per day across all orgs"
        trend={metrics.trustSafety.trend}
        current={metrics.trustSafety.currentIncidents}
        target={0}
        format="count"
          sampleSize={metrics.trustSafety.sampleSize}
        />
      </div>
    </div>
  );
}
