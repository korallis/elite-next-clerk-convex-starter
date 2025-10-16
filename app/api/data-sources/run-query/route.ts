import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  executeReadOnlyQuery,
  sqlConnectionConfigSchema,
  withSqlPool,
  SqlParameters,
} from "@/lib/mssql";

type RunQueryBody = {
  config?: unknown;
  connectionId?: string;
  query?: string;
  parameters?: SqlParameters;
  maxRows?: number;
};

export async function POST(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!orgId) {
    return NextResponse.json({ error: "Organization is required" }, { status: 400 });
  }

  let body: RunQueryBody;
  try {
    body = (await request.json()) as RunQueryBody;
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.query || typeof body.query !== "string") {
    return NextResponse.json({ error: "Query is required" }, { status: 422 });
  }

  const parseResult = sqlConnectionConfigSchema.safeParse(body.config ?? {});
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid connection configuration", details: parseResult.error.flatten() },
      { status: 422 }
    );
  }

  const maxRows = Math.min(Math.max(body.maxRows ?? 5000, 1), 20000);

  try {
    const result = await withSqlPool(parseResult.data, (pool) =>
      executeReadOnlyQuery(pool, body.query!, body.parameters ?? {}, { maxRows })
    );

    return NextResponse.json({
      rows: result.recordset,
      rowCount: result.rowsAffected[0] ?? result.recordset.length,
      columns:
        result.recordset.length > 0
          ? Object.keys(result.recordset[0] as Record<string, unknown>)
          : [],
      statistics: {
        rowsAffected: result.rowsAffected,
        maxRows,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Query execution failed", details: normalizeError(error) },
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
