import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  fetchSchemaMetadata,
  sqlConnectionConfigSchema,
  withSqlPool,
} from "@/lib/mssql";

type SchemaRequestBody = {
  config?: unknown;
};

export async function POST(request: Request) {
  const { userId, orgId } = auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!orgId) {
    return NextResponse.json({ error: "Organization is required" }, { status: 400 });
  }

  let body: SchemaRequestBody;
  try {
    body = (await request.json()) as SchemaRequestBody;
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = sqlConnectionConfigSchema.safeParse(body.config ?? {});
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid connection configuration", details: parseResult.error.flatten() },
      { status: 422 }
    );
  }

  try {
    const metadata = await withSqlPool(parseResult.data, fetchSchemaMetadata);
    return NextResponse.json({ metadata });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch schema", details: normalizeError(error) },
      { status: 502 }
    );
  }
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected error";
}
