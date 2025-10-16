"use client"

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

type Connection = { _id: string; name: string };
type Tile = { title: string; sql: string; chart?: any };

export default function AutoDashboardClient() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectionId, setConnectionId] = useState<string>("");
  const [prompt, setPrompt] = useState<string>("");
  const [name, setName] = useState<string>("Insights");
  const [loading, setLoading] = useState(false);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [validation, setValidation] = useState<Record<number, { ok: boolean; error?: string; columns?: string[]; rowCount?: number; executionMs?: number }>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/data-sources")
      .then((r) => r.json())
      .then((d) => {
        const list: Connection[] = d.connections ?? [];
        setConnections(list);
        if (list.length > 0) setConnectionId((list[0] as any)._id ?? (list[0] as any).id);
      })
      .catch(() => {});
  }, []);

  const canGenerate = !!connectionId && prompt.trim().length > 0 && !loading;
  const canSave = !!connectionId && tiles.length > 0 && !loading;

  const dedupedTiles = useMemo(() => dedupeTiles(tiles), [tiles]);

  async function handlePreview() {
    if (!canGenerate) return;
    setLoading(true);
    setError(null);
    setTiles([]);
    setValidation({});
    try {
      const r = await fetch("/api/ai/auto-dashboard/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await r.json();
      if (!r.ok || !data?.success) throw new Error(data?.error || "Preview failed");
      const spec = data.spec as { title: string; tiles: Tile[] };
      setName(spec.title || name);
      setTiles(spec.tiles || []);
    } catch (e: any) {
      setError(e?.message || "Preview failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleValidate() {
    if (!connectionId || tiles.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/ai/auto-dashboard/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, tiles: dedupedTiles, maxRows: 200 }),
      });
      const data = await r.json();
      if (!r.ok || !data?.success) throw new Error(data?.error || "Validation failed");
      const results = data.results as any[];
      const map: Record<number, any> = {};
      results.forEach((res, i) => (map[i] = res));
      setValidation(map);
    } catch (e: any) {
      setError(e?.message || "Validation failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!canSave) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/ai/auto-dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, prompt, name, tiles: dedupedTiles }),
      });
      const data = await r.json();
      if (!r.ok || !data?.success) throw new Error(data?.error || "Save failed");
      setTiles([]);
      setValidation({});
      alert("Dashboard created");
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setLoading(false);
    }
  }

  const setTile = (idx: number, patch: Partial<Tile>) => {
    setTiles((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  };

  const removeTile = (idx: number) => {
    setTiles((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Auto‑Dashboard</CardTitle>
          <CardDescription>Generate a dashboard from a prompt, validate tiles, edit, then save.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && <div className="text-sm text-destructive">{error}</div>}
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <div className="text-xs text-muted-foreground">Connection</div>
              <Select value={connectionId} onValueChange={setConnectionId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select data source" /></SelectTrigger>
                <SelectContent>
                  {connections.map((c) => (
                    <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Dashboard name</div>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sales Overview" />
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Prompt</div>
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe the dashboard you want..." />
          </div>
          <div className="flex gap-2">
            <Button disabled={!canGenerate} onClick={handlePreview}>{loading ? "Working..." : "Preview"}</Button>
            <Button variant="outline" disabled={tiles.length === 0 || loading} onClick={handleValidate}>Validate</Button>
            <Button variant="secondary" disabled={!canSave} onClick={handleSave}>Save dashboard</Button>
          </div>
        </CardContent>
      </Card>

      {dedupedTiles.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {dedupedTiles.map((t, idx) => (
            <Card key={idx} className="overflow-hidden">
              <CardHeader>
                <CardTitle className="text-base">Tile {idx + 1}</CardTitle>
                <CardDescription>{validation[idx]?.ok ? `OK • ${validation[idx]?.rowCount ?? 0} rows` : validation[idx] ? `Error • ${validation[idx].error}` : "Not validated"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Input value={t.title} onChange={(e) => setTile(idx, { title: e.target.value })} placeholder="Title" />
                <div className="grid grid-cols-2 gap-2">
                  <Select value={(t.chart?.type as string) || "table"} onValueChange={(v) => setTile(idx, { chart: { ...(t.chart || {}), type: v } })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['table','line','bar','area','pie','number'].map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="destructive" onClick={() => removeTile(idx)}>Remove</Button>
                </div>
                <Textarea value={t.sql} onChange={(e) => setTile(idx, { sql: e.target.value })} className="min-h-[120px] font-mono text-xs" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function dedupeTiles(tiles: Tile[]): Tile[] {
  const seen = new Set<string>();
  const out: Tile[] = [];
  for (const t of tiles) {
    const key = `${(t.title || "").toLowerCase()}|${(t.sql || "").trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...t, chart: t.chart || { type: "table" } });
  }
  return out;
}
