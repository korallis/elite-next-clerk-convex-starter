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

function isIpAddress(host: string): boolean {
  // IPv4
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return true;
  // IPv6 (very loose)
  if (/^[0-9a-fA-F:]+$/.test(host) && host.includes(":")) return true;
  return false;
}

function parseServerInput(raw: string): {
  host: string;
  portFromServer?: number;
  instanceName?: string;
} {
  let input = raw.trim();
  // strip tcp: prefix if present
  if (input.toLowerCase().startsWith("tcp:")) {
    input = input.slice(4);
  }
  let instanceName: string | undefined;
  // handle instance name e.g., host\\SQLEXPRESS
  const idxInstance = input.indexOf("\\");
  if (idxInstance > -1) {
    instanceName = input.slice(idxInstance + 1);
    input = input.slice(0, idxInstance);
  }
  let host = input;
  let portFromServer: number | undefined;
  // handle host,port or [ipv6],port
  const m = input.match(/^\[?([^\]]+)\]?,(\d{1,5})$/);
  if (m) {
    host = m[1];
    portFromServer = parseInt(m[2], 10);
  }
  return { host, portFromServer, instanceName };
}

function buildSqlConfig(config: SqlConnectionConfig): SqlConfig {
  const { server, database, user, password, port: portInput, options } = config;
  const { host, portFromServer, instanceName } = parseServerInput(server);
  const port = typeof portInput === "number" && portInput > 0 ? portInput : portFromServer ?? 1433;
  const mergedOptions: NonNullable<SqlConnectionConfig["options"]> & { instanceName?: string } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };
  if (instanceName) {
    (mergedOptions as any).instanceName = instanceName;
  }
  // If connecting via IP with TLS encryption, auto-trust the cert to avoid SNI/CN mismatch issues.
  if (isIpAddress(host) && mergedOptions.encrypt && mergedOptions.trustServerCertificate !== true) {
    mergedOptions.trustServerCertificate = true;
  }
  // For IP + TLS: set a benign SNI serverName to avoid Node's DEP0123 warning (safe when trustServerCertificate=true)
  if (isIpAddress(host) && mergedOptions.encrypt && mergedOptions.trustServerCertificate === true) {
    (mergedOptions as any).serverName = (mergedOptions as any).serverName || `sql-${host.replace(/[^a-zA-Z0-9]/g, "-")}.local`;
  }
  return {
    server: host,
    database,
    user,
    password,
    port,
    options: mergedOptions,
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
  options?: { maxRows?: number; timeoutMs?: number }
): Promise<IResult<unknown>> {
  const sanitizedQuery = enforceReadOnly(query);
  const request = pool.request();
  if (options?.timeoutMs && options.timeoutMs > 0) {
    // Override default request timeout for long-running reads
    (request as any).timeout = options.timeoutMs;
  }
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

export async function executeReadOnlyQueryWithRetry(
  pool: ConnectionPool,
  query: string,
  parameters: SqlParameters = {},
  options?: { maxRows?: number; timeoutMs?: number; retries?: number }
): Promise<IResult<unknown>> {
  const maxRetries = Math.max(0, Math.floor(options?.retries ?? 2));
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await executeReadOnlyQuery(pool, query, parameters, options);
    } catch (err: any) {
      const code = String(err?.code || "");
      const msg = String(err?.message || "").toLowerCase();
      const retriable = code.includes("ETIMEOUT") || /timeout|deadlock|closed|reset|econn/.test(msg);
      if (attempt >= maxRetries || !retriable) throw err;
      const delay = Math.min(500 * (attempt + 1), 3000) + Math.floor(Math.random() * 200);
      await new Promise((r) => setTimeout(r, delay));
      attempt++;
    }
  }
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
  // Tables with row counts (best-effort). Fallback to INFORMATION_SCHEMA only when sys.* access is restricted.
  let tables: TableMetadata[] = [];
  try {
    const tablesResult = await pool.request().query<TableMetadata>(`
      SELECT
        t.TABLE_SCHEMA AS [schema],
        t.TABLE_NAME AS [name],
        p.rows AS approximate_row_count
      FROM INFORMATION_SCHEMA.TABLES t
      LEFT JOIN sys.objects o
        ON o.object_id = OBJECT_ID(CONCAT(t.TABLE_SCHEMA, '.', t.TABLE_NAME))
      LEFT JOIN sys.partitions p
        ON p.object_id = o.object_id AND p.index_id IN (0,1)
      WHERE t.TABLE_TYPE = 'BASE TABLE'
      ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME;
    `);
    tables = tablesResult.recordset;
  } catch {
    // Fallback: omit row counts if sys.* is not accessible under the login.
    const fallback = await pool.request().query<TableMetadata>(`
      SELECT
        t.TABLE_SCHEMA AS [schema],
        t.TABLE_NAME AS [name],
        CAST(NULL AS BIGINT) AS approximate_row_count
      FROM INFORMATION_SCHEMA.TABLES t
      WHERE t.TABLE_TYPE = 'BASE TABLE'
      ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME;
    `);
    tables = fallback.recordset;
  }

  let columnsResult: { recordset: ColumnMetadata[] };
  try {
    columnsResult = await pool.request().query<ColumnMetadata>(`
      SELECT
        c.TABLE_SCHEMA AS [schema],
        c.TABLE_NAME AS table_name,
        c.COLUMN_NAME AS [name],
        c.DATA_TYPE AS data_type,
        c.IS_NULLABLE AS is_nullable,
        c.CHARACTER_MAXIMUM_LENGTH AS max_length,
        c.NUMERIC_PRECISION AS numeric_precision,
        c.NUMERIC_SCALE AS numeric_scale,
        COLUMNPROPERTY(OBJECT_ID(CONCAT(c.TABLE_SCHEMA, '.', c.TABLE_NAME)), c.COLUMN_NAME, 'IsIdentity') AS is_identity
      FROM INFORMATION_SCHEMA.COLUMNS c
      ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION;
    `);
  } catch {
    // Fallback without identity detection if permissions/functions are restricted
    columnsResult = await pool.request().query<ColumnMetadata>(`
      SELECT
        c.TABLE_SCHEMA AS [schema],
        c.TABLE_NAME AS table_name,
        c.COLUMN_NAME AS [name],
        c.DATA_TYPE AS data_type,
        c.IS_NULLABLE AS is_nullable,
        c.CHARACTER_MAXIMUM_LENGTH AS max_length,
        c.NUMERIC_PRECISION AS numeric_precision,
        c.NUMERIC_SCALE AS numeric_scale,
        CAST(NULL AS INT) AS is_identity
      FROM INFORMATION_SCHEMA.COLUMNS c
      ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION;
    `);
  }

  // Foreign keys: prefer sys.*; fallback to INFORMATION_SCHEMA when restricted.
  let foreignKeys: ForeignKeyMetadata[] = [];
  try {
    const foreignKeysResult = await pool
      .request()
      .query<ForeignKeyMetadata>(`
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
    foreignKeys = foreignKeysResult.recordset;
  } catch {
    // INFORMATION_SCHEMA fallback path
    const fallback = await pool
      .request()
      .query<ForeignKeyMetadata>(`
      SELECT
        tc.CONSTRAINT_NAME AS constraint_name,
        kcu.TABLE_SCHEMA AS source_schema,
        kcu.TABLE_NAME AS source_table,
        kcu.COLUMN_NAME AS source_column,
        kcu2.TABLE_SCHEMA AS target_schema,
        kcu2.TABLE_NAME AS target_table,
        kcu2.COLUMN_NAME AS target_column
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
        ON tc.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
        ON kcu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu2
        ON kcu2.CONSTRAINT_NAME = rc.UNIQUE_CONSTRAINT_NAME
      WHERE tc.CONSTRAINT_TYPE = 'FOREIGN KEY';
    `);
    foreignKeys = fallback.recordset;
  }

  return {
    tables,
    columns: columnsResult.recordset,
    foreignKeys,
  };
}
