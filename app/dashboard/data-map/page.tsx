"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Result = { id: string; type: string; key: string; payload: any };

export default function DataMapPage() {
  const [q, setQ] = useState("");
  const [connectionId, setConnectionId] = useState<string>("");
  const [results, setResults] = useState<Result[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [detail, setDetail] = useState<any | null>(null);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    // Attempt to read connectionId from URL (optional)
    const url = new URL(window.location.href);
    const cid = url.searchParams.get("connectionId") || "";
    if (cid) setConnectionId(cid);
  }, []);

  async function onSearch(e?: React.FormEvent) {
    e?.preventDefault();
    setStatus("Searching…");
    try {
      const url = new URL("/api/data-map/search", window.location.origin);
      url.searchParams.set("q", q);
      if (connectionId) url.searchParams.set("connectionId", connectionId);
      const res = await fetch(url.toString());
      const data = await res.json();
      setResults(data.results || []);
    } finally {
      setStatus("");
    }
  }

  async function loadDetails(key: string) {
    setSelectedKey(key);
    setDetail(null);
    setStatus("Loading…");
    try {
      const url = new URL("/api/data-map/table", window.location.origin);
      url.searchParams.set("key", key);
      if (connectionId) url.searchParams.set("connectionId", connectionId);
      const res = await fetch(url.toString());
      const data = await res.json();
      setDetail(data);
    } finally {
      setStatus("");
    }
  }

  return (
    <div className="space-y-6 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Data Map</CardTitle>
          <CardDescription>Search tables and explore relationships.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex gap-2" onSubmit={onSearch}>
            <Input placeholder="Search tables or columns" value={q} onChange={(e) => setQ(e.target.value)} />
            <Button type="submit">Search</Button>
          </form>
          {status && <p className="mt-2 text-xs text-muted-foreground">{status}</p>}
          <div className="mt-4 grid gap-2">
            {results.map((r) => (
              <button key={r.id} onClick={() => loadDetails(r.key)} className="rounded border border-border/60 bg-muted/30 p-2 text-left text-sm hover:bg-muted/50">
                <span className="mr-2 rounded bg-muted px-1 py-0.5 text-[10px] uppercase text-muted-foreground">{r.type}</span>
                {r.key}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedKey && (
        <Card>
          <CardHeader>
            <CardTitle>Table: {selectedKey}</CardTitle>
            {detail?.isStale && <CardDescription className="text-destructive">Semantic sync is stale. Consider rerunning.</CardDescription>}
            {detail?.lastSyncAt && <CardDescription>Last sync: {new Date(detail.lastSyncAt).toLocaleString()}</CardDescription>}
          </CardHeader>
          <CardContent>
            {!detail && <div className="text-sm text-muted-foreground">{status || "Loading…"}</div>}
            {detail && (
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Columns</h3>
                  <div className="max-h-[320px] overflow-auto rounded border border-border/60">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/40 text-xs text-muted-foreground"><th className="p-2 text-left">Name</th><th className="p-2 text-left">Type</th><th className="p-2 text-left">Samples</th></tr>
                      </thead>
                      <tbody>
                        {detail.columns?.map((c: any) => (
                          <tr key={c.key} className="border-t border-border/40">
                            <td className="p-2">{c.name}</td>
                            <td className="p-2">{c.dataType}</td>
                            <td className="p-2 text-xs text-muted-foreground">{(c.sampleValues || []).slice(0,3).join(", ")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Relationships</h3>
                  {detail.foreignKeys?.length ? (
                    <ul className="space-y-1 text-sm">
                      {detail.foreignKeys.map((fk: any, i: number) => (
                        <li key={i} className="rounded border border-border/60 bg-muted/30 p-2">
                          {fk.sourceColumn} → {fk.targetTable}.{fk.targetColumn}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No relationships found.</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
