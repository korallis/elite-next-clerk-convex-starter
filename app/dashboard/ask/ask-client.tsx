"use client"

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

type Connection = { _id: string; name: string };

type QueryResponse = {
  success?: boolean;
  sql?: string;
  rationale?: string;
  chart?: any;
  rows?: any[];
  columns?: string[];
  rowCount?: number;
  executionMs?: number;
  error?: string;
  details?: string;
};

export default function AskClient() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectionId, setConnectionId] = useState<string>("");
  const [question, setQuestion] = useState("");
  const [stream, setStream] = useState(true);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<{ sql?: string; rationale?: string; chart?: any } | null>(null);
  const [result, setResult] = useState<{ columns: string[]; rows: any[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fbAck, setFbAck] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    fetch("/api/data-sources").then(async (r) => {
      const data = await r.json();
      const list: Connection[] = (data.connections ?? []) as any;
      setConnections(list);
      if (list.length > 0) setConnectionId((list[0] as any)._id ?? (list[0] as any).id);
    });
    return () => { esRef.current?.close(); };
  }, []);

  const canRun = connectionId && question.trim().length > 0 && !loading;

  const runQuery = async () => {
    setLoading(true);
    setError(null);
    setDraft(null);
    setResult(null);

    if (stream) {
      const url = `/api/ai/query/stream?connectionId=${encodeURIComponent(connectionId)}&question=${encodeURIComponent(question)}`;
      const es = new EventSource(url, { withCredentials: true } as any);
      esRef.current = es;
      es.addEventListener("draft", (e: MessageEvent) => {
        try { setDraft(JSON.parse(e.data)); } catch {}
      });
      es.addEventListener("result", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setResult({ columns: data.columns ?? [], rows: data.rows ?? [] });
        } catch {}
      });
      es.addEventListener("error", (e: MessageEvent) => {
        try { const d = JSON.parse(e.data); setError(d.message || "Stream error"); } catch { setError("Stream error"); }
        es.close();
        setLoading(false);
      });
      es.addEventListener("done", () => {
        es.close();
        setLoading(false);
      });
      return;
    }

    try {
      const resp = await fetch("/api/ai/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, question }),
      });
      const data = (await resp.json()) as QueryResponse;
      if (!resp.ok || !data.success) throw new Error(data.error || data.details || "Query failed");
      setDraft({ sql: data.sql, rationale: data.rationale, chart: data.chart });
      setResult({ columns: data.columns || [], rows: data.rows || [] });
    } catch (err: any) {
      setError(err?.message || "Query failed");
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async (type: "wrongTable" | "wrongJoin" | "wrongResult") => {
    try {
      await fetch("/api/metrics/stakeholder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "ask_feedback", type, question }),
      });
      setFbAck("Thanks for the feedback");
      setTimeout(() => setFbAck(null), 1500);
    } catch {}
  };

  const exportCsv = () => {
    if (!result) return;
    const rows = result.rows;
    const cols = result.columns;
    const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => formatCsv(r[c])).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `result-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pinToDashboard = async () => {
    if (!draft?.sql) return;
    const title = prompt("Tile title:", question.slice(0, 60)) || "Untitled";
    const dashboardName = prompt("Dashboard name (leave blank to add to existing by ID)", "Insights");
    const body: any = {
      title,
      sql: draft.sql,
      chartSpec: draft.chart || { type: "table" },
      connectionId,
    };
    if (dashboardName) body.newDashboardName = dashboardName;
    const resp = await fetch("/api/dashboards/save-tile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!resp.ok) {
      const t = await resp.text();
      alert(`Save failed: ${t}`);
    } else {
      alert("Pinned to dashboard");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Ask</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex gap-2 items-center">
            <Select value={connectionId} onValueChange={setConnectionId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select data source" />
              </SelectTrigger>
              <SelectContent>
                {connections.map((c) => (
                  <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch checked={stream} onCheckedChange={setStream} id="stream-toggle" />
              <label htmlFor="stream-toggle" className="text-sm text-muted-foreground">Stream</label>
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question about your data"
              onKeyDown={(e) => { if (e.key === "Enter" && canRun) runQuery(); }}
            />
            <Button disabled={!canRun} onClick={runQuery}>{loading ? "Running..." : "Run"}</Button>
            <Button variant="outline" disabled={!result} onClick={exportCsv}>Export CSV</Button>
            <Button variant="secondary" disabled={!draft?.sql} onClick={pinToDashboard}>Pin</Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/50">
          <CardHeader><CardTitle className="text-destructive">Error</CardTitle></CardHeader>
          <CardContent><pre className="text-sm whitespace-pre-wrap">{error}</pre></CardContent>
        </Card>
      )}

      {draft?.sql && (
        <Card>
          <CardHeader><CardTitle>SQL</CardTitle></CardHeader>
          <CardContent>
            <pre className="text-xs overflow-auto p-2 bg-muted rounded-md max-h-64">{draft.sql}</pre>
            <div className="flex gap-3 text-xs mt-2">
              <button className="underline" onClick={() => submitFeedback("wrongTable")}>Wrong table</button>
              <button className="underline" onClick={() => submitFeedback("wrongJoin")}>Wrong join</button>
              <button className="underline" onClick={() => submitFeedback("wrongResult")}>Wrong result</button>
              {fbAck && <span className="text-muted-foreground">{fbAck}</span>}
            </div>
            {draft.rationale && <p className="text-sm text-muted-foreground mt-2">{draft.rationale}</p>}
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader><CardTitle>Results ({result.rows.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>{result.columns.map((c) => (<th key={c} className="border px-2 py-1 text-left bg-muted/50">{c}</th>))}</tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} className="odd:bg-muted/20">
                      {result.columns.map((c) => (<td key={c} className="border px-2 py-1">{formatCell(row[c])}</td>))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatCell(v: any) {
  if (v == null) return "";
  if (typeof v === "number") return v.toString();
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function formatCsv(v: any) {
  const s = formatCell(v);
  if (s.includes(",") || s.includes("\n") || s.includes("\"")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
