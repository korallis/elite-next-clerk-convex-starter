"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export type ConnectionView = {
  id: string;
  name: string;
  driver: string;
  createdAt: number;
  updatedAt: number;
  lastVerifiedAt: number | null;
  lastError: string | null;
  selectionMode: "all" | "include" | "exclude";
  selectedTables: string[];
  excludedTables: string[];
  syncRequestedAt: number | null;
  latestRun: {
    id: string;
    status: "pending" | "running" | "completed" | "failed";
    startedAt: number;
    completedAt: number | null;
    error: string | null;
    stages?: Array<{ stage: string; status: string; metrics?: string; startedAt?: number; completedAt?: number }> | null;
  } | null;
};

type StatusInfo = {
  label: string;
  tone: "default" | "success" | "danger" | "warning";
  detail: string | null;
};

const toneVariants: Record<StatusInfo["tone"], string> = {
  default: "bg-muted text-foreground",
  success: "bg-emerald-500/15 text-emerald-500",
  danger: "bg-destructive/15 text-destructive",
  warning: "bg-amber-500/15 text-amber-500",
};

export function ConnectionsClient({
  initialConnections,
}: {
  initialConnections: ConnectionView[];
}) {
  const [connections, setConnections] = useState(initialConnections);
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());

  const hasConnections = connections.length > 0;

  const updateConnection = useCallback((id: string, updater: (prev: ConnectionView) => ConnectionView) => {
    setConnections((prev) => prev.map((conn) => (conn.id === id ? updater(conn) : conn)));
  }, []);

  const refreshConnection = useCallback(
    async (id: string) => {
      setRefreshingIds((prev) => new Set(prev).add(id));
      try {
        const response = await fetch(`/api/data-sources/${id}/runs`, {
          method: "GET",
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch status (${response.status})`);
        }
        const payload = await response.json();
          updateConnection(id, (prev) => ({
          ...prev,
          lastVerifiedAt: payload.connection.lastVerifiedAt ?? null,
          lastError: payload.connection.lastError ?? null,
          selectionMode: payload.connection.selectionMode ?? prev.selectionMode,
          selectedTables: payload.connection.selectedTables ?? prev.selectedTables,
          excludedTables: payload.connection.excludedTables ?? prev.excludedTables,
          syncRequestedAt: payload.connection.syncRequestedAt ?? null,
          latestRun: Array.isArray(payload.runs) && payload.runs.length
            ? {
                id: String(payload.runs[0]._id ?? payload.runs[0].id ?? Date.now()),
                status: payload.runs[0].status,
                startedAt: payload.runs[0].startedAt,
                completedAt: payload.runs[0].completedAt ?? null,
                  error: payload.runs[0].error ?? null,
                  stages: Array.isArray(payload.runs[0].stages) ? payload.runs[0].stages : null,
              }
            : null,
        }));
      } catch (error) {
        console.error("Failed to refresh connection", error);
        toast.error("Unable to refresh connection status", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        setRefreshingIds((prev) => {
          const copy = new Set(prev);
          copy.delete(id);
          return copy;
        });
      }
    },
    [updateConnection]
  );

  const triggerSync = useCallback(
    async (id: string) => {
      toast.promise(
        (async () => {
          const response = await fetch("/api/semantic-sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ connectionId: id }),
          });
          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.details ?? payload.error ?? "Failed to trigger sync");
          }
          updateConnection(id, (prev) => ({
            ...prev,
            latestRun: {
              id: `pending-${Date.now()}`,
              status: "running",
              startedAt: Date.now(),
              completedAt: null,
              error: null,
            },
            syncRequestedAt: Date.now(),
          }));
          await refreshConnection(id);
        })(),
        {
          loading: "Triggering sync…",
          success: "Semantic sync started",
          error: (error) => error.message || "Failed to start sync",
        }
      );
    },
    [refreshConnection, updateConnection]
  );

  const runningIds = useMemo(
    () =>
      connections
        .filter((conn) => getStatusInfo(conn).tone === "warning")
        .map((conn) => conn.id),
    [connections]
  );

  useEffect(() => {
    if (runningIds.length === 0) return;
    const interval = setInterval(() => {
      runningIds.forEach((id) => {
        void refreshConnection(id);
      });
    }, 8000);
    return () => clearInterval(interval);
  }, [runningIds, refreshConnection]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Connections</h1>
          <p className="text-sm text-muted-foreground">
            Manage MSSQL data sources, monitor sync health, and launch resynchronizations.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/connections/new">New connection</Link>
        </Button>
      </div>

      {!hasConnections ? (
        <Card>
          <CardHeader>
            <CardTitle>No connections yet</CardTitle>
            <CardDescription>
              Create your first MSSQL connection to begin building dashboards and running semantic syncs.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <Link href="/dashboard/connections/new">Start wizard</Link>
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {connections.map((connection) => {
            const status = getStatusInfo(connection);
            const isRefreshing = refreshingIds.has(connection.id);
            return (
              <Card key={connection.id} className="flex flex-col justify-between">
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg">{connection.name}</CardTitle>
                      <CardDescription>{connection.driver.toUpperCase()}</CardDescription>
                    </div>
                    <Badge className={toneVariants[status.tone]}>{status.label}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Created {formatTimestamp(connection.createdAt)}</div>
                    <div>
                      Last sync {formatTimestamp(connection.latestRun?.completedAt ?? connection.lastVerifiedAt)}
                    </div>
                    {connection.selectionMode === "include" && connection.selectedTables.length > 0 && (
                      <div>
                        Including {connection.selectedTables.length} table
                        {connection.selectedTables.length === 1 ? "" : "s"}
                      </div>
                    )}
                    {connection.selectionMode === "exclude" && connection.excludedTables.length > 0 && (
                      <div>
                        Excluding {connection.excludedTables.length} table
                        {connection.excludedTables.length === 1 ? "" : "s"}
                      </div>
                    )}
                  </div>
                  {status.detail && (
                    <p className="text-sm text-muted-foreground/80">{status.detail}</p>
                  )}
                </CardHeader>
                <Separator className="opacity-50" />
                <CardContent className="flex flex-col gap-3 py-4">
                  {connection.latestRun && (
                    <div className="rounded-md border border-border/60 px-3 py-2 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Last run</span>
                        <span>{formatTimestamp(connection.latestRun.startedAt)}</span>
                      </div>
                      {renderProgress(connection.latestRun)}
                      {renderTimeline(connection.latestRun)}
                      {renderEtaAndSchedule(connection)}
                      {connection.latestRun.status === "failed" && connection.latestRun.error && (
                        <div className="mt-2 text-destructive">
                          {connection.latestRun.error}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => triggerSync(connection.id)}
                  >
                    Retry sync
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => refreshConnection(connection.id)}
                    disabled={isRefreshing}
                  >
                    {isRefreshing ? "Refreshing…" : "Refresh"}
                  </Button>
                  <div className="ml-auto text-xs text-muted-foreground">
                    {connection.syncRequestedAt
                      ? `Sync requested ${formatRelative(connection.syncRequestedAt)}`
                      : ""}
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getStatusInfo(connection: ConnectionView): StatusInfo {
  if (connection.latestRun?.status === "running") {
    return {
      label: "Syncing",
      tone: "warning",
      detail: "Semantic sync is currently running.",
    };
  }
  if (connection.latestRun?.status === "failed") {
    return {
      label: "Sync failed",
      tone: "danger",
      detail: connection.latestRun.error ?? connection.lastError ?? "The last sync attempt failed.",
    };
  }
  if (connection.lastError) {
    return {
      label: "Attention",
      tone: "danger",
      detail: connection.lastError,
    };
  }
  if (connection.lastVerifiedAt) {
    return {
      label: "Healthy",
      tone: "success",
      detail: `Last verified ${formatRelative(connection.lastVerifiedAt)}`,
    };
  }
  return {
    label: "Pending",
    tone: "default",
    detail: "Awaiting first semantic sync.",
  };
}

function renderProgress(run: NonNullable<ConnectionView["latestRun"]>) {
  if (!run.stages || run.status !== "running") return null;
  const stages = run.stages as Array<{ stage: string; status: string; metrics?: string; startedAt?: number }>;
  const parse = (s?: string) => {
    try { return s ? JSON.parse(s) as Record<string, number> : null; } catch { return null; }
  };
  const wa = stages.find((s) => s.stage === "write_artifacts");
  const gen = stages.find((s) => s.stage === "generate_snapshot");
  const m = parse(wa?.metrics) || null;
  let pct = 0;
  let label = "";
  if (m && typeof m.totalTables === "number" && m.totalTables > 0) {
    pct = Math.min(100, Math.round(((m.processedTables ?? 0) / m.totalTables) * 100));
    label = `write_artifacts ${m.processedTables ?? 0}/${m.totalTables} tables (${pct}%)`;
  } else if (gen) {
    const gm = parse(gen.metrics);
    if (gm && typeof gm.totalTables === "number") {
      const processed = gm.processedTables ?? 0;
      pct = Math.min(100, Math.round((processed / Math.max(1, gm.totalTables)) * 100));
      label = `generate_snapshot ${processed}/${gm.totalTables} tables (${pct}%)`;
    } else if (gm && typeof gm.tables === "number") {
      label = `generate_snapshot found ${gm.tables} tables`;
    }
  }
  if (!label) return null;
  return (
    <div className="mt-2">
      <div className="h-2 w-full bg-muted rounded">
        <div className="h-2 bg-amber-500 rounded" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-[11px]">{label}</div>
    </div>
  );
}

function renderTimeline(run: NonNullable<ConnectionView["latestRun"]>) {
  const stages = (run.stages ?? []) as Array<{ stage: string; status: string; metrics?: string; startedAt?: number; completedAt?: number }>;
  if (stages.length === 0) return null;
  const order = ["generate_snapshot", "write_artifacts", "mark_completed"];
  const sorted = stages.slice().sort((a, b) => order.indexOf(a.stage) - order.indexOf(b.stage));
  return (
    <div className="mt-2 grid grid-cols-3 gap-2">
      {sorted.map((s) => (
        <div key={s.stage} className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className={`inline-block size-2 rounded-full ${s.status === "completed" ? "bg-emerald-500" : s.status === "running" ? "bg-amber-500" : s.status === "failed" ? "bg-red-500" : "bg-muted-foreground"}`} />
            <span className="capitalize">{s.stage.replace(/_/g, " ")}</span>
          </div>
          {s.metrics && (
            <div className="ml-4 text-[11px] text-muted-foreground/80 truncate">
              {(() => { try { return JSON.stringify(JSON.parse(s.metrics)); } catch { return s.metrics; } })()}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function renderEtaAndSchedule(connection: ConnectionView) {
  const run = connection.latestRun;
  if (!run) return null;
  const stages = (run.stages ?? []) as Array<{ stage: string; status: string; metrics?: string; startedAt?: number }>;
  const wa = stages.find((s) => s.stage === "write_artifacts");
  const parse = (s?: string) => { try { return s ? JSON.parse(s) as Record<string, number> : null; } catch { return null; } };
  const m = parse(wa?.metrics) || null;
  let etaText = "";
  if (wa && wa.startedAt && m && typeof m.totalTables === "number" && m.totalTables > 0) {
    const elapsedMs = Date.now() - wa.startedAt;
    const processed = Math.max(1, m.processedTables ?? 0);
    const rate = processed / Math.max(1, elapsedMs / 1000); // tables/sec
    if (rate > 0 && processed < m.totalTables) {
      const remaining = m.totalTables - processed;
      const remainingSec = Math.round(remaining / rate);
      etaText = `ETA ~ ${formatDuration(remainingSec)}`;
    }
  } else {
    const gen = stages.find((s) => s.stage === "generate_snapshot");
    const gm = parse(gen?.metrics) || null;
    if (gen && gen.startedAt && gm && typeof gm.totalTables === "number" && gm.totalTables > 0) {
      const elapsedMs = Date.now() - gen.startedAt;
      const processed = Math.max(1, gm.processedTables ?? 0);
      const rate = processed / Math.max(1, elapsedMs / 1000);
      if (rate > 0 && processed < gm.totalTables) {
        const remaining = gm.totalTables - processed;
        const remainingSec = Math.round(remaining / rate);
        etaText = `ETA ~ ${formatDuration(remainingSec)}`;
      }
    }
  }
  const intervalMin = Number(process.env.NEXT_PUBLIC_SEMANTIC_SYNC_INTERVAL_MINUTES || "0");
  let nextText = "Manual sync";
  if (intervalMin > 0) {
    const base = (run.completedAt ?? run.startedAt) || Date.now();
    const nextAt = base + intervalMin * 60_000;
    nextText = `Next scheduled ${new Date(nextAt).toLocaleString()}`;
  }
  if (!etaText && nextText === "Manual sync") return null;
  return (
    <div className="mt-2 flex justify-between text-[11px]">
      <span>{etaText}</span>
      <span>{nextText}</span>
    </div>
  );
}

function formatDuration(totalSec: number) {
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) return `${min}m ${sec}s`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  return `${hr}h ${remMin}m`;
}

function formatTimestamp(timestamp: number | null | undefined): string {
  if (!timestamp) return "Never";
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return "Unknown";
  }
}

function formatRelative(timestamp: number): string {
  const now = Date.now();
  const diff = timestamp - now;
  const absMs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const minutes = Math.round(absMs / 60000);
  if (minutes === 0) {
    return "just now";
  }
  if (Math.abs(minutes) < 60) {
    return rtf.format(Math.sign(diff) * minutes, "minute");
  }
  const hours = Math.round(absMs / 3600000);
  if (Math.abs(hours) < 48) {
    return rtf.format(Math.sign(diff) * hours, "hour");
  }
  const days = Math.round(absMs / 86400000);
  return rtf.format(Math.sign(diff) * days, "day");
}
