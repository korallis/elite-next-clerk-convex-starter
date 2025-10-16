import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getConvexClient, listOrgConnections } from "@/lib/convexServerClient";
import { api } from "@/convex/_generated/api";
import { sqlConnectionConfigSchema, withSqlPool, executeReadOnlyQueryWithRetry } from "@/lib/mssql";
import crypto from "crypto";
import { getOrgConnection } from "@/lib/convexServerClient";

export async function GET(request: Request, ctx: { params: Promise<{ tileId: string }> }) {
  const { tileId } = await ctx.params;
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: "Organization is required" }, { status: 400 });

  const convex = getConvexClient();
  const convexApi = api as any;
  const tile = await convex.query(convexApi["dashboards.getTile"].getTile, {
    adminToken: process.env.CONVEX_ADMIN_TOKEN!,
    tileId: tileId as any,
  });
  if (!tile || tile.orgId !== orgId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(request.url);
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");
  const dimension = url.searchParams.get("dimension");

  let connectionId = tile.connectionId as string | undefined;
  if (!connectionId) {
    const conns = await listOrgConnections(orgId);
    if (!conns || conns.length === 0) return NextResponse.json({ error: "No connections" }, { status: 400 });
    connectionId = conns[0]._id;
  }

  const conn = await getOrgConnection({ orgId, connectionId, includeConfig: true });
  if (!conn || !("config" in conn) || !conn.config) return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  const cfg = sqlConnectionConfigSchema.parse(conn.config);

  const params: Record<string, unknown> = {};
  if (startDate) params["start_date"] = new Date(startDate);
  if (endDate) params["end_date"] = new Date(endDate);
  if (dimension) params["dimension"] = dimension;

  // Simple in-process cache keyed by tile+params for limited TTL
  const ttlMs = parseInt(process.env.NEXT_PUBLIC_DASH_CACHE_TTL_MS || "300000", 10); // default 5m
  const cacheKey = (() => {
    const key = JSON.stringify({ tileId, startDate, endDate, dimension });
    return crypto.createHash("sha256").update(key).digest("hex");
  })();
  const now = Date.now();
  // @ts-ignore augment module-local cache
  global.__TILE_CACHE__ = global.__TILE_CACHE__ || new Map<string, { ts: number; payload: any }>();
  // @ts-ignore
  const cache: Map<string, { ts: number; payload: any }> = global.__TILE_CACHE__;
  const hit = cache.get(cacheKey);
  if (hit && now - hit.ts < ttlMs) {
    return NextResponse.json(hit.payload);
  }

  const start = now;
  try {
    const result = await withSqlPool(cfg, (pool) => executeReadOnlyQueryWithRetry(pool, tile.sql, params, { maxRows: 5000, retries: 2 }));
    const durationMs = Date.now() - start;
    // Record audit for freshness tracking
    await convex.mutation(api.queryAudits.record, {
      adminToken: process.env.CONVEX_ADMIN_TOKEN!,
      orgId,
      connectionId: connectionId as any,
      userId,
      question: `DASHBOARD_TILE:${tileId}`,
      sql: tile.sql,
      rowCount: result.recordset.length,
      durationMs,
      status: "success",
    });
    const payload = {
      rows: result.recordset,
      columns: result.recordset.length
        ? Object.keys(result.recordset[0] as Record<string, unknown>)
        : [],
    };
    cache.set(cacheKey, { ts: Date.now(), payload });
    return NextResponse.json(payload);
  } catch (error) {
    await convex.mutation(api.queryAudits.record, {
      adminToken: process.env.CONVEX_ADMIN_TOKEN!,
      orgId,
      connectionId: connectionId as any,
      userId,
      question: `DASHBOARD_TILE:${tileId}`,
      sql: tile.sql,
      rowCount: 0,
      durationMs: 0,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Query failed" }, { status: 502 });
  }
}
