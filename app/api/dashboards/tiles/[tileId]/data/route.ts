import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getConvexClient, listOrgConnections } from "@/lib/convexServerClient";
import { api } from "@/convex/_generated/api";
import { sqlConnectionConfigSchema, withSqlPool, executeReadOnlyQuery } from "@/lib/mssql";
import { getOrgConnection } from "@/lib/convexServerClient";

export async function GET(_: Request, { params }: { params: { tileId: string } }) {
  const { userId, orgId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: "Organization is required" }, { status: 400 });

  const convex = getConvexClient();
  const tile = await convex.query(api["dashboards.getTile"].getTile as any, {
    adminToken: process.env.CONVEX_ADMIN_TOKEN!,
    tileId: params.tileId as any,
  });
  if (!tile || tile.orgId !== orgId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let connectionId = tile.connectionId as string | undefined;
  if (!connectionId) {
    const conns = await listOrgConnections(orgId);
    if (!conns || conns.length === 0) return NextResponse.json({ error: "No connections" }, { status: 400 });
    connectionId = conns[0]._id;
  }

  const conn = await getOrgConnection({ orgId, connectionId, includeConfig: true });
  if (!conn || !("config" in conn) || !conn.config) return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  const cfg = sqlConnectionConfigSchema.parse(conn.config);

  const result = await withSqlPool(cfg, (pool) => executeReadOnlyQuery(pool, tile.sql, {}, { maxRows: 5000 }));
  return NextResponse.json({
    rows: result.recordset,
    columns: result.recordset.length ? Object.keys(result.recordset[0]) : [],
  });
}
