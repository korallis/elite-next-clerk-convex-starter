"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Audit = {
  createdAt: number;
  userId: string;
  connectionId: string;
  question: string;
  sql: string;
  rowCount: number;
  durationMs: number;
  status: "success" | "error";
  error?: string;
};

type Connection = { _id: string; name: string };

export default function AuditConsolePage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectionId, setConnectionId] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [user, setUser] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<{ series: Array<{ date: string; total: number; errors: number; limit: number }> } | null>(null);

  useEffect(() => {
    // Load connections for filter
    fetch("/api/data-sources")
      .then((r) => r.json())
      .then((data) => setConnections((data?.connections || []) as Connection[]))
      .catch(() => setConnections([]));
  }, []);

  async function load() {
    setLoading(true);
    try {
      const url = new URL("/api/metrics/audit", window.location.origin);
      if (connectionId) url.searchParams.set("connectionId", connectionId);
      if (status) url.searchParams.set("status", status);
      if (user) url.searchParams.set("user", user);
      if (from) url.searchParams.set("from", String(new Date(from).getTime()));
      if (to) url.searchParams.set("to", String(new Date(to).getTime()));
      const res = await fetch(url.toString());
      const data = await res.json();
      setAudits((data?.audits || []) as Audit[]);

      const usageRes = await fetch("/api/metrics/usage?days=14");
      setUsage(await usageRes.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function downloadCsv() {
    const url = new URL("/api/metrics/audit", window.location.origin);
    if (connectionId) url.searchParams.set("connectionId", connectionId);
    if (status) url.searchParams.set("status", status);
    if (user) url.searchParams.set("user", user);
    if (from) url.searchParams.set("from", String(new Date(from).getTime()));
    if (to) url.searchParams.set("to", String(new Date(to).getTime()));
    url.searchParams.set("format", "csv");
    window.location.href = url.toString();
  }

  return (
    <div className="space-y-6 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Audit Console</CardTitle>
          <CardDescription>Query logs, filters, export, and usage summary.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
            <div className="md:col-span-2">
              <Select value={connectionId} onValueChange={setConnectionId}>
                <SelectTrigger><SelectValue placeholder="Filter by connection" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All connections</SelectItem>
                  {connections.map((c) => (
                    <SelectItem key={c._id} value={String(c._id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Input placeholder="Filter by userId" value={user} onChange={(e) => setUser(e.target.value)} />
            </div>
            <div>
              <Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button onClick={load} disabled={loading}>Apply</Button>
              <Button variant="outline" onClick={downloadCsv}>Export CSV</Button>
            </div>
          </div>

          <div className="mt-4">
            <div className="text-xs text-muted-foreground">{audits.length} results</div>
            <div className="mt-2 max-h-[420px] overflow-auto rounded border border-border/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-xs text-muted-foreground">
                    <th className="p-2 text-left">When</th>
                    <th className="p-2 text-left">User</th>
                    <th className="p-2 text-left">Connection</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Rows</th>
                    <th className="p-2 text-left">ms</th>
                    <th className="p-2 text-left">Question</th>
                  </tr>
                </thead>
                <tbody>
                  {audits.map((a, i) => (
                    <tr key={i} className="border-t border-border/40">
                      <td className="p-2">{new Date(a.createdAt).toLocaleString()}</td>
                      <td className="p-2">{a.userId}</td>
                      <td className="p-2 text-xs">{a.connectionId}</td>
                      <td className="p-2">{a.status}</td>
                      <td className="p-2">{a.rowCount}</td>
                      <td className="p-2">{a.durationMs}</td>
                      <td className="p-2 truncate max-w-[420px]">{a.question}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {usage && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold">Usage (last {usage.series.length} days)</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {usage.series.map((d) => (
                  <div key={d.date} className="rounded border border-border/60 p-2 text-xs">
                    <div className="font-medium">{d.date}</div>
                    <div>Total: {d.total}</div>
                    <div>Errors: {d.errors}</div>
                    <div>Daily limit: {d.limit}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
