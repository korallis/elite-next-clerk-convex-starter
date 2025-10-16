import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { withSqlPool, sqlConnectionConfigSchema, executeReadOnlyQuery } from "@/lib/mssql";
import { getOrgConnection } from "@/lib/convexServerClient";

type Tile = { title: string; sql: string; chart?: unknown };
type Body = { connectionId: string; tiles: Tile[]; maxRows?: number };

export async function POST(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: "Organization is required" }, { status: 400 });

  let body: Body;
  try { body = (await request.json()) as Body; } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  if (!body.connectionId || !Array.isArray(body.tiles)) return NextResponse.json({ error: "connectionId and tiles are required" }, { status: 422 });

  const conn = await getOrgConnection({ orgId, connectionId: body.connectionId, includeConfig: true });
  if (!conn || !("config" in conn) || !conn.config) return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  const cfg = sqlConnectionConfigSchema.parse(conn.config);

  const maxRows = Math.min(Math.max(body.maxRows ?? 100, 1), 500);
  const results: Array<{ title: string; ok: boolean; error?: string; columns?: string[]; rowCount?: number; executionMs?: number }> = [];
  await withSqlPool(cfg, async (pool) => {
    for (const tile of body.tiles) {
      const start = Date.now();
      try {
        const res = await executeReadOnlyQuery(pool, tile.sql, {}, { maxRows });
        const rows = (res.recordset as any[]) || [];
        const columns = rows.length ? Object.keys(rows[0]) : [];
        results.push({ title: tile.title, ok: true, columns, rowCount: rows.length, executionMs: Date.now() - start });
      } catch (e: any) {
        results.push({ title: tile.title, ok: false, error: e?.message || String(e) });
      }
    }
  });

  return NextResponse.json({ success: true, results });
}
