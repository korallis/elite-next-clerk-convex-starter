import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { sqlConnectionConfigSchema, withSqlPool } from "@/lib/mssql";

export async function POST(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!orgId) {
    return NextResponse.json({ error: "Organization is required" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = sqlConnectionConfigSchema.safeParse(
    (body as { config?: unknown })?.config ?? body
  );
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid connection configuration", details: parseResult.error.flatten() },
      { status: 422 }
    );
  }

  try {
    await withSqlPool(parseResult.data, async () => {
      /* connection verified */
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Connection failed",
        details: normalizeError(error),
      },
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
