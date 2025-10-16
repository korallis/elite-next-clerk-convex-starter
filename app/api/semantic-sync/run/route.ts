import { NextResponse } from "next/server";
import { sqlConnectionConfigSchema } from "@/lib/mssql";
import { generateSemanticSnapshot } from "@/lib/semantic";
import {
  getOrgConnection,
  upsertSemanticArtifact,
  markSyncRunCompleted,
  markSyncRunFailed,
  recordConnectionVerification,
  upsertSyncStage,
} from "@/lib/convexServerClient";
import { getConvexClient } from "@/lib/convexServerClient";
import { api } from "@/convex/_generated/api";

type RunBody = {
  orgId: string;
  connectionId: string;
  runId: string;
};

export async function POST(request: Request) {
  const adminHeader = request.headers.get("x-admin-token") || request.headers.get("X-Admin-Token");
  if (!adminHeader || adminHeader !== process.env.CONVEX_ADMIN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RunBody;
  try {
    body = (await request.json()) as RunBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { orgId, connectionId, runId } = body || ({} as RunBody);
  if (!orgId || !connectionId || !runId) {
    return NextResponse.json({ error: "orgId, connectionId and runId are required" }, { status: 422 });
  }

  let stage = "get_connection";
  try {
    const connection = await getOrgConnection({ orgId, connectionId, includeConfig: true });
    if (!connection || !("config" in connection) || !connection.config) {
      throw new Error("Connection not found");
    }

    stage = "validate_config";
    const configResult = sqlConnectionConfigSchema.safeParse(connection.config);
    if (!configResult.success) {
      throw new Error("Stored connection configuration is invalid");
    }

    stage = "generate_snapshot";
    await upsertSyncStage({ runId, stage, status: "running" });
    const selectionMode =
      (connection as any).selectionMode ?? ((connection as any).selectedTables ? "include" : "all");
    const selectedTables = Array.isArray((connection as any).selectedTables)
      ? ((connection as any).selectedTables as string[])
      : undefined;
    const excludedTables = Array.isArray((connection as any).excludedTables)
      ? ((connection as any).excludedTables as string[])
      : undefined;

    const { snapshot, embeddings } = await generateSemanticSnapshot(orgId, configResult.data, {
      includeTables: selectionMode === "include" ? selectedTables : undefined,
      excludeTables: selectionMode === "exclude" ? excludedTables : undefined,
      onProgress: async (e) => {
        if (e.phase === "discover") {
          await upsertSyncStage({ runId, stage: "generate_snapshot", status: "running", metrics: { totalTables: e.totalTables, processedTables: e.processedTables } });
        } else if (e.phase === "profile") {
          await upsertSyncStage({ runId, stage: "generate_snapshot", status: "running", metrics: { totalTables: e.totalTables, processedTables: e.processedTables } });
        }
      }
    });
    const totalTables = snapshot.tables.length;
    const totalColumns = snapshot.tables.reduce((acc, t) => acc + t.columns.length, 0);
    await upsertSyncStage({ runId, stage, status: "completed", metrics: { tables: totalTables, columns: totalColumns, totalTables } });

    stage = "write_artifacts";
    const version = snapshot.generatedAt;
    const MAX_TABLE_COLUMNS = parseInt(process.env.SEMANTIC_TABLE_COLUMNS_MAX || "200", 10);
    let processedTables = 0;
    let processedColumns = 0;
    await upsertSyncStage({ runId, stage, status: "running", metrics: { processedTables, totalTables, processedColumns, totalColumns } });
    const progressStep = Math.max(1, Math.floor(totalTables / 50));
    for (const table of snapshot.tables) {
      const lightColumns = table.columns
        .slice(0, Math.max(0, MAX_TABLE_COLUMNS))
        .map((c) => ({ name: c.name, dataType: c.dataType }));
      const lightFks = table.foreignKeys.map((fk) => ({
        sourceColumn: fk.sourceColumn,
        targetTable: fk.targetTable,
        targetColumn: fk.targetColumn,
      }));
      const tablePayload = {
        schema: table.schema,
        name: table.name,
        rowCount: table.rowCount,
        description: table.description ?? null,
        businessQuestions: table.businessQuestions ?? [],
        columns: lightColumns,
        foreignKeys: lightFks,
      };
      try {
        await upsertSemanticArtifact({
          orgId,
          connectionId,
          artifactType: "table",
          artifactKey: table.key,
          version,
          payload: tablePayload,
          embeddingId:
            embeddings.find((item) => item.artifactType === "table" && item.artifactKey === table.key)?.embeddingId ?? null,
        });
      } catch (e: any) {
        if (String(e?.message || e).includes("length limit exceeded")) {
          // Retry with ultra-slim payload if body too large
          await upsertSemanticArtifact({
            orgId,
            connectionId,
            artifactType: "table",
            artifactKey: table.key,
            version,
            payload: { schema: table.schema, name: table.name, rowCount: table.rowCount, description: table.description ?? null },
            embeddingId:
              embeddings.find((item) => item.artifactType === "table" && item.artifactKey === table.key)?.embeddingId ?? null,
          });
        } else {
          throw e;
        }
      }

      for (const column of table.columns) {
        const columnKey = `${table.key}.${column.name}`;
        await upsertSemanticArtifact({
          orgId,
          connectionId,
          artifactType: "column",
          artifactKey: columnKey,
          version,
          payload: {
            schema: table.schema,
            table: table.name,
            column: { name: column.name, dataType: column.dataType, sampleValues: column.sampleValues?.slice(0, 5) ?? [] },
          },
          embeddingId:
            embeddings.find((item) => item.artifactType === "column" && item.artifactKey === columnKey)?.embeddingId ??
            null,
        });
        processedColumns++;
      }
      processedTables++;
      if (processedTables % progressStep === 0 || processedTables === totalTables) {
        await upsertSyncStage({ runId, stage, status: "running", metrics: { processedTables, totalTables, processedColumns, totalColumns } });
      }
    }
    await upsertSyncStage({ runId, stage, status: "completed", metrics: { processedTables, totalTables, processedColumns, totalColumns } });

    // Phase: write catalog v2 (entities/attributes/graph) — heuristic prototype
    stage = "write_catalog_v2";
    await upsertSyncStage({ runId, stage, status: "running" });
    try {
      const convex = getConvexClient();
      const adminToken = process.env.CONVEX_ADMIN_TOKEN as string; // required by admin routes
      // Simple heuristic: entity per table with singularized name; id column guess.
      for (const table of snapshot.tables) {
        const canonical = table.name.replace(/^can_/i, "");
        const name = toTitleCase(singularize(canonical));
        const idCol = table.columns.find((c) => /(^|_)(id|pk)$/i.test(c.name))?.name || undefined;
        await convex.mutation((api as any).semanticCatalog.upsertEntity, {
          adminToken,
          orgId,
          connectionId,
          key: `Entity:${name}`,
          name,
          defaultTable: `${table.schema}.${table.name}`,
          idColumn: idCol,
          synonyms: [name.toLowerCase(), pluralize(name.toLowerCase())],
        });
        // Attributes: create entries for text-like columns to seed dictionary
        for (const col of table.columns) {
          await convex.mutation((api as any).semanticCatalog.upsertAttribute, {
            adminToken,
            orgId,
            connectionId,
            entityKey: `Entity:${name}`,
            name: col.name,
            sourceTable: `${table.schema}.${table.name}`,
            sourceColumn: col.name,
            join: undefined,
            synonyms: [col.name.replace(/_/g, " ")],
          });
        }
      }
      // Graph edges from foreign keys
      for (const table of snapshot.tables) {
        for (const fk of table.foreignKeys) {
          await convex.mutation((api as any).semanticCatalog.upsertGraphEdge, {
            adminToken,
            orgId,
            connectionId,
            sourceTable: `${table.schema}.${table.name}`,
            sourceColumn: fk.sourceColumn,
            targetTable: fk.targetTable,
            targetColumn: fk.targetColumn,
            kind: "fk",
            weight: 1,
          });
        }
      }
      await upsertSyncStage({ runId, stage, status: "completed" });
    } catch (e) {
      await upsertSyncStage({ runId, stage, status: "failed", error: String(e) });
    }

    await markSyncRunCompleted(runId);
    await recordConnectionVerification({ orgId, connectionId, lastVerifiedAt: Date.now(), lastError: undefined });
    try {
      // Invalidate in-process dashboard tile cache after schema changes
      // @ts-ignore
      if (global.__TILE_CACHE__ && typeof global.__TILE_CACHE__.clear === "function") {
        // @ts-ignore
        global.__TILE_CACHE__.clear();
      }
    } catch {}
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? `${stage}: ${error.message}` : `stage=${stage}: Unknown error`;
    console.error("[semantic-sync/run] failed", { stage, error });
    try {
      await upsertSyncStage({ runId: (body as any)?.runId ?? "", stage, status: "failed", metrics: { stage } });
      await markSyncRunFailed((body as any)?.runId ?? "", message);
      await recordConnectionVerification({ orgId: (body as any)?.orgId ?? "", connectionId: (body as any)?.connectionId ?? "", lastError: message });
    } catch {}
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
