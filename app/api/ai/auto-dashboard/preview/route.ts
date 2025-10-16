import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getOpenAIClient, DEFAULT_ANALYST_MODEL } from "@/lib/openai";
import { dedupeAndLimitTiles } from "@/lib/autoDashboard";

type Body = { prompt: string };

const DASHBOARD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    tiles: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          sql: { type: "string" },
          chart: { type: "object", additionalProperties: false, properties: { type: { type: "string" } }, required: ["type"] },
        },
        required: ["title", "sql", "chart"],
      },
    },
  },
  required: ["title", "tiles"],
} as const;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Body;
  try { body = (await request.json()) as Body; } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  if (!body.prompt) return NextResponse.json({ error: "prompt is required" }, { status: 422 });

  const client = getOpenAIClient();
  const response = await client.responses.create({
    model: DEFAULT_ANALYST_MODEL,
    input: [
      { role: "system", content: "You are an analytics assistant. Produce a dashboard spec with multiple tiles for Microsoft SQL Server." },
      { role: "user", content: body.prompt },
    ],
    text: { format: { type: "json_schema", name: "dashboard", schema: DASHBOARD_SCHEMA } },
  } as any);

  const parsed = parseJson(response);
  if (!parsed) return NextResponse.json({ error: "Model output parse error" }, { status: 502 });
  const tiles = dedupeAndLimitTiles(parsed.tiles || [], parseInt(process.env.NEXT_PUBLIC_AUTO_DASH_MAX_TILES || "8", 10));
  return NextResponse.json({ success: true, spec: { title: parsed.title, tiles } });
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
