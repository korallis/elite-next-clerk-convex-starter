import type { ConnectionPool } from "mssql";
import {
  ColumnMetadata,
  ForeignKeyMetadata,
  TableMetadata,
  fetchSchemaMetadata,
  executeReadOnlyQuery,
  withSqlPool,
  type SqlConnectionConfig,
} from "./mssql";
import {
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_SUMMARIZER_MODEL,
  tryGetOpenAIClient,
} from "./openai";
import { upsertVectors } from "./vectorStore";

const SAMPLE_COLUMN_LIMIT = parseInt(process.env.SEMANTIC_SAMPLE_COLUMNS || "4", 10);
const SAMPLE_VALUE_LIMIT = parseInt(process.env.SEMANTIC_SAMPLE_VALUES || "5", 10);

export type ColumnProfile = {
  name: string;
  dataType: string;
  nullable: boolean;
  isIdentity: boolean;
  maxLength: number | null;
  numericPrecision: number | null;
  numericScale: number | null;
  sampleValues: string[];
};

export type ForeignKeyProfile = {
  constraintName: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
};

export type TableProfile = {
  schema: string;
  name: string;
  key: string;
  rowCount: number | null;
  columns: ColumnProfile[];
  foreignKeys: ForeignKeyProfile[];
  description?: string;
  businessQuestions?: string[];
};

export type SemanticSnapshot = {
  generatedAt: number;
  tables: TableProfile[];
};

export type EmbeddingItem = {
  key: string;
  artifactType: "table" | "column";
  artifactKey: string;
  text: string;
  metadata: Record<string, unknown>;
  embeddingId?: string | null;
};

export async function generateSemanticSnapshot(
  orgId: string,
  config: SqlConnectionConfig
): Promise<{ snapshot: SemanticSnapshot; embeddings: EmbeddingItem[] }> {
  const { tables, embeddings } = await withSqlPool(config, async (pool) => {
    const metadata = await fetchSchemaMetadata(pool);
    const tableProfiles = await buildTableProfiles(pool, metadata);
    await enrichTablesWithSummaries(tableProfiles);
    const embeddingItems = buildEmbeddingItems(tableProfiles);
    await embedAndStore(orgId, embeddingItems);
    return { tables: tableProfiles, embeddings: embeddingItems };
  });

  return {
    snapshot: {
      generatedAt: Date.now(),
      tables,
    },
    embeddings,
  };
}

async function buildTableProfiles(
  pool: ConnectionPool,
  metadata: {
    tables: TableMetadata[];
    columns: ColumnMetadata[];
    foreignKeys: ForeignKeyMetadata[];
  }
): Promise<TableProfile[]> {
  const profiles: TableProfile[] = [];
  for (const table of metadata.tables) {
    const tableColumns = metadata.columns.filter(
      (column) =>
        column.schema === table.schema && column.table_name === table.name
    );
    const samples = await sampleColumnValues(pool, table, tableColumns);

    const columnProfiles: ColumnProfile[] = tableColumns.map((column) => ({
      name: column.name,
      dataType: column.data_type,
      nullable: column.is_nullable === "YES",
      isIdentity: column.is_identity === 1,
      maxLength: column.max_length,
      numericPrecision: column.numeric_precision,
      numericScale: column.numeric_scale,
      sampleValues: samples[column.name] ?? [],
    }));

    const foreignKeys = metadata.foreignKeys
      .filter(
        (fk) =>
          fk.source_schema === table.schema && fk.source_table === table.name
      )
      .map((fk) => ({
        constraintName: fk.constraint_name,
        sourceColumn: fk.source_column,
        targetTable: `${fk.target_schema}.${fk.target_table}`,
        targetColumn: fk.target_column,
      }));

    profiles.push({
      schema: table.schema,
      name: table.name,
      key: `${table.schema}.${table.name}`,
      rowCount: table.approximate_row_count ?? null,
      columns: columnProfiles,
      foreignKeys,
    });
  }
  return profiles;
}

async function sampleColumnValues(
  pool: ConnectionPool,
  table: TableMetadata,
  columns: ColumnMetadata[]
): Promise<Record<string, string[]>> {
  const samples: Record<string, string[]> = {};
  const candidates = columns
    .filter(shouldSampleColumn)
    .slice(0, SAMPLE_COLUMN_LIMIT);

  for (const column of candidates) {
    const query = `SELECT TOP (${SAMPLE_VALUE_LIMIT}) ${quoteIdentifier(
      column.name
    )} AS value
      FROM ${formatTableName(table.schema, table.name)}
      WHERE ${quoteIdentifier(column.name)} IS NOT NULL
      GROUP BY ${quoteIdentifier(column.name)}
      ORDER BY COUNT(*) DESC`;
    try {
      const result = await executeReadOnlyQuery(pool, query);
      const values = result.recordset
        .map((row) => row.value)
        .filter((value): value is string | number => value != null)
        .map((value) => String(value))
        .slice(0, SAMPLE_VALUE_LIMIT);
      samples[column.name] = values;
    } catch (error) {
      console.warn(
        `Failed to sample column ${table.schema}.${table.name}.${column.name}`,
        error
      );
    }
  }
  return samples;
}

export function shouldSampleColumn(column: ColumnMetadata): boolean {
  const textTypes = new Set([
    "nvarchar",
    "varchar",
    "nchar",
    "char",
    "text",
    "ntext",
    "uniqueidentifier",
  ]);
  return textTypes.has(column.data_type.toLowerCase());
}

async function enrichTablesWithSummaries(tables: TableProfile[]) {
  if (tables.length === 0) return;
  const client = tryGetOpenAIClient();
  if (!client) {
    applyFallbackSummaries(tables);
    return;
  }

  const payload = {
    tables: tables.map((table) => ({
      table_key: table.key,
      row_count: table.rowCount ?? 0,
      columns: table.columns.map((column) => ({
        name: column.name,
        data_type: column.dataType,
        nullable: column.nullable,
        sample_values: column.sampleValues.slice(0, 3),
      })),
    })),
  };

  try {
    const response = await client.responses.create({
      model: DEFAULT_SUMMARIZER_MODEL,
      input: [
        {
          role: "system",
          content:
            "You are an analytics expert describing database tables for business stakeholders. Respond with JSON only.",
        },
        {
          role: "user",
          content: JSON.stringify(payload),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "table_summaries",
          schema: {
            type: "object",
            properties: {
              tables: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    table_key: { type: "string" },
                    description: { type: "string" },
                    business_questions: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                  required: ["table_key", "description"],
                  additionalProperties: false,
                },
              },
            },
            required: ["tables"],
          },
        },
      },
    });

    const parsed = extractJson(response);
    if (parsed && Array.isArray(parsed.tables)) {
      const map = new Map(
        parsed.tables.map((entry: any) => [entry.table_key, entry])
      );
      tables.forEach((table) => {
        const entry = map.get(table.key);
        if (entry) {
          table.description = entry.description;
          if (Array.isArray(entry.business_questions)) {
            table.businessQuestions = entry.business_questions.filter(
              (q: unknown): q is string => typeof q === "string"
            );
          }
        } else {
          applyFallbackSummary(table);
        }
      });
    } else {
      applyFallbackSummaries(tables);
    }
  } catch (error) {
    console.warn("Failed to generate table summaries via OpenAI", error);
    applyFallbackSummaries(tables);
  }
}

function extractJson(response: any): any {
  if (typeof response?.output_text === "string") {
    try {
      return JSON.parse(response.output_text);
    } catch (error) {
      console.warn("Failed to parse response.output_text", error);
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

function applyFallbackSummaries(tables: TableProfile[]) {
  tables.forEach(applyFallbackSummary);
}

function applyFallbackSummary(table: TableProfile) {
  const columnList = table.columns.map((column) => column.name).join(", ");
  table.description =
    table.description ??
    `Table ${table.key} with ${table.columns.length} columns (${columnList}).`;
  table.businessQuestions = table.businessQuestions ?? [
    `What are the trends in ${table.name}?`,
  ];
}

function buildEmbeddingItems(tables: TableProfile[]): EmbeddingItem[] {
  const items: EmbeddingItem[] = [];
  for (const table of tables) {
    const columnSummaries = table.columns
      .map(
        (column) =>
          `${column.name} (${column.dataType}${column.nullable ? " nullable" : " not null"})`
      )
      .join("; ");
    items.push({
      key: `table:${table.key}`,
      artifactType: "table",
      artifactKey: table.key,
      text: `Table ${table.key}. Row count: ${
        table.rowCount ?? "unknown"
      }. Columns: ${columnSummaries}. Description: ${table.description ?? ""}`,
      metadata: {
        schema: table.schema,
        table: table.name,
        rowCount: table.rowCount,
      },
    });

    for (const column of table.columns) {
      const sampleValuesText = column.sampleValues.length
        ? `Sample values: ${column.sampleValues.join(", ")}`
        : "";
      items.push({
        key: `column:${table.key}.${column.name}`,
        artifactType: "column",
        artifactKey: `${table.key}.${column.name}`,
        text: `Column ${column.name} in table ${table.key}. Type: ${
          column.dataType
        }. ${sampleValuesText}`,
        metadata: {
          schema: table.schema,
          table: table.name,
          column: column.name,
          dataType: column.dataType,
        },
      });
    }
  }
  return items;
}

async function embedAndStore(orgId: string, items: EmbeddingItem[]) {
  if (items.length === 0) return;
  const client = tryGetOpenAIClient();
  if (!client) return;
  try {
    const response = await client.embeddings.create({
      model: DEFAULT_EMBEDDING_MODEL,
      input: items.map((item) => item.text),
    });
    const vectors = response.data.map((entry) => entry.embedding);
    const embeddingIds = await upsertVectors(
      orgId,
      items.map((item, index) => ({
        key: item.key,
        vector: vectors[index],
        metadata: item.metadata,
      }))
    );
    embeddingIds.forEach((id, index) => {
      items[index].embeddingId = id;
    });
  } catch (error) {
    console.warn("Failed to create embeddings", error);
  }
}

function quoteIdentifier(identifier: string): string {
  const escaped = identifier.replace(/]/g, "]]" );
  return `[${escaped}]`;
}

function formatTableName(schema: string, table: string): string {
  return `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
}
