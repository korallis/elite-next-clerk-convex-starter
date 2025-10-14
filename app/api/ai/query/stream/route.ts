import { auth } from "@clerk/nextjs/server";
import { DEFAULT_ANALYST_MODEL, getOpenAIClient } from "@/lib/openai";
import { sqlConnectionConfigSchema, withSqlPool, executeReadOnlyQuery } from "@/lib/mssql";
import { getOrgConnection, listSemanticArtifacts } from "@/lib/convexServerClient";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { userId, orgId } = auth();
  if (!userId || !orgId) return new Response("Unauthorized", { status: 401 });
  const { connectionId, question, maxRows } = (await request.json()) as {
    connectionId: string;
    question: string;
    maxRows?: number;
  };
  const connection = await getOrgConnection({ orgId, connectionId, includeConfig: true });
  if (!connection || !("config" in connection) || !connection.config) {
    return new Response("Not found", { status: 404 });
  }
  const cfg = sqlConnectionConfigSchema.parse(connection.config);

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(new TextEncoder().encode(`event: ${event}\n`));
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      send("status", { message: "thinking" });

      try {
        // Prepare context
        const tables = await listSemanticArtifacts({ orgId, connectionId, artifactType: "table" });
        send("context", { tables: tables?.length || 0 });

        // Ask model (non-streaming for simplicity, we stream stages)
        const client = getOpenAIClient();
        const prompt = buildPrompt(question, (tables ?? []).slice(0, 5));
        const resp = await client.responses.create({
          model: DEFAULT_ANALYST_MODEL,
          input: [
            { role: "system", content: "You are an analytics expert for Microsoft SQL Server. Return JSON only." },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_schema", json_schema: { name: "analysis", schema: RESPONSE_SCHEMA } },
        });
        const parsed = extract(resp);
        if (!parsed) throw new Error("parse_error");
        send("draft", { sql: parsed.sql, rationale: parsed.rationale, chart: parsed.chart ?? null });

        // Execute SQL
        const result = await withSqlPool(cfg, (pool) => executeReadOnlyQuery(pool, parsed.sql, {}, { maxRows: Math.min(Math.max(maxRows ?? 5000, 1), 20000) }));
        send("result", {
          rows: result.recordset,
          columns: result.recordset.length ? Object.keys(result.recordset[0]) : [],
        });
        send("done", {});
        controller.close();
      } catch (error) {
        send("error", { message: error instanceof Error ? error.message : String(error) });
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    sql: { type: "string" },
    rationale: { type: "string" },
    chart: { type: "object" },
  },
  required: ["sql", "rationale"],
};

function buildPrompt(question: string, tables: any[]): string {
  const text = tables
    .map((t) => `Table ${t.artifactKey} Columns: ${(t.payload?.columns || []).map((c: any) => c.name).join(", ")}`)
    .join("\n");
  return `Question: ${question}\n${text}`;
}

function extract(resp: any) {
  if (typeof resp?.output_text === "string") {
    try { return JSON.parse(resp.output_text); } catch {}
  }
  if (Array.isArray(resp?.output)) {
    for (const item of resp.output) {
      if (item?.type === "message") {
        for (const c of item.content ?? []) {
          if (c?.type === "output_text" && typeof c.text === "string") {
            try { return JSON.parse(c.text); } catch {}
          }
        }
      }
    }
  }
  return null;
}
