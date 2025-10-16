import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getOrgConnection, listSemanticSyncRuns, listSyncStages } from "@/lib/convexServerClient";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ connectionId: string }> }
) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!orgId) {
    return NextResponse.json({ error: "Organization is required" }, { status: 400 });
  }

  const { connectionId } = await context.params;
  if (!connectionId) {
    return NextResponse.json({ error: "connectionId is required" }, { status: 422 });
  }

  const connection = await getOrgConnection({
    orgId,
    connectionId,
    includeConfig: false,
  });

  if (!connection) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  const runs = await listSemanticSyncRuns({ orgId, connectionId, limit: 5 });
  const runsWithStages = [] as any[];
  for (const run of (runs as any[])) {
    const stages = (typeof listSyncStages === "function")
      ? await listSyncStages(String(run._id ?? run.id))
      : [];
    runsWithStages.push({ ...run, stages });
  }

  return NextResponse.json({
    connection,
    runs: runsWithStages,
  });
}
