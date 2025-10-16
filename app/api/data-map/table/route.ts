import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getConvexClient, listSemanticSyncRuns } from "@/lib/convexServerClient";
import { api } from "@/convex/_generated/api";

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
  const table = artifacts.find((a: any) => a.artifactType === "table" && String(a.artifactKey).toLowerCase() === key.toLowerCase());
  if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 });

  const columnArtifacts = artifacts.filter((a: any) => a.artifactType === "column" && String(a.artifactKey).toLowerCase().startsWith(`${key.toLowerCase()}.`));

  // Columns: prefer table payload columns (name, dataType) and enrich with sampleValues from column artifacts
  const tablePayload = table.payload || {};
  const tableColumns = Array.isArray(tablePayload.columns) ? tablePayload.columns : [];
  const samplesByName = new Map<string, string[]>();
  for (const c of columnArtifacts) {
    const name = c?.payload?.column?.name;
    const values = c?.payload?.column?.sampleValues;
    if (typeof name === "string" && Array.isArray(values)) {
      samplesByName.set(name, values.slice(0, 5));
    }
  }
  const columns = tableColumns.map((c: any) => ({
    key: `${key}.${c.name}`,
    name: c.name,
    dataType: c.dataType,
    sampleValues: samplesByName.get(c.name) ?? [],
  }));

  const runs = await listSemanticSyncRuns({ orgId, connectionId });
  const latestRun = Array.isArray(runs) && runs.length ? runs[0] : null;
  const staleThreshold = 72 * 60 * 60 * 1000;
  const isStale = latestRun ? (Date.now() - (latestRun.completedAt || latestRun.startedAt)) > staleThreshold : true;

  return NextResponse.json({
    key,
    schema: tablePayload.schema,
    name: tablePayload.name,
    rowCount: tablePayload.rowCount ?? null,
    description: tablePayload.description ?? null,
    businessQuestions: Array.isArray(tablePayload.businessQuestions) ? tablePayload.businessQuestions : [],
    columns,
    foreignKeys: Array.isArray(tablePayload.foreignKeys) ? tablePayload.foreignKeys : [],
    lastSyncAt: latestRun?.completedAt || latestRun?.startedAt || null,
    isStale,
  });
}
