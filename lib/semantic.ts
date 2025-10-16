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
const SAMPLE_DISTINCT_SCAN_LIMIT = parseInt(process.env.SEMANTIC_SAMPLE_DISTINCT_SCAN || "2000", 10);
const SAMPLE_TABLESAMPLE_ROWS = parseInt(process.env.SEMANTIC_SAMPLE_TABLESAMPLE_ROWS || "20000", 10);
const SAMPLE_TOP_SCAN_ROWS = parseInt(process.env.SEMANTIC_SAMPLE_TOP_SCAN_ROWS || "5000", 10);
const SAMPLE_SKIP_LARGE_TABLE_ROWCOUNT = parseInt(process.env.SEMANTIC_SAMPLE_SKIP_LARGE_TABLE_ROWCOUNT || "0", 10);
const SAMPLE_TIMEOUT_MS = parseInt(process.env.SEMANTIC_SAMPLE_TIMEOUT_MS || "120000", 10);

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
  config: SqlConnectionConfig,
  options?: {
    includeTables?: string[];
    excludeTables?: string[];
    onProgress?: (e: { phase: "discover" | "profile"; totalTables: number; processedTables: number }) => void | Promise<void>;
  }
): Promise<{ snapshot: SemanticSnapshot; embeddings: EmbeddingItem[] }> {
  const includeSet = toNormalizedSet(options?.includeTables);
  const excludeSet = toNormalizedSet(options?.excludeTables);

  const { tables, embeddings } = await withSqlPool(config, async (pool) => {
    const metadata = await fetchSchemaMetadata(pool);
    const filtered = filterMetadata(metadata, includeSet, excludeSet);
    const total = filtered.tables.length;
    if (options?.onProgress) await options.onProgress({ phase: "discover", totalTables: total, processedTables: 0 });
    const tableProfiles = await buildTableProfiles(pool, filtered, options?.onProgress);
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
  },
  onProgress?: (e: { phase: "discover" | "profile"; totalTables: number; processedTables: number }) => void | Promise<void>
): Promise<TableProfile[]> {
  const profiles: TableProfile[] = [];
  const total = metadata.tables.length;
  const progressEvery = Math.max(1, Math.floor(total / 50));
  let processed = 0;
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
    processed++;
    if (onProgress && (processed % progressEvery === 0 || processed === total)) {
      await onProgress({ phase: "profile", totalTables: total, processedTables: processed });
    }
  }
  return profiles;
}

function filterMetadata(
  metadata: {
    tables: TableMetadata[];
    columns: ColumnMetadata[];
    foreignKeys: ForeignKeyMetadata[];
  },
  includeSet: Set<string> | null,
  excludeSet: Set<string> | null
) {
  let tables = metadata.tables;
  if (includeSet && includeSet.size > 0) {
    tables = tables.filter((table) => includeSet.has(normalizeKey(table.schema, table.name)));
  }
  if (excludeSet && excludeSet.size > 0) {
    tables = tables.filter((table) => !excludeSet.has(normalizeKey(table.schema, table.name)));
  }
  const tableKeys = new Set(tables.map((table) => normalizeKey(table.schema, table.name)));
  const columns = metadata.columns.filter((column) =>
    tableKeys.has(normalizeKey(column.schema, column.table_name))
  );
  const foreignKeys = metadata.foreignKeys.filter((fk) =>
    tableKeys.has(normalizeKey(fk.source_schema, fk.source_table)) &&
    tableKeys.has(normalizeKey(fk.target_schema, fk.target_table))
  );
  return { tables, columns, foreignKeys };
}

async function sampleColumnValues(
  pool: ConnectionPool,
  table: TableMetadata,
  columns: ColumnMetadata[]
): Promise<Record<string, string[]>> {
  const samples: Record<string, string[]> = {};
  if (SAMPLE_SKIP_LARGE_TABLE_ROWCOUNT > 0 && (table.approximate_row_count ?? 0) >= SAMPLE_SKIP_LARGE_TABLE_ROWCOUNT) {
    // Skip sampling entirely for very large tables to avoid timeouts
    return samples;
  }
  const candidates = columns
    .filter(shouldSampleColumn)
    .slice(0, SAMPLE_COLUMN_LIMIT);

  for (const column of candidates) {
    // Optionally skip very large/LOB-like columns which often cause scans
    const t = column.data_type.toLowerCase();
    const max = column.max_length;
    const skipLob = (process.env.SEMANTIC_SAMPLE_SKIP_LOB || "1") !== "0";
    if (skipLob && (t.includes("text") || t.includes("xml") || max == null || max === -1 || (typeof max === "number" && max > 4000))) {
      continue;
    }
    const expr = samplingExpression(column);
    // 1) Prefer TABLESAMPLE to avoid scanning/sorting huge tables
    const tsQuery = `SELECT TOP (${SAMPLE_TOP_SCAN_ROWS}) ${expr} AS value
      FROM ${formatTableName(table.schema, table.name)} TABLESAMPLE (${SAMPLE_TABLESAMPLE_ROWS} ROWS)
      WHERE ${expr} IS NOT NULL`;
    try {
      const result = await executeReadOnlyQuery(pool, tsQuery, {}, { timeoutMs: SAMPLE_TIMEOUT_MS });
      const values = uniqueStrings(result.recordset.map((row) => (row as Record<string, unknown>).value))
        .slice(0, SAMPLE_VALUE_LIMIT);
      if (values.length > 0) {
        samples[column.name] = values;
        continue;
      }
    } catch (error) {
      // Fallthrough to alternative strategy
    }

    // 2) Fallback: take first N non-null rows quickly and dedupe client-side
    const fastQuery = `SELECT TOP (${SAMPLE_TOP_SCAN_ROWS}) ${expr} AS value
      FROM ${formatTableName(table.schema, table.name)} WITH (NOLOCK)
      WHERE ${expr} IS NOT NULL
      OPTION (FAST ${Math.min(SAMPLE_TOP_SCAN_ROWS, 100)})`;
    try {
      const result = await executeReadOnlyQuery(pool, fastQuery, {}, { timeoutMs: SAMPLE_TIMEOUT_MS });
      const values = uniqueStrings(result.recordset.map((row) => (row as Record<string, unknown>).value))
        .slice(0, SAMPLE_VALUE_LIMIT);
      if (values.length > 0) {
        samples[column.name] = values;
        continue;
      }
    } catch (error) {
      console.warn(`Failed to sample column ${table.schema}.${table.name}.${column.name}`, error);
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

function samplingExpression(column: ColumnMetadata): string {
  const name = quoteIdentifier(column.name);
  const t = column.data_type.toLowerCase();
  // Cast long/text-like types to NVARCHAR(4000) to allow DISTINCT and avoid large LOB operations
  if (t.includes("text") || t.includes("xml") || t.includes("max")) {
    return `TRY_CONVERT(NVARCHAR(4000), ${name})`;
  }
  return name;
}

function uniqueStrings(values: unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    if (v == null) continue;
    const s = String(v);
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
      if (out.length >= SAMPLE_VALUE_LIMIT) break;
    }
  }
  return out;
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
    const response = await (await import("./openai")).withOpenAIRetry(() => client.responses.create({
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
    }));

    const parsed = extractJson(response);
    if (parsed && Array.isArray(parsed.tables)) {
      type TableSummaryEntry = {
        table_key?: unknown;
        description?: unknown;
        business_questions?: unknown;
      };
      const map: Map<string, TableSummaryEntry> = new Map(
        parsed.tables
          .map((entry: TableSummaryEntry) => {
            const key = typeof entry.table_key === "string" ? entry.table_key : undefined;
            return key ? ([key, entry] as [string, TableSummaryEntry]) : null;
          })
          .filter(
            (
              pair: [string, TableSummaryEntry] | null
            ): pair is [string, TableSummaryEntry] => pair !== null
          )
      );
      tables.forEach((table) => {
        const entry = map.get(table.key);
        if (entry) {
          const description = entry.description;
          if (typeof description === "string") {
            table.description = description;
          }
          const businessQuestions = entry.business_questions;
          if (Array.isArray(businessQuestions)) {
            table.businessQuestions = businessQuestions.filter(
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
    // Allow disabling embeddings entirely via env
    if ((process.env.SEMANTIC_EMBEDDINGS_ENABLED || "1") === "0") return;

    const MAX_CHARS = parseInt(process.env.SEMANTIC_EMBEDD_TEXT_MAX_CHARS || "6000", 10);
    const CHUNK_SIZE_DEFAULT = parseInt(process.env.SEMANTIC_EMBEDD_BATCH || "96", 10);

    const cleanTexts = items.map((it) => sanitizeText(it.text, MAX_CHARS));
    const validPairs: Array<{ item: EmbeddingItem; text: string }> = [];
    for (let i = 0; i < items.length; i++) {
      const t = cleanTexts[i];
      if (t && typeof t === "string" && t.trim().length > 0) {
        validPairs.push({ item: items[i], text: t });
      }
    }
    if (validPairs.length === 0) return;

    const chunks = chunkArray(validPairs, CHUNK_SIZE_DEFAULT);
    for (const chunk of chunks) {
      let batch = chunk;
      // Retry logic: if the batch fails as a whole, try smaller halves down to singletons
      let size = batch.length;
      while (size > 0) {
        try {
          const resp = await (await import("./openai")).withOpenAIRetry(() => client.embeddings.create({
            model: DEFAULT_EMBEDDING_MODEL,
            input: batch.map((p) => p.text),
          }));
          const vectors: number[][] = resp.data.map((e: any) => e.embedding);
          const records = vectors.map((vec, i) => ({
            key: batch[i].item.key,
            vector: vec,
            metadata: batch[i].item.metadata,
          }));
          const ids = await upsertVectors(orgId, records);
          ids.forEach((id, i) => (batch[i].item.embeddingId = id));
          break; // success for this chunk
        } catch (err: any) {
          // If invalid input / size issues, split the chunk and retry
          if (size === 1) {
            console.warn("Embedding failed for single item; skipping", { key: batch[0].item.key, err: err?.message });
            break;
          }
          const mid = Math.floor(batch.length / 2) || 1;
          const left = batch.slice(0, mid);
          const right = batch.slice(mid);
          // Process left immediately (loop will continue with right)
          try {
            const respLeft = await (await import("./openai")).withOpenAIRetry(() => client.embeddings.create({ model: DEFAULT_EMBEDDING_MODEL, input: left.map((p) => p.text) }));
            const vectorsLeft: number[][] = respLeft.data.map((e: any) => e.embedding);
            const recLeft = vectorsLeft.map((vec, i) => ({ key: left[i].item.key, vector: vec, metadata: left[i].item.metadata }));
            const idsLeft = await upsertVectors(orgId, recLeft);
            idsLeft.forEach((id, i) => (left[i].item.embeddingId = id));
            batch = right;
            size = batch.length;
            continue; // continue with right half
          } catch {
            // If left half also fails, reduce batch to singletons next iteration
            batch = left;
            size = batch.length > 1 ? Math.floor(batch.length / 2) : 1;
          }
        }
      }
    }
  } catch (error) {
    console.warn("Failed to create embeddings", error);
  }
}

function sanitizeText(text: unknown, maxChars: number): string {
  let s = typeof text === "string" ? text : String(text ?? "");
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > maxChars) s = s.slice(0, maxChars);
  return s;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function quoteIdentifier(identifier: string): string {
  const escaped = identifier.replace(/]/g, "]]" );
  return `[${escaped}]`;
}

export function formatTableName(schema: string, table: string): string {
  return `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
}

function toNormalizedSet(values?: string[] | null): Set<string> | null {
  if (!values || values.length === 0) return null;
  const normalized = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    normalized.add(value.toLowerCase());
  }
  return normalized.size > 0 ? normalized : null;
}

function normalizeKey(schema: string, table: string): string {
  return `${schema}.${table}`.toLowerCase();
}
