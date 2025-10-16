"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChartRenderer } from "@/components/dashboard/ChartRenderer";
import { Button } from "@/components/ui/button";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type DashboardClientProps = {
  id: string;
};

export function DashboardClient({ id }: DashboardClientProps) {
  const [tiles, setTiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState(false);
  const [filters, setFilters] = useState({ startDate: "", endDate: "", dimension: "" });
  const [shareOpen, setShareOpen] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor));

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboards/${id}`);
      if (!res.ok) throw new Error("Failed to load dashboard");
      const data = await res.json();
      setTiles(data.tiles ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function deleteTile(tileId: string) {
    await fetch(`/api/dashboards/tiles/${tileId}/delete`, { method: "POST" });
    await load();
  }

  if (loading) return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;
  if (error) return <div className="p-4 text-sm text-destructive">{error}</div>;

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = tiles.findIndex((t) => t._id === active.id);
    const newIndex = tiles.findIndex((t) => t._id === over.id);
    const newTiles = arrayMove(tiles, oldIndex, newIndex).map((t, idx) => ({ ...t, order: idx }));
    setTiles(newTiles);
    // Persist order
    fetch(`/api/dashboards/${id}/layout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates: newTiles.map((t: any, idx: number) => ({ tileId: t._id, order: idx })) }),
    }).catch(() => {/* ignore */});
  }

  async function updateSize(tileId: string, w: number, h: number) {
    await fetch(`/api/dashboards/${id}/layout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates: [{ tileId, w, h }] }),
    });
    await load();
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShareOpen(true)}>Share</Button>
          <Button variant="secondary" onClick={() => setEdit((e) => !e)}>{edit ? "Done" : "Edit"}</Button>
        </div>
      </div>
      {shareOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-border/50 bg-background p-4 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Share dashboard</h2>
              <button className="text-xs text-muted-foreground" onClick={() => setShareOpen(false)}>Close</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="rounded border border-dashed border-border/50 p-3 text-xs text-muted-foreground">
                Role-based access via Clerk is enforced on server routes. External link sharing will be added next.
              </div>
              <div className="grid gap-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked readOnly /> Viewer access (org)
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked readOnly /> Member access (org)
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked readOnly /> Admin access (org)
                </label>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground">Share link</label>
                <input className="mt-1 w-full rounded-md border border-border bg-muted/40 p-2 text-xs" readOnly value={typeof window !== 'undefined' ? window.location.href : ''} />
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Global filters */}
      <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="block text-xs text-muted-foreground">Start date</label>
            <input type="date" value={filters.startDate} onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))} className="mt-1 w-full rounded-md border border-border bg-background p-2" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground">End date</label>
            <input type="date" value={filters.endDate} onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))} className="mt-1 w-full rounded-md border border-border bg-background p-2" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-muted-foreground">Dimension value (used as @dimension)</label>
            <input type="text" placeholder="e.g. UK" value={filters.dimension} onChange={(e) => setFilters((f) => ({ ...f, dimension: e.target.value }))} className="mt-1 w-full rounded-md border border-border bg-background p-2" />
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Tiles can reference @start_date, @end_date, and @dimension parameters in SQL.</p>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <SortableContext items={tiles.map((t) => t._id)} strategy={verticalListSortingStrategy}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tiles.map((tile) => (
              <SortableTile key={tile._id} id={tile._id}>
                <div className="relative rounded-lg border border-border/50 bg-card p-4" style={{ gridColumn: `span ${Math.min(tile.w ?? 1, 3)} / span ${Math.min(tile.w ?? 1, 3)}` }}>
                  {edit && (
                    <button
                      className="absolute right-2 top-2 rounded bg-destructive px-2 py-1 text-xs text-white"
                      onClick={() => deleteTile(tile._id)}
                    >
                      Delete
                    </button>
                  )}
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">{tile.title}</h3>
                    <span className="text-[11px] text-muted-foreground">{tile.lastRefreshedAt ? `Last run: ${new Date(tile.lastRefreshedAt).toLocaleString()}` : "Not run yet"}</span>
                  </div>
                  {edit && (
                    <div className="mb-2 flex items-center gap-2 text-xs">
                      <label>W</label>
                      <select className="rounded border border-border bg-background p-1" value={tile.w ?? 1} onChange={(e) => updateSize(tile._id, Number(e.target.value), tile.h ?? 1)}>
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                      </select>
                      <label>H</label>
                      <select className="rounded border border-border bg-background p-1" value={tile.h ?? 1} onChange={(e) => updateSize(tile._id, tile.w ?? 1, Number(e.target.value))}>
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                      </select>
                    </div>
                  )}
                  <TileData tileId={tile._id} spec={safeParse(tile.chartSpec)} filters={filters} heightUnits={tile.h ?? 1} />
                  <pre className="mt-2 line-clamp-3 whitespace-pre-wrap break-all text-xs text-muted-foreground">{tile.sql}</pre>
                </div>
              </SortableTile>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function safeParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return { type: "table" };
  }
}

function TileData({ tileId, spec, filters, heightUnits }: { tileId: string; spec: any; filters: { startDate: string; endDate: string; dimension: string }; heightUnits: number }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    const qs = new URLSearchParams();
    if (filters.startDate) qs.set("startDate", filters.startDate);
    if (filters.endDate) qs.set("endDate", filters.endDate);
    if (filters.dimension) qs.set("dimension", filters.dimension);
    fetch(`/api/dashboards/tiles/${tileId}/data?${qs.toString()}`).then(async (r) => {
      if (!alive) return;
      if (!r.ok) {
        setLoading(false);
        return;
      }
      const data = await r.json();
      setRows(data.rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [tileId, filters.startDate, filters.endDate, filters.dimension]);
  const heightPx = 320 * Math.max(1, heightUnits || 1);
  if (loading) return <div className="w-full text-xs text-muted-foreground" style={{ height: heightPx }}>Loading…</div>;
  return (
    <div style={{ height: heightPx }}>
      <ChartRenderer spec={spec} rows={rows} />
    </div>
  );
}

function SortableTile({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  } as React.CSSProperties;
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}
