import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { sqlConnectionConfigSchema } from "@/lib/mssql";
import {
  createSyncRun,
  getOrgConnection,
  markSyncRunCompleted,
  markSyncRunFailed,
  markConnectionSyncRequested,
  recordConnectionVerification,
  upsertSemanticArtifact,
} from "@/lib/convexServerClient";

type SemanticSyncBody = {
  connectionId: string;
};

export async function POST(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!orgId) {
    return NextResponse.json({ error: "Organization is required" }, { status: 400 });
  }

  let body: SemanticSyncBody;
  try {
    body = (await request.json()) as SemanticSyncBody;
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.connectionId) {
    return NextResponse.json({ error: "connectionId is required" }, { status: 422 });
  }

  let stage: string = "get_connection";
  const connection = await getOrgConnection({
    orgId,
    connectionId: body.connectionId,
    includeConfig: true,
  });
  if (!connection || !("config" in connection) || !connection.config) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  stage = "validate_config";
  const configResult = sqlConnectionConfigSchema.safeParse(connection.config);
  if (!configResult.success) {
    return NextResponse.json(
      { error: "Stored connection configuration is invalid" },
      { status: 500 }
    );
  }

  stage = "mark_requested";
  await markConnectionSyncRequested({
    orgId,
    connectionId: body.connectionId,
    requestedAt: Date.now(),
  });

  stage = "create_run";
  const runId = await createSyncRun({ orgId, connectionId: body.connectionId });

  const origin = new URL(request.url).origin;
  // Kick off background execution via internal route secured by admin token
  fetch(`${origin}/api/semantic-sync/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Token": process.env.CONVEX_ADMIN_TOKEN || "",
    },
    body: JSON.stringify({ orgId, connectionId: body.connectionId, runId }),
    // Fire-and-forget
  }).catch((err) => {
    console.error("[semantic-sync] failed to dispatch background run", err);
  });

  return NextResponse.json({ success: true, runId }, { status: 202 });
}
