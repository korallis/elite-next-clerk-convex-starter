# Technical Spec — Leo AI Analytics

## 1) Architecture
- Frontend: Next.js 15 (App Router, Tailwind v4, shadcn/ui dark theme), Clerk for auth/orgs.
- Backend: Next.js API routes for connector, semantic sync, and AI queries; Convex for metadata storage and auditing; OpenAI Responses API for structured outputs; optional Agents SDK later; MS SQL via `mssql` driver.
- Vector Layer: Start simple (Convex + embedding IDs), plug in Qdrant Cloud or Postgres+pgvector if/when needed.
- Hosting: Hostinger VPS (UK), Node via systemd on port 8080, Nginx reverse proxy + Certbot TLS at leo.lb-tech.co.uk.

## 2) Data Model (Convex)
- orgConnections: { orgId, name, driver:"mssql", encryptedConfig, createdBy, createdAt, updatedAt, lastVerifiedAt?, lastError? } — indexes: byOrg, byOrgAndName.
- semanticArtifacts: { orgId, connectionId, artifactType:"table|column", artifactKey, version, payload(JSON), embeddingId?, updatedAt } — indexes: byOrg, byConnection, byConnectionAndKey.
- semanticSyncRuns: { orgId, connectionId, status:"pending|running|completed|failed", startedAt, completedAt?, error? } — indexes: byOrg, byConnection, byStatus.
- queryAudits: { orgId, connectionId, userId, question, sql, rowCount, durationMs, status:"success|error", error?, createdAt } — indexes: byOrg, byConnection, byOrgCreatedAt.

## 3) Secrets/Env
- OPENAI_API_KEY — OpenAI API.
- CONNECTION_ENCRYPTION_KEY (32 bytes base64) — AES‑256‑GCM for connection configs.
- CONVEX_ADMIN_TOKEN — authorizes server→Convex admin mutations.
- CONVEX_DEPLOYMENT, NEXT_PUBLIC_CONVEX_URL — Convex endpoint.

## 4) MS SQL Connector
- Driver: `mssql` (Tedious). Enforce TLS (`encrypt: true`, `trustServerCertificate: false`), read‑only login, 30s query timeout, 5k default row cap.
- Fetch schema:
  - INFORMATION_SCHEMA for tables/columns; sys.foreign_key_columns for joins; approximate row counts via sys.partitions.
- Read‑only enforcement: allow only `SELECT` (including CTE); block DDL/DML keywords; add timeouts; cap rows.

## 5) Semantic Sync Pipeline
1. Crawl metadata (tables/columns/FKs + approximate row counts).
2. Sample up to N categorical columns per table with top‑K values (configurable, default 4×5).
3. Summarize tables via OpenAI (Responses API with JSON schema) → descriptions + example questions.
4. Build embedding items (table and column level) and embed (text‑embedding‑3‑large); store vectors’ IDs.
5. Upsert artifacts into Convex.

## 6) AI Orchestrator (Responses API)
- Inputs: NL question + retrieved semantic context (tables/columns/descriptions).
- Response schema: { sql, rationale, chart?, follow_up_questions? } strictly validated.
- Execution: Run SELECT with guardrails; return rows + generated chart spec.
- Auditing: Record success/error, duration, and rowCount.
- Optional later: Agents SDK to formalize tools (schema_search, run_sql, visualize) as functions with multi‑step control; Realtime API for voice.

## 7) API Endpoints (server)
- POST /api/data-sources — create and verify a connection, save to Convex.
- GET /api/data-sources — list connections for current org.
- POST /api/data-sources/test-connection — verify config without saving.
- POST /api/data-sources/schema — return live schema metadata for given config.
- POST /api/semantic-sync — run semantic snapshot, embeddings, and persist artifacts.
- POST /api/ai/query — NL→SQL, execute with guardrails, return data + chart + audit.

## 8) UI/UX Implementation Plan
- Keep dark theme; use shadcn components.
- Pages:
  - /dashboard: unified AnalyticsDashboard with connection management, semantic sync control, ask‑your‑data panel, and results table.
  - /dashboards/[id]: grid layout editor, tile CRUD, global filters.
  - /data-map: searchable catalog view with table cards and join graph.
- Components: ConnectionForm, SyncStatus, AskPanel, SqlResult, ChartRenderer (ECharts/Tremor), DashboardGrid.
- Accessibility: keyboard focus, reduced motion option, contrast.

## 9) Deployment
- Systemd service (deploy/systemd-service-example.service) on port 8080.
- Nginx reverse proxy (deploy/nginx.conf) + Certbot TLS.
- Env files: /etc/leo.env for server; Convex env via `npx convex env set`.
- Firewall: allow outbound TCP 1433 to SQL servers; IP allowlist on MS SQL side.

## 10) Observability & Safety
- Logs: Nginx access/error; app stdout/stderr; Convex logs.
- Cost/rate limits per org; circuit breakers on repeated failures.
- Privacy: redact secrets; configurable sampling policy; no raw data replication.

## 11) Acceptance Tests (excerpt)
- Connect to real SQL Server, run semantic sync, verify artifacts persisted.
- 10 NL prompts → valid SQL, correct results, chart renders, and audits stored.
- Auto‑dashboard prompt → ≥ 4 tiles saved and reloaded.
