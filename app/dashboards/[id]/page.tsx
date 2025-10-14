"use client";

import { useEffect, useState } from "react";
import { ChartRenderer } from "@/components/dashboard/ChartRenderer";
import { Button } from "@/components/ui/button";

export default function DashboardPage({ params }: { params: { id: string } }) {
  const [tiles, setTiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboards/${params.id}`);
      if (!res.ok) throw new Error("Failed to load dashboard");
      const data = await res.json();
      setTiles(data.tiles ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [params.id]);

  async function deleteTile(tileId: string) {
    await fetch(`/api/dashboards/tiles/${tileId}/delete`, { method: "POST" });
    await load();
  }

  if (loading) return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;
  if (error) return <div className="p-4 text-sm text-destructive">{error}</div>;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <Button variant="secondary" onClick={() => setEdit((e) => !e)}>{edit ? "Done" : "Edit"}</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tiles.map((tile) => {
          const spec = safeParse(tile.chartSpec);
          return (
            <div key={tile._id} className="relative rounded-lg border border-border/50 bg-card p-4">
              {edit && (
                <button
                  className="absolute right-2 top-2 rounded bg-destructive px-2 py-1 text-xs text-white"
                  onClick={() => deleteTile(tile._id)}
                >
                  Delete
                </button>
              )}
              <h3 className="mb-2 text-sm font-semibold">{tile.title}</h3>
              <ChartRenderer spec={spec} rows={[]} />
              <pre className="mt-2 line-clamp-3 whitespace-pre-wrap break-all text-xs text-muted-foreground">
                {tile.sql}
              </pre>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function safeParse(text: string) {
  try { return JSON.parse(text); } catch { return { type: "table" }; }
}
