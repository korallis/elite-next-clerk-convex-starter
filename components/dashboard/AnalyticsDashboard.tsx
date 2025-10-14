"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ChartRenderer } from "@/components/dashboard/ChartRenderer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ConnectionSummary = {
  _id: string;
  name: string;
  driver: string;
  createdAt: number;
  lastVerifiedAt?: number;
  lastError?: string;
};

type QueryResult = {
  sql: string;
  rationale: string;
  chart: any;
  followUpQuestions: string[];
  rows: Record<string, unknown>[];
  columns: string[];
  executionMs: number;
};

const initialConfig = {
  server: "",
  database: "",
  user: "",
  password: "",
  port: "1433",
};

export function AnalyticsDashboard() {
  const [connections, setConnections] = useState<ConnectionSummary[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [configForm, setConfigForm] = useState(initialConfig);
  const [creatingConnection, setCreatingConnection] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dashboards, setDashboards] = useState<Array<{ _id: string; name: string }>>([]);
  const [saveTitle, setSaveTitle] = useState("");
  const [saveDashboardId, setSaveDashboardId] = useState<string>("");
  const [saveNewDashboard, setSaveNewDashboard] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConnections();
  }, []);

  useEffect(() => {
    if (!selectedConnectionId && connections.length > 0) {
      setSelectedConnectionId(connections[0]._id);
    }
  }, [connections, selectedConnectionId]);

  const selectedConnection = useMemo(
    () => connections.find((conn) => conn._id === selectedConnectionId) ?? null,
    [connections, selectedConnectionId]
  );

  async function fetchConnections() {
    try {
      const response = await fetch("/api/data-sources", {
        method: "GET",
      });
      if (!response.ok) {
        throw new Error("Unable to load data sources");
      }
      const data = await response.json();
      setConnections(data.connections ?? []);
    } catch (err) {
      console.error(err);
      setError("Failed to load data sources");
    }
  }

  async function handleCreateConnection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingConnection(true);
    setError(null);
    try {
      const response = await fetch("/api/data-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: configForm.database,
          config: {
            server: configForm.server,
            database: configForm.database,
            user: configForm.user,
            password: configForm.password,
            port: Number(configForm.port) || 1433,
          },
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Failed to create connection");
      }
      setConfigForm(initialConfig);
      await fetchConnections();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to create connection");
    } finally {
      setCreatingConnection(false);
    }
  }

  async function handleSync() {
    if (!selectedConnectionId) return;
    setSyncing(true);
    setError(null);
    try {
      const response = await fetch("/api/semantic-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: selectedConnectionId }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Semantic sync failed");
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Semantic sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function handleAsk() {
    if (!selectedConnectionId || !question.trim()) return;
    setAsking(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: selectedConnectionId,
          question: question.trim(),
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Query failed");
      }
      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Query failed");
    } finally {
      setAsking(false);
    }
  }

  async function loadDashboards() {
    try {
      const res = await fetch("/api/dashboards", { method: "GET" });
      if (res.ok) {
        const data = await res.json();
        setDashboards(data.dashboards ?? []);
      }
    } catch {}
  }

  useEffect(() => {
    if (result) loadDashboards();
  }, [result]);

  async function handleSaveTile() {
    if (!result) return;
    setSaving(true);
    try {
      const res = await fetch("/api/dashboards/save-tile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dashboardId: saveDashboardId || undefined,
          newDashboardName: !saveDashboardId ? saveNewDashboard : undefined,
          title: saveTitle || "Insight",
          sql: result.sql,
          chartSpec: result.chart ?? { type: "table" },
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save tile");
      }
      setSaveTitle("");
      setSaveDashboardId("");
      setSaveNewDashboard("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save tile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Connect Microsoft SQL Server</CardTitle>
          <CardDescription>
            Provide read-only credentials. They will be encrypted before storage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleCreateConnection}>
            <div className="space-y-2">
              <Label htmlFor="server">Server</Label>
              <Input
                id="server"
                value={configForm.server}
                onChange={(event) =>
                  setConfigForm((prev) => ({ ...prev, server: event.target.value }))
                }
                required
                placeholder="sql.yourcompany.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="database">Database</Label>
              <Input
                id="database"
                value={configForm.database}
                onChange={(event) =>
                  setConfigForm((prev) => ({ ...prev, database: event.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user">User</Label>
              <Input
                id="user"
                value={configForm.user}
                onChange={(event) =>
                  setConfigForm((prev) => ({ ...prev, user: event.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={configForm.password}
                onChange={(event) =>
                  setConfigForm((prev) => ({ ...prev, password: event.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                type="number"
                value={configForm.port}
                onChange={(event) =>
                  setConfigForm((prev) => ({ ...prev, port: event.target.value }))
                }
                min={1}
                max={65535}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={creatingConnection}>
                {creatingConnection ? "Connecting..." : "Save Connection"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Sources</CardTitle>
          <CardDescription>Select a connection and build the semantic catalog.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Label htmlFor="connection">Active connection</Label>
              <select
                id="connection"
                className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
                value={selectedConnectionId ?? ""}
                onChange={(event) => setSelectedConnectionId(event.target.value || null)}
              >
                <option value="">Select a connection</option>
                {connections.map((connection) => (
                  <option key={connection._id} value={connection._id}>
                    {connection.name}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={handleSync} disabled={!selectedConnectionId || syncing}>
              {syncing ? "Syncing..." : "Run Semantic Sync"}
            </Button>
          </div>
          {selectedConnection && (
            <div className="rounded-md border border-border/60 bg-muted/40 p-4 text-sm">
              <p className="font-medium">Status</p>
              <p>
                Last verified: {selectedConnection.lastVerifiedAt ? new Date(selectedConnection.lastVerifiedAt).toLocaleString() : "Never"}
              </p>
              {selectedConnection.lastError && (
                <p className="text-destructive">Last error: {selectedConnection.lastError}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ask your data</CardTitle>
          <CardDescription>Natural language questions generate SQL automatically.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="question">Question</Label>
            <textarea
              id="question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              className="min-h-[100px] w-full rounded-md border border-border bg-background p-3 text-sm"
              placeholder="e.g. Show total revenue per month for the last 12 months"
            />
          </div>
          <Button onClick={handleAsk} disabled={asking || !selectedConnectionId || !question.trim()}>
            {asking ? "Thinking..." : "Generate insight"}
          </Button>
          {result && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold">Summary</h3>
                <p className="text-sm text-muted-foreground">{result.rationale}</p>
              </div>
              <Separator />
              <div className="space-y-2 text-sm">
                <p className="font-medium">SQL</p>
                <pre className="whitespace-pre-wrap rounded-md border border-border/50 bg-muted/60 p-3 text-xs">
                  {result.sql}
                </pre>
                <p className="text-muted-foreground">Returned {result.rows.length} rows in {result.executionMs}ms.</p>
              </div>
              {result.chart && result.rows.length > 0 && (
                <ChartRenderer spec={result.chart} rows={result.rows} />
              )}
              {result.rows.length > 0 && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {result.columns.map((column) => (
                          <TableHead key={column} className="whitespace-nowrap">
                            {column}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.rows.slice(0, 50).map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {result.columns.map((column) => (
                            <TableCell key={column} className="whitespace-nowrap">
                              {formatCell(row[column])}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {result.followUpQuestions.length > 0 && (
                <div className="space-y-2 text-sm">
                  <p className="font-medium">Suggested follow-up questions</p>
                  <ul className="list-disc space-y-1 pl-4">
                    {result.followUpQuestions.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-md border border-border/50 bg-muted/40 p-3">
                <p className="mb-2 text-sm font-medium">Save to dashboard</p>
                <div className="grid gap-2 md:grid-cols-3">
                  <div>
                    <Label htmlFor="dash">Existing dashboard</Label>
                    <select
                      id="dash"
                      className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
                      value={saveDashboardId}
                      onChange={(e) => setSaveDashboardId(e.target.value)}
                    >
                      <option value="">(create new)</option>
                      {dashboards.map((d) => (
                        <option key={d._id} value={d._id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  {!saveDashboardId && (
                    <div>
                      <Label htmlFor="newdash">New dashboard name</Label>
                      <Input id="newdash" value={saveNewDashboard} onChange={(e) => setSaveNewDashboard(e.target.value)} placeholder="e.g. Sales Overview" />
                    </div>
                  )}
                  <div>
                    <Label htmlFor="title">Tile title</Label>
                    <Input id="title" value={saveTitle} onChange={(e) => setSaveTitle(e.target.value)} placeholder="Insight title" />
                  </div>
                </div>
                <div className="mt-3">
                  <Button onClick={handleSaveTile} disabled={saving}>
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatCell(value: unknown) {
  if (value == null) return "—";
  if (typeof value === "number") return value.toLocaleString();
  if (value instanceof Date) return value.toLocaleString();
  return String(value);
}
