import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  sqlConnectionConfigSchema,
  withSqlPool,
  executeReadOnlyQueryWithRetry,
} from "@/lib/mssql";
import { getOpenAIClient, DEFAULT_ANALYST_MODEL, DEFAULT_EMBEDDING_MODEL, withOpenAIRetry } from "@/lib/openai";
import {
  getOrgConnection,
  listSemanticArtifacts,
  recordQueryAudit,
  countOrgQueries,
  countOrgErrors,
  getOrgSettings,
} from "@/lib/convexServerClient";
import { rankTablesFromHits } from "@/lib/retrieval";
import { listSemanticCatalog } from "@/lib/convexServerClient";

type QueryBody = {
  connectionId: string;
  question: string;
  maxRows?: number;
};

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    sql: { type: "string" },
    rationale: { type: "string" },
    chart: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: {
          type: "string",
          enum: ["table", "line", "bar", "area", "pie", "number"],
        },
        x: { type: ["string", "null"] },
        y: {
          type: "array",
          items: { type: "string" },
        },
        grouping: { type: ["string", "null"] },
        options: { type: "object", additionalProperties: false, properties: {}, required: [] },
      },
      required: ["type", "x", "y", "grouping", "options"],
    },
    follow_up_questions: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["sql", "rationale", "chart", "follow_up_questions"],
} as const;

export async function POST(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!orgId) {
    return NextResponse.json({ error: "Organization is required" }, { status: 400 });
  }

  let body: QueryBody;
  try {
    body = (await request.json()) as QueryBody;
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.connectionId) {
    return NextResponse.json({ error: "connectionId is required" }, { status: 422 });
  }
  if (!body.question || typeof body.question !== "string") {
    return NextResponse.json({ error: "question is required" }, { status: 422 });
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

  const orgSettings = await getOrgSettings(orgId).catch(() => null);
  const dailyLimit = Number(orgSettings?.rateLimitDaily) || parseInt(process.env.ORG_DAILY_QUERY_LIMIT || "500", 10);
  const recentCount = await countOrgQueries({ orgId, windowMs: 24 * 60 * 60 * 1000 });
  if (recentCount >= dailyLimit) {
    return NextResponse.json(
      { error: "Daily query limit reached. Try again tomorrow or contact admin." },
      { status: 429 }
    );
  }
  const errorWindowLimit = Number(orgSettings?.errorWindowLimit) || 5;
  const recentErrors = await countOrgErrors({ orgId, windowMs: 10 * 60 * 1000 });
  if (recentErrors >= errorWindowLimit) {
    return NextResponse.json(
      { error: "Temporary pause due to repeated errors. Please try again later." },
      { status: 429 }
    );
  }

  const tables = await listSemanticArtifacts({
    orgId,
    connectionId: body.connectionId,
    artifactType: "table",
  });
  if (!tables || tables.length === 0) {
    return NextResponse.json(
      { error: "No semantic catalog found. Run a semantic sync first." },
      { status: 409 }
    );
  }

  const relevantTables = await selectRelevantTables(orgId, body.question, tables, body.connectionId);
  const prompt = buildPrompt(body.question, relevantTables);

  const client = getOpenAIClient();
  const response = await withOpenAIRetry(() => client.responses.create({
    model: DEFAULT_ANALYST_MODEL,
    input: [
      {
        role: "system",
        content:
          "You are an expert data analyst generating Microsoft SQL Server queries. Only use provided tables and columns. Return JSON only.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "analysis_response",
        schema: RESPONSE_SCHEMA,
      },
    },
  } as any));

  const parsed = extractStructuredResponse(response);
  if (!parsed) {
    return NextResponse.json(
      { error: "Model response could not be parsed" },
      { status: 502 }
    );
  }

  const sql = parsed.sql.trim();
  const maxRows = Math.min(Math.max(body.maxRows ?? 5000, 1), 20000);

  try {
    const start = Date.now();
    const queryResult = await withSqlPool(configResult.data, (pool) =>
      executeReadOnlyQueryWithRetry(pool, sql, {}, { maxRows, retries: 2 })
    );
    const durationMs = Date.now() - start;

    await recordQueryAudit({
      orgId,
      connectionId: body.connectionId,
      userId,
      question: body.question,
      sql,
      rowCount: queryResult.recordset.length,
      durationMs,
      status: "success",
    });

    const res = NextResponse.json({
      success: true,
      sql,
      rationale: parsed.rationale,
      chart: parsed.chart ?? null,
      followUpQuestions: parsed.follow_up_questions ?? [],
      rows: queryResult.recordset,
      rowCount: queryResult.recordset.length,
      columns:
        queryResult.recordset.length > 0
          ? Object.keys(queryResult.recordset[0] as Record<string, unknown>)
          : [],
      executionMs: durationMs,
    });
    res.headers.set("x-request-id", cryptoRandomId());
    return res;
  } catch (error) {
    await recordQueryAudit({
      orgId,
      connectionId: body.connectionId,
      userId,
      question: body.question,
      sql,
      rowCount: 0,
      durationMs: 0,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });

    const res = NextResponse.json(
      {
        error: "Query execution failed",
        details: error instanceof Error ? error.message : "Unknown error",
        sql,
      },
      { status: 502 }
    );
    res.headers.set("x-request-id", cryptoRandomId());
    return res;
  }
}

type TableArtifact = {
  artifactKey: string;
  payload: {
    schema: string;
    name: string;
    rowCount: number | null;
    description?: string | null;
    businessQuestions?: string[];
    columns: Array<{
      name: string;
      dataType: string;
      sampleValues?: string[];
    }>;
  };
};

async function selectRelevantTables(orgId: string, question: string, tables: TableArtifact[], connectionId: string): Promise<TableArtifact[]> {
  // 1) Prefer explicit entity/attribute mapping when question matches an entity name from Catalog v2
  try {
    const catalog = await listSemanticCatalog({ orgId, connectionId });
    const q = question.toLowerCase();
    const entity = (catalog?.entities || []).find((e: any) => {
      const name = String(e.name || "").toLowerCase();
      const syns: string[] = Array.isArray(e.synonyms) ? e.synonyms.map((s: any) => String(s).toLowerCase()) : [];
      return q.includes(name) || syns.some((s) => q.includes(s));
    });
    if (entity && entity.defaultTable) {
      const hit = tables.find((t) => t.artifactKey.toLowerCase() === String(entity.defaultTable).toLowerCase());
      if (hit) return [hit, ...tables.filter((t) => t !== hit)].slice(0, 5);
    }
  } catch {}

  try {
    const client = getOpenAIClient();
    const embedding = await client.embeddings.create({ model: DEFAULT_EMBEDDING_MODEL, input: question });
    const vector = embedding.data[0].embedding;
    const { searchTopK } = await import("@/lib/vectorStore");
    const hits = await searchTopK(orgId, vector, 10);

    // Telemetry (debug): count table vs column hits and top candidates
    try {
      const tableHits = hits.filter((h) => h.id.startsWith("table:")).length;
      const columnHits = hits.filter((h) => h.id.startsWith("column:")).length;
      const topIds = hits.slice(0, 5).map((h) => h.id).join(", ");
      console.log(`[retrieval] tableHits=${tableHits} columnHits=${columnHits} top=${topIds}`);
    } catch {}

    const ranked = rankTablesFromHits(
      hits,
      tables.map((t) => ({ artifactKey: t.artifactKey })) as any,
      5
    ).map((r) => tables.find((t) => t.artifactKey === r.artifactKey)!)
     .filter(Boolean);
    if (ranked.length > 0) return ranked.slice(0, 5);
  } catch {}
  const terms = question.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const scores = tables.map((table) => {
    const content = [table.artifactKey, table.payload.description ?? "", ...(table.payload.businessQuestions ?? []), ...table.payload.columns.map((c) => c.name)]
      .join(" ")
      .toLowerCase();
    const score = terms.reduce((acc, term) => acc + (content.includes(term) ? 1 : 0), 0);
    return { table, score };
  });
  return scores.sort((a, b) => b.score - a.score).slice(0, 5).map((e) => e.table);
}

function buildPrompt(question: string, tables: TableArtifact[]): string {
  const tableText = tables
    .map((table) => {
      const columns = table.payload.columns
        .map(
          (column) =>
            `- ${column.name} (${column.dataType})` +
            (column.sampleValues?.length
              ? ` e.g. ${column.sampleValues.slice(0, 3).join(", ")}`
              : "")
        )
        .join("\n");
      return `Table ${table.artifactKey}
Description: ${table.payload.description ?? ""}
Approximate rows: ${table.payload.rowCount ?? "unknown"}
Columns:
${columns}`;
    })
    .join("\n\n");

  return `Question: ${question}

Available tables:
${tableText}

Return JSON with keys sql, rationale, optional chart, and follow_up_questions.`;
}

function extractStructuredResponse(response: any) {
  if (typeof response?.output_text === "string") {
    try {
      return JSON.parse(response.output_text);
    } catch (error) {
      console.warn("Failed to parse structured response", error);
    }
  }
  if (Array.isArray(response?.output)) {
    for (const item of response.output) {
      if (item?.type === "message" && Array.isArray(item.content)) {
        for (const content of item.content) {
          if (content?.type === "output_text" && typeof content.text === "string") {
            try {
              return JSON.parse(content.text);
            } catch (error) {
              console.warn("Failed to parse output_text item", error);
            }
          }
        }
      }
    }
  }
  return null;
}

function cryptoRandomId(): string {
  try {
    return (globalThis.crypto?.randomUUID?.() as string) || Math.random().toString(36).slice(2);
  } catch {
    return Math.random().toString(36).slice(2);
  }
}
