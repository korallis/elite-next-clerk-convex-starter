"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function DashboardsIndex() {
  const [items, setItems] = useState<Array<{ _id: string; name: string }>>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboards");
      if (!res.ok) throw new Error("Failed to load dashboards");
      const data = await res.json();
      setItems(data.dashboards ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!name.trim()) return;
    await fetch("/api/dashboards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) });
    setName("");
    await load();
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-semibold">Dashboards</h1>
      <div className="flex gap-2">
        <Input placeholder="New dashboard name" value={name} onChange={(e) => setName(e.target.value)} />
        <Button onClick={create}>Create</Button>
      </div>
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!loading && items.length === 0 && (
        <div className="rounded-md border border-dashed border-border/50 bg-muted/40 p-4 text-sm text-muted-foreground">
          No dashboards yet. Create one above or pin insights from the Ask panel.
        </div>
      )}
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((d) => (
          <li key={d._id} className="rounded-lg border border-border/50 bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="font-medium">{d.name}</div>
              <Button asChild size="sm" variant="outline">
                <Link href={`/dashboards/${d._id}`}>Open</Link>
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
