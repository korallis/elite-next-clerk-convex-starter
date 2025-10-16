import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  getActiveConnectionDraft,
  getConnectionDraft,
  removeConnectionDraft,
  saveConnectionDraft,
} from "@/lib/convexServerClient";
import { decryptJson, encryptJson } from "@/lib/encryption";
import { sqlConnectionConfigSchema } from "@/lib/mssql";

type SaveDraftBody = {
  draftId?: string;
  name?: string;
  step?: number;
  config?: unknown;
  selectionMode?: "all" | "include" | "exclude";
  selectedTables?: unknown;
};

const selectionModes = new Set(["all", "include", "exclude"]);

export async function GET(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!orgId) {
    return NextResponse.json({ error: "Organization is required" }, { status: 400 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  const draft = id
    ? await getConnectionDraft({ orgId, draftId: id })
    : await getActiveConnectionDraft({ orgId, userId });

  if (!draft) {
    return NextResponse.json({ draft: null });
  }

  const config = draft.encryptedConfig ? decryptJson(draft.encryptedConfig) : null;

  return NextResponse.json({
    draft: {
      id: draft._id,
      name: draft.name ?? null,
      step: draft.step,
      selectionMode: draft.selectionMode ?? null,
      selectedTables: draft.selectedTables ?? [],
      config,
      updatedAt: draft.updatedAt,
    },
  });
}

export async function POST(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!orgId) {
    return NextResponse.json({ error: "Organization is required" }, { status: 400 });
  }

  let body: SaveDraftBody;
  try {
    body = (await request.json()) as SaveDraftBody;
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const step = typeof body.step === "number" && body.step >= 1 ? Math.min(body.step, 3) : 1;

  let encryptedConfig: { algorithm: string; iv: string; ciphertext: string; tag: string } | undefined;
  if (body.config) {
    const parseResult = sqlConnectionConfigSchema.safeParse(body.config);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid connection configuration", details: parseResult.error.flatten() },
        { status: 422 }
      );
    }
    encryptedConfig = encryptJson(parseResult.data);
  }

  const normalizedTables = normalizeTables(body.selectedTables);
  const selectionMode = selectionModes.has(body.selectionMode ?? "")
    ? (body.selectionMode as "all" | "include" | "exclude")
    : normalizedTables
    ? "include"
    : "all";

  const draftId = await saveConnectionDraft({
    orgId,
    userId,
    draftId: body.draftId,
    name: body.name,
    step,
    encryptedConfig,
    selectedTables: normalizedTables ?? undefined,
    selectionMode,
  });

  return NextResponse.json({ draftId, step, selectionMode });
}

export async function DELETE(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!orgId) {
    return NextResponse.json({ error: "Organization is required" }, { status: 400 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "draftId is required" }, { status: 422 });
  }

  await removeConnectionDraft({ orgId, userId, draftId: id });
  return NextResponse.json({ success: true });
}

function normalizeTables(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  const seen = new Set<string>();
  const values: string[] = [];
  for (const item of input) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    values.push(trimmed);
  }
  return values.length > 0 ? values : null;
}
