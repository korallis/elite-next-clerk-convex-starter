import sql, { config as SqlConfig, ConnectionPool, IResult } from "mssql";
import { z } from "zod";

export const sqlConnectionConfigSchema = z.object({
  server: z.string().min(1, "server is required"),
  database: z.string().min(1, "database is required"),
  user: z.string().min(1, "user is required"),
  password: z.string().min(1, "password is required"),
  port: z
    .number()
    .int()
    .positive()
    .optional()
    .default(1433),
  options: z
    .object({
      encrypt: z.boolean().optional(),
      trustServerCertificate: z.boolean().optional(),
    })
    .optional(),
});

export type SqlConnectionConfig = z.infer<typeof sqlConnectionConfigSchema>;

const DEFAULT_OPTIONS: NonNullable<SqlConnectionConfig["options"]> = {
  encrypt: true,
  trustServerCertificate: false,
};

function buildSqlConfig(config: SqlConnectionConfig): SqlConfig {
  const { server, database, user, password, port = 1433, options } = config;
  return {
    server,
    database,
    user,
    password,
    port,
    options: { ...DEFAULT_OPTIONS, ...options },
    requestTimeout: 30_000,
    connectionTimeout: 15_000,
    pool: {
      max: 2,
      min: 0,
      idleTimeoutMillis: 5_000,
    },
  } satisfies SqlConfig;
}

export async function withSqlPool<T>(
  config: SqlConnectionConfig,
  fn: (pool: ConnectionPool) => Promise<T>
): Promise<T> {
  const sqlConfig = buildSqlConfig(config);
  const pool = new sql.ConnectionPool(sqlConfig);
  try {
    await pool.connect();
    return await fn(pool);
  } finally {
    pool.close().catch(() => {
      /* noop */
    });
  }
}

export type SqlParameters = Record<string, unknown>;

export async function executeReadOnlyQuery(
  pool: ConnectionPool,
  query: string,
  parameters: SqlParameters = {},
  options?: { maxRows?: number }
): Promise<IResult<unknown>> {
  const sanitizedQuery = enforceReadOnly(query);
  const request = pool.request();
  for (const [name, value] of Object.entries(parameters)) {
    request.input(name, value as never);
  }
  if (options?.maxRows) {
    return request.query(
      `SET ROWCOUNT ${options.maxRows}; ${sanitizedQuery}; SET ROWCOUNT 0;`
    );
  }
  return request.query(sanitizedQuery);
}

export function enforceReadOnly(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error("Query is required");
  }
  const normalized = trimmed.replace(/^[\uFEFF\u200B]+/, "");
  const startsWithSelect = /^WITH\s+/.test(normalized.toUpperCase())
    ? /^WITH\s+[\s\S]*?SELECT/i.test(normalized)
    : normalized.toUpperCase().startsWith("SELECT");
  if (!startsWithSelect) {
    throw new Error("Only SELECT statements are permitted");
  }
  if (/\b(INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|TRUNCATE|CREATE)\b/i.test(normalized)) {
    throw new Error("Mutating statements are not allowed");
  }
  return normalized;
}

export type TableMetadata = {
  schema: string;
  name: string;
  approximate_row_count: number | null;
};

export type ColumnMetadata = {
  schema: string;
  table_name: string;
  name: string;
  data_type: string;
  is_nullable: "YES" | "NO";
  max_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
  is_identity: number | null;
};

export type ForeignKeyMetadata = {
  constraint_name: string;
  source_schema: string;
  source_table: string;
  source_column: string;
  target_schema: string;
  target_table: string;
  target_column: string;
};

export async function fetchSchemaMetadata(pool: ConnectionPool) {
  const tablesResult = await pool.request<TableMetadata>().query(`
    SELECT
      t.TABLE_SCHEMA AS schema,
      t.TABLE_NAME AS name,
      p.rows AS approximate_row_count
    FROM INFORMATION_SCHEMA.TABLES t
    LEFT JOIN sys.objects o
      ON o.object_id = OBJECT_ID(CONCAT(t.TABLE_SCHEMA, '.', t.TABLE_NAME))
    LEFT JOIN sys.partitions p
      ON p.object_id = o.object_id AND p.index_id IN (0,1)
    WHERE t.TABLE_TYPE = 'BASE TABLE'
    ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME;
  `);

  const columnsResult = await pool.request<ColumnMetadata>().query(`
    SELECT
      c.TABLE_SCHEMA AS schema,
      c.TABLE_NAME AS table_name,
      c.COLUMN_NAME AS name,
      c.DATA_TYPE AS data_type,
      c.IS_NULLABLE AS is_nullable,
      c.CHARACTER_MAXIMUM_LENGTH AS max_length,
      c.NUMERIC_PRECISION AS numeric_precision,
      c.NUMERIC_SCALE AS numeric_scale,
      COLUMNPROPERTY(OBJECT_ID(CONCAT(c.TABLE_SCHEMA, '.', c.TABLE_NAME)), c.COLUMN_NAME, 'IsIdentity') AS is_identity
    FROM INFORMATION_SCHEMA.COLUMNS c
    ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION;
  `);

  const foreignKeysResult = await pool
    .request<ForeignKeyMetadata>()
    .query(`
    SELECT
      fk.name AS constraint_name,
      sch1.name AS source_schema,
      tab1.name AS source_table,
      col1.name AS source_column,
      sch2.name AS target_schema,
      tab2.name AS target_table,
      col2.name AS target_column
    FROM sys.foreign_key_columns fkc
    INNER JOIN sys.objects fk ON fkc.constraint_object_id = fk.object_id
    INNER JOIN sys.tables tab1 ON tab1.object_id = fkc.parent_object_id
    INNER JOIN sys.schemas sch1 ON tab1.schema_id = sch1.schema_id
    INNER JOIN sys.columns col1 ON col1.column_id = fkc.parent_column_id AND col1.object_id = tab1.object_id
    INNER JOIN sys.tables tab2 ON tab2.object_id = fkc.referenced_object_id
    INNER JOIN sys.schemas sch2 ON tab2.schema_id = sch2.schema_id
    INNER JOIN sys.columns col2 ON col2.column_id = fkc.referenced_column_id AND col2.object_id = tab2.object_id;
  `);

  return {
    tables: tablesResult.recordset,
    columns: columnsResult.recordset,
    foreignKeys: foreignKeysResult.recordset,
  };
}
