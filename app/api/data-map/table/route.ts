import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getConvexClient } from "@/lib/convexServerClient";
import { api } from "@/convex/_generated/api";
import { listSemanticSyncRuns } from "@/lib/convexServerClient";

export async function GET(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: "Organization is required" }, { status: 400 });

  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  const connectionId = url.searchParams.get("connectionId");
  if (!key || !connectionId) return NextResponse.json({ error: "key and connectionId required" }, { status: 422 });

  const convex = getConvexClient();
  const artifacts = await convex.query(api.semanticArtifacts.listByConnection, {
    adminToken: process.env.CONVEX_ADMIN_TOKEN!,
    orgId,
    connectionId: connectionId as any,
  });
  const table = artifacts.find((a: any) => a.artifactType === "table" && a.artifactKey.toLowerCase() === key.toLowerCase());
  if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 });

  const columns = artifacts.filter((a: any) => a.artifactType === "column" && String(a.artifactKey).toLowerCase().startsWith(`${key.toLowerCase()}.`));
  const fks = artifacts.filter((a: any) => a.artifactType === "foreign_key" && String(a.payload?.sourceTable)?.toLowerCase() === key.toLowerCase());

  const runs = await listSemanticSyncRuns({ orgId, connectionId });
  const latestRun = Array.isArray(runs) && runs.length ? runs[0] : null;
  const staleThreshold = 72 * 60 * 60 * 1000;
  const isStale = latestRun ? (Date.now() - (latestRun.completedAt || latestRun.startedAt)) > staleThreshold : true;

  return NextResponse.json({
    table: table.payload,
    columns: columns.map((c: any) => ({ key: c.artifactKey, ...c.payload })),
    foreignKeys: fks.map((f: any) => f.payload),
    lastSyncAt: latestRun?.completedAt || latestRun?.startedAt || null,
    isStale,
  });
}
