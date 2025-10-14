import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getOpenAIClient, DEFAULT_ANALYST_MODEL } from "@/lib/openai";
import { sqlConnectionConfigSchema } from "@/lib/mssql";
import {
  getOrgConnection,
} from "@/lib/convexServerClient";
import { getConvexClient } from "@/lib/convexServerClient";
import { api } from "@/convex/_generated/api";

type Body = { connectionId: string; prompt: string; name?: string };

const DASHBOARD_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    tiles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          sql: { type: "string" },
          chart: { type: "object" },
        },
        required: ["title", "sql"],
      },
    },
  },
  required: ["title", "tiles"],
};

export async function POST(request: Request) {
  const { userId, orgId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: "Organization is required" }, { status: 400 });

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.connectionId || !body.prompt) {
    return NextResponse.json({ error: "connectionId and prompt are required" }, { status: 422 });
  }

  const connection = await getOrgConnection({ orgId, connectionId: body.connectionId, includeConfig: true });
  if (!connection || !("config" in connection) || !connection.config) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }
  const configResult = sqlConnectionConfigSchema.safeParse(connection.config);
  if (!configResult.success) {
    return NextResponse.json({ error: "Stored connection configuration is invalid" }, { status: 500 });
  }

  const client = getOpenAIClient();
  const response = await client.responses.create({
    model: DEFAULT_ANALYST_MODEL,
    input: [
      { role: "system", content: "You are an analytics assistant. Produce a dashboard spec with multiple tiles for Microsoft SQL Server." },
      { role: "user", content: body.prompt },
    ],
    response_format: { type: "json_schema", json_schema: { name: "dashboard", schema: DASHBOARD_SCHEMA } },
  });

  const parsed = parseJson(response);
  if (!parsed) return NextResponse.json({ error: "Model output parse error" }, { status: 502 });

  const convex = getConvexClient();
  const dashboardId = await convex.mutation(api.dashboards.create, {
    adminToken: process.env.CONVEX_ADMIN_TOKEN!,
    orgId,
    name: body.name ?? parsed.title,
    createdBy: userId,
  });

  let order = 0;
  for (const tile of parsed.tiles) {
    await convex.mutation(api.dashboards.addTile, {
      adminToken: process.env.CONVEX_ADMIN_TOKEN!,
      orgId,
      dashboardId,
      title: tile.title,
      sql: tile.sql,
      chartSpecJson: JSON.stringify(tile.chart ?? { type: "table" }),
      order: order++,
    });
  }

  return NextResponse.json({ success: true, dashboardId });
}

function parseJson(resp: any) {
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
