import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { sqlConnectionConfigSchema, withSqlPool } from "@/lib/mssql";
import {
  createOrgConnection,
  listOrgConnections,
  recordConnectionVerification,
  removeConnectionDraft,
} from "@/lib/convexServerClient";
import { encryptJson } from "@/lib/encryption";
import { normalizeTableSelection } from "@/lib/dataSources";

type CreateConnectionBody = {
  name: string;
  config: unknown;
  draftId?: string;
  selectionMode?: "all" | "include" | "exclude";
  selectedTables?: unknown;
  excludedTables?: unknown;
};

export async function POST(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!orgId) {
    return NextResponse.json({ error: "Organization is required" }, { status: 400 });
  }

  let body: CreateConnectionBody;
  try {
    body = (await request.json()) as CreateConnectionBody;
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 422 });
  }

  const parseResult = sqlConnectionConfigSchema.safeParse(body.config ?? {});
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid connection configuration", details: parseResult.error.flatten() },
      { status: 422 }
    );
  }

  try {
    await withSqlPool(parseResult.data, async () => {});
  } catch (error) {
    return NextResponse.json(
      { error: "Connection test failed", details: normalizeError(error) },
      { status: 502 }
    );
  }

  const selection = normalizeTableSelection(
    body.selectionMode,
    body.selectedTables,
    body.excludedTables
  );

  const connectionId = await createOrgConnection({
    orgId,
    name: body.name,
    encryptedConfig: encryptJson(parseResult.data),
    createdBy: userId,
    selectedTables: selection.selectedTables,
    excludedTables: selection.excludedTables,
    selectionMode: selection.mode,
  });

  await recordConnectionVerification({
    orgId,
    connectionId,
    lastVerifiedAt: Date.now(),
    lastError: undefined,
  });

  if (body.draftId) {
    await removeConnectionDraft({
      orgId,
      userId,
      draftId: body.draftId,
    });
  }

  return NextResponse.json({
    success: true,
    connectionId,
  });
}

export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!orgId) {
    return NextResponse.json({ error: "Organization is required" }, { status: 400 });
  }

  const connections = await listOrgConnections(orgId);
  return NextResponse.json({ connections });
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected error";
}

