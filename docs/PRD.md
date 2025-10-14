# Product Requirements Document (PRD) — Leo AI Analytics

## 1) Overview
Build a multi‑tenant, AI‑driven analytics web app that connects to each customer’s Microsoft SQL Server, builds a local semantic understanding of their schema (no raw data replication), and lets users ask questions in natural language or auto‑generate full dashboards. The app uses OpenAI’s latest Responses API (structured outputs + tool calling) and Agents SDK (optional), and runs on a Hostinger VPS (UK) behind Nginx at leo.lb-tech.co.uk.

## 2) Goals & Non‑Goals
- Goals
  - Zero‑setup insights: connect MS SQL, sync semantic model, ask questions, get charts.
  - Multi‑tenant isolation via Clerk Organizations; RBAC within org.
  - Strong safety: SELECT‑only SQL, timeouts, row caps, audit logs, no raw data replication.
  - Simple, dark‑themed UX suitable for non‑technical users.
- Non‑Goals
  - ETL/warehouse replacement, heavy data movement, or BI modeling DSLs.
  - Complex data governance or MDM; keep it minimal with clear auditing.

## 3) Personas
- Org Admin: sets up connection, manages members, oversees billing and access.
- Analyst/Manager: asks questions, builds dashboards, shares with team.
- Viewer: consumes dashboards and answers.

## 4) Key User Stories
1. As an Admin, I can securely add a read‑only MS SQL connection and run a semantic sync.
2. As a User, I can ask “What were monthly sales in 2024?” and get a correct chart + SQL.
3. As a User, I can ask “Build a sales performance dashboard for last 12 months” and receive 4–8 relevant tiles I can save and edit.
4. As a User, I can explore a Data Map to see tables, relationships, sample values, and freshness.
5. As an Admin, I can audit which questions and SQL were executed by whom and when.

## 5) Functional Requirements
- Data connections (MS SQL only in v1)
  - TLS, read‑only credentials, connection test, health status, firewall guidance.
  - Semantic sync: schema crawl, table/column stats, sample values, FK graph, LLM‑generated descriptions; embeddings for semantic search.
- Ask‑your‑data (NL→SQL)
  - Structured outputs enforce valid SQL and chart specs; safety checks (SELECT‑only, timeouts, caps) with error messaging and clarifications.
  - Show SQL, row count, and execution time; downloadable CSV.
- Auto‑dashboard
  - Given a prompt, generate multiple tiles (KPIs, trends, breakdowns) with editable SQL/chart specs; save to dashboard.
- Dashboards
  - Grid layout, edit mode, global filters, sharing within org (RBAC).
- Data Map
  - Catalog view with search, table descriptions, columns, joins, row counts, freshness.
- Multi‑tenancy & RBAC
  - Clerk Organizations; roles: admin, member, viewer.
- Auditing & Cost Controls
  - Log each question, SQL, rows returned, duration, and outcome; daily rate limits per org.

## 6) Non‑Functional Requirements
- Performance: typical questions complete < 8s; background jobs for heavy sync.
- Reliability: graceful timeouts, retries for metadata/embeddings; persistent audit logs.
- Privacy & Security: no raw data replication; only schema, aggregates, and small samples; encrypted connection configs; SELECT‑only SQL.
- Compliance: UK VPS, UK/EU data handling posture; configurable sampling policy.

## 7) Success Metrics
- TTFI for first insight < 10 minutes after connection.
- ≥ 80% of natural‑language questions answered correctly on first attempt.
- ≥ 70% of generated dashboards accepted by users with minimal edits.

## 8) Acceptance Criteria (MVP)
- Real MS SQL connection added and verified; semantic sync completes and catalog visible.
- 10 representative NL questions produce correct SQL and charts with visible SQL.
- Auto‑dashboard creates ≥ 4 tiles that users can save and re‑open.
- Auditing shows who asked what, SQL executed, rows, duration.

## 9) UI/UX (Dark Theme Preserved)
- Onboarding wizard (3 steps): credentials → include/exclude tables → run first sync.
- Data Sources page: list connections, status, last sync, errors; “Run Semantic Sync”.
- Ask page: chat‑like prompt, streaming answer, tabs (Answer, Data & SQL, Explain), “Pin to dashboard”.
- Dashboards: modern dark grid, inline edit, global date/org filters, share.
- Data Map: searchable catalog, join graph, row counts, freshness badges.
- Polished empty‑states, errors, and progress indicators; responsive layout.

## 10) Out of Scope (v1)
- Multi‑DB joins across sources; write‑back; real‑time alerting; complex row‑level security.
