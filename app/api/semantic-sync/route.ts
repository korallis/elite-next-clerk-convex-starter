import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { sqlConnectionConfigSchema } from "@/lib/mssql";
import { generateSemanticSnapshot } from "@/lib/semantic";
import {
  createSyncRun,
  getOrgConnection,
  markSyncRunCompleted,
  markSyncRunFailed,
  recordConnectionVerification,
  upsertSemanticArtifact,
} from "@/lib/convexServerClient";

type SemanticSyncBody = {
  connectionId: string;
};

export async function POST(request: Request) {
  const { userId, orgId } = auth();
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

  const connection = await getOrgConnection({
    orgId,
    connectionId: body.connectionId,
    includeConfig: true,
  });
  if (!connection || !("config" in connection) || !connection.config) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  const configResult = sqlConnectionConfigSchema.safeParse(connection.config);
  if (!configResult.success) {
    return NextResponse.json(
      { error: "Stored connection configuration is invalid" },
      { status: 500 }
    );
  }

  const runId = await createSyncRun({ orgId, connectionId: body.connectionId });

  try {
    const { snapshot, embeddings } = await generateSemanticSnapshot(
      orgId,
      configResult.data
    );
    const version = snapshot.generatedAt;

    for (const table of snapshot.tables) {
      await upsertSemanticArtifact({
        orgId,
        connectionId: body.connectionId,
        artifactType: "table",
        artifactKey: table.key,
        version,
        payload: {
          schema: table.schema,
          name: table.name,
          rowCount: table.rowCount,
          description: table.description ?? null,
          businessQuestions: table.businessQuestions ?? [],
          columns: table.columns,
          foreignKeys: table.foreignKeys,
        },
        embeddingId:
          embeddings.find(
            (item) =>
              item.artifactType === "table" && item.artifactKey === table.key
          )?.embeddingId ?? null,
      });

      for (const column of table.columns) {
        const columnKey = `${table.key}.${column.name}`;
        await upsertSemanticArtifact({
          orgId,
          connectionId: body.connectionId,
          artifactType: "column",
          artifactKey: columnKey,
          version,
          payload: {
            schema: table.schema,
            table: table.name,
            column,
          },
          embeddingId:
            embeddings.find(
              (item) =>
                item.artifactType === "column" && item.artifactKey === columnKey
            )?.embeddingId ?? null,
        });
      }
    }

    await markSyncRunCompleted(runId);
    await recordConnectionVerification({
      orgId,
      connectionId: body.connectionId,
      lastVerifiedAt: Date.now(),
      lastError: undefined,
    });

    return NextResponse.json({
      success: true,
      snapshot,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await markSyncRunFailed(runId, message);
    await recordConnectionVerification({
      orgId,
      connectionId: body.connectionId,
      lastVerifiedAt: undefined,
      lastError: message,
    });
    return NextResponse.json(
      { error: "Semantic sync failed", details: message },
      { status: 502 }
    );
  }
}
