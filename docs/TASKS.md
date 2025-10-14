# Tasks & Roadmap — Leo AI Analytics

## Phase 0 — Environment & Access (0.5–1d)
- [x] Configure OPENAI_API_KEY, CONNECTION_ENCRYPTION_KEY, CONVEX_ADMIN_TOKEN.
- [ ] Confirm MS SQL network access (VPS IP allowlisted; TLS required).
- [ ] Prepare production DNS and TLS (leo.lb-tech.co.uk) on VPS.

## Phase 1 — Connector & Catalog (3–5d)
- [x] Add `mssql` driver and secure read‑only execution with timeouts and row caps.
- [x] Create Convex tables: orgConnections, semanticArtifacts, semanticSyncRuns, queryAudits.
- [x] Add API routes: create/list connections, test‑connection, schema, semantic‑sync.
- [x] Implement semantic sync: schema crawl, samples, LLM descriptions, embeddings, upsert artifacts.
- [ ] Vector store: wire Qdrant Cloud or Postgres+pgvector for production scale (swap from placeholder).
- [ ] Basic unit tests for read‑only enforcement and metadata extraction.

## Phase 2 — Ask Your Data (3–5d)
- [x] Add /api/ai/query using OpenAI Responses API with JSON schema outputs.
- [x] Guardrails: SELECT‑only, timeouts, caps; friendly error messages.
- [x] Audits: record question, SQL, rows, duration, status.
- [ ] Chart renderer: choose ECharts or Tremor; render charts from chart spec.
- [ ] Client AskPanel polish: streaming UI, follow‑up suggestions UX.

## Phase 3 — Dashboards (4–6d)
- [ ] Auto‑dashboard generator endpoint: prompt → 4–8 tiles (SQL + chart spec) with save API.
- [ ] Dashboard pages: grid layout editor, tile CRUD, global filters, share within org.
- [ ] Persistence: save tiles (SQL + chart spec) in Convex; quick filters.

## Phase 4 — Data Map & UX polish (3–5d)
- [ ] Data Map page: searchable catalog, join graph, row counts, freshness.
- [ ] Empty states, loaders, and error boundaries across flows.
- [ ] Accessibility pass (keyboard, contrasts, ARIA) and responsive checks.

## Phase 5 — Deployment & Ops (1–2d)
- [x] Provide systemd and Nginx templates.
- [ ] Provision VPS: Node via nvm, pnpm, build, enable service.
- [ ] Certbot TLS; health checks; log rotation; backups.

## Security & Compliance
- [ ] Verify no raw data replication; confirm sampling limits and redactions.
- [ ] Ensure read‑only SQL login; firewall outbound 1433; rotate secrets policy.
- [ ] Add per‑org rate limits; circuit breakers; cost monitoring.

## Acceptance (MVP)
- [ ] Real SQL connected; semantic sync artifacts visible in Data Map.
- [ ] 10 NL questions produce correct charts + visible SQL.
- [ ] Auto‑dashboard produces ≥ 4 tiles saved and viewable.
- [ ] Audits populated for all executions; errors are actionable.
