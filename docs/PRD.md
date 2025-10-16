# Leo AI Analytics — Product Requirements Document (PRD)

> Version 1.0 — Updated for engineering handoff (April 2025)

## 1. Executive Summary
Leo AI Analytics is a multi-tenant, AI-assisted analytics platform that enables non-technical business teams to derive insights from their Microsoft SQL Server data without building pipelines or dashboards manually. The product targets UK/EU mid-market operators with limited data engineering capacity who need rapid time-to-first-insight (TTFI) and governed self-service analytics. By connecting securely to a customer’s read-only MSSQL instance, the platform builds a lightweight semantic layer—schema metadata, statistical profiles, embeddings—and uses OpenAI’s Responses API with structured tool calling to convert natural language questions into safe, auditable SQL.

The technical approach balances automation and guardrails: semantic sync jobs capture only metadata and small samples, the NL→SQL pipeline enforces templates for SELECT-only queries, and dashboard generation composes curated tiles users can adjust before saving. Deployment runs on a Hostinger UK VPS with Nginx, Node.js (Next.js 15), Convex, Qdrant, and Clerk for authentication/RBAC. Success is measured by sub-10-minute onboarding, fast answers (<8s P95), high first-run accuracy (≥80%), cost transparency, and auditability across tenants.

Success criteria focus on three pillars: (1) Operational readiness—secure multi-tenant isolation, infrastructure-as-code deployment, and observability; (2) Product outcomes—80% accurate NL answers, ≥70% accepted auto-dashboards, <10 minute TTFI; and (3) Compliance & trust—Clerk-backed RBAC, encrypted secrets, auditable query logs, and EU data handling posture. A phased roadmap delivers reliable foundations first, followed by feature depth and scale improvements.

### 1.1 Goals & Non-Goals

| Category | Goals | Non-Goals |
| --- | --- | --- |
| Product | Zero-setup insights via MSSQL connection, semantic sync, NL→SQL, dashboard auto-generation | Replace full BI stacks, provide ETL/warehouse, complex data governance/MDM |
| Security | SELECT-only SQL, complete audit trails, encrypted credentials, multi-tenant isolation | Row-level security beyond roles, support for write-back or DDL operations |
| UX | Dark theme, conversational interface, accessible for non-technical roles, responsive design | Complex customization engines, white-label theming, pixel-perfect mobile parity |
| Operations | Run on Hostinger UK VPS with Nginx reverse proxy, support CI/CD and monitoring, rate limit usage | Multi-region active-active setup, real-time alerting in v1 |

### 1.2 Target Personas & Needs

| Persona | Responsibilities | Pain Points | Critical Capabilities |
| --- | --- | --- | --- |
| **Organization Admin** | Provision MSSQL connection, manage members, oversee billing & compliance | Limited IT staff, need safe read-only access, must enforce governance | Secure connection wizard, RBAC management, audit & usage reports |
| **Analyst/Manager** | Ask ad-hoc questions, build dashboards, communicate insights | SQL skills vary, limited time to maintain dashboards | Conversational querying, editable auto-generated dashboards, exportable SQL/CSV |
| **Viewer** | Consume dashboards, track KPIs | Needs clarity, mobile-aware, trust in data freshness | Read-only dashboard access, annotations, data freshness indicators |

### 1.3 Key User Stories
1. As an Admin, I can securely add a read-only MSSQL connection, validate credentials, and run a semantic sync without exposing raw data externally.
2. As a User, I can ask “What were monthly sales in 2024?” and receive an accurate chart, insight narrative, and underlying SQL.
3. As a User, I can ask “Build a sales performance dashboard for the last 12 months” and receive a curated dashboard (4–8 tiles) I can edit, save, and share.
4. As a User, I can browse a Data Map containing tables, metrics, relationships, sample values, and freshness indicators for confidence.
5. As an Admin, I can review audit logs showing question text, generated SQL, execution metadata, and response status per tenant user.

### 1.4 Success Metrics
- **TTFI:** <10 minutes from connection to first validated insight.
- **NL Accuracy:** ≥80% of natural-language questions produce correct SQL and charts on first attempt (validated via test suite).
- **Dashboard Adoption:** ≥70% of auto-generated dashboards are saved without major edits.
- **Performance:** NL→SQL answers in <8s P95, dashboards loading <4s P95.
- **Trust & Safety:** 100% of executed SQL audited; 0 critical security incidents.

## 2. Technical Architecture

### 2.1 System Overview
```mermaid
graph TD
    A[User Browser<br/>Next.js UI] -->|HTTPS| B[Next.js App Router]
    B -->|Session| C[Clerk Authentication]
    B -->|Queries| D[Convex Functions]
    D -->|Semantic Sync Jobs| E[Semantic Orchestrator]
    E -->|Metadata| F[(Convex Storage)]
    E -->|Embeddings| G[Qdrant Vector Store]
    D -->|Streaming Query| H[OpenAI Responses API]
    D -->|SQL Execution| I[MS SQL Server<br/>(Tenant Network)]
    B -->|Static Assets| J[CDN]
    B -->|Logs & Metrics| K[Grafana/Loki]
    D -->|Audit Logs| L[(PostgreSQL Audit DB)]
    M[Nginx Reverse Proxy] --> B
    B -->|Webhooks| N[Clerk Webhooks]
```

The Next.js 15 application serves UI and orchestrates API routes. Clerk handles multi-tenant authentication and organization management. Convex hosts serverless functions for semantic sync, NL→SQL requests, dashboard persistence, and auditing. OpenAI’s Responses API provides reasoning and SQL generation. Qdrant stores embeddings for semantic search. MSSQL connections stay in customer environments; Leo executes parameterized SELECT queries through secure tunnels. Nginx terminates TLS and proxies traffic to Next.js. Metrics/logs are centralized via Grafana/Loki.

### 2.2 Technology Stack & Justification

| Layer | Technology | Version | Rationale |
| --- | --- | --- | --- |
| Frontend | Next.js | 15.x | App Router, React Server Components, good SSR, aligns with existing codebase |
| Styling | TailwindCSS v4 + Shadcn UI | 4.x | Rapid dark-theme development, component consistency |
| State/Data | React Query + Convex Hooks | Latest | Real-time data sync, optimistic updates |
| Auth | Clerk | 5.x | Multi-tenant organizations, RBAC, webhooks |
| Backend Runtime | Node.js | 20 LTS | Stable, supports Fetch API |
| Serverless | Convex | Latest | Scalable function execution, scheduling |
| AI | OpenAI Responses API | gpt-4.1 or gpt-4.1-mini | Structured outputs, tool calling |
| Vector Store | Qdrant | 1.11+ | High-performance similarity search, tenant isolation |
| Database | MSSQL (customer) | 2019+ | Customer-owned data source |
| Audit Storage | PostgreSQL (managed) | 15.x | ACID storage for audits |
| Infrastructure | Hostinger VPS (UK), Nginx | Ubuntu 22.04 | Meets residency & cost constraints |
| Observability | Grafana/Loki, Prometheus | Latest | Metrics, logs, alerting |

### 2.3 Data Flow Scenarios

#### 2.3.1 Natural Language to SQL Flow
```mermaid
sequenceDiagram
    participant U as User
    participant UI as Next.js Client
    participant API as Convex NL Service
    participant OAI as OpenAI Responses API
    participant SQL as MSSQL Read Replica
    participant AUD as Audit Store

    U->>UI: Enter NL question
    UI->>API: POST /api/ai/query {prompt}
    API->>OAI: Structured prompt + tools
    OAI-->>API: Proposed SQL + chart spec
    API->>SQL: Execute parameterized SELECT
    SQL-->>API: Result set (rows <= 5k)
    API->>AUD: Log query + metadata
    API-->>UI: Streamed answer, chart, SQL
    UI-->>U: Render visualization & narrative
```

#### 2.3.2 Semantic Sync Flow
```mermaid
flowchart LR
    Start((Start Sync)) --> CrawlTables[Fetch table list]
    CrawlTables --> AnalyzeColumns[Compute stats & infer types]
    AnalyzeColumns --> SampleValues[Pull limited samples]
    SampleValues --> BuildGraph[Infer relationships]
    BuildGraph --> GenDescriptions[OpenAI generates descriptions]
    GenDescriptions --> EmbedMetadata[Embed table/column names]
    EmbedMetadata --> Persist[Store in Convex + Qdrant]
    Persist --> End((Complete))
```

### 2.4 Security Architecture
- **Authentication & Sessions:** Clerk hosts user accounts/orgs. JWT tokens scoped per organization include role claims and expire in 1 hour. Refresh handled by Clerk.
- **Authorization:** API routes check Clerk org + role before access. Convex functions validate tenantId on every data access. Data retrieval limited via parameterized queries.
- **Data Protection:** MSSQL credentials encrypted with libsodium and stored in Convex environment. All traffic uses TLS 1.3. SELECT queries limited to whitelisted schemas/tables defined by admin. No raw data stored; only metadata, aggregates, and small samples (≤50 rows/table).
- **Auditing:** Every NL query, dashboard render, or sync event writes to immutable audit log (PostgreSQL) with orgId, userId, SQL, timestamps, row counts.
- **Monitoring & Alerts:** Suspicious access (failed login, rate limit breaches) flagged. Secrets rotated quarterly.

### 2.5 Deployment Architecture
```mermaid
graph LR
    subgraph Hostinger VPS (UK)
        N[Nginx Reverse Proxy]
        S[Next.js Server (Node 20)]
        C[Convex Deployment]
        Q[Qdrant Container]
        G[Prometheus Node Exporter]
    end
    N -->|443->3000| S
    S -->|Convex client| C
    C -->|Vector API| Q
    S -->|Static assets| CDN[(Vercel Edge CDN)]
    S -->|Logs| Loki[(Grafana Loki)]
    subgraph Customer Network
        MSSQL[MSSQL Server]
    end
    C -->|IP allowlist + TLS| MSSQL
    S -->|Webhooks| Clerk[Clerk SaaS]
    C -->|OpenAI API| OAI[OpenAI]
```

Deployment uses Docker Compose with services for Next.js, Convex, Qdrant, Prometheus exporters, and Loki agent. Nginx terminates SSL (Let’s Encrypt) and proxies to Node/Convex. Backups push to S3-compatible storage daily. Cloudflare DNS routes `leo.lb-tech.co.uk` to the VPS.

### 2.6 Infrastructure Considerations
- **Scaling:** Vertical scaling (Hostinger VPS upgrade) + horizontal scaling via container orchestration (future). Convex handles auto-scaling for functions.
- **High Availability:** Single VPS with daily snapshots; phase 3 introduces standby replica. MSSQL connectivity relies on customer reliability; support read replicas.
- **Network:** Allowlist Leo static IP on customer firewalls. Support SSH tunnel or Azure hybrid connections in later phases.

## 3. Detailed Feature Specifications

### 3.1 Data Connections & Semantic Sync

#### 3.1.1 Description
Admins add MSSQL connections (read-only credentials). A three-step wizard validates connectivity, lets admins include/exclude schemas, and triggers semantic sync jobs capturing metadata.

#### 3.1.2 User Flow
```mermaid
flowchart TD
    Start((Start Wizard)) --> Step1[Enter connection details]
    Step1 --> TestConn{Test connection}
    TestConn -- Success --> Step2[Select schemas/tables]
    TestConn -- Failure --> ErrorModal[Show error & guidance]
    Step2 --> Step3[Review & confirm]
    Step3 --> LaunchSync[Launch semantic sync job]
    LaunchSync --> Progress[Show progress UI]
    Progress --> Done((Connection ready))
```

#### 3.1.3 UI/UX Wireframe Description
- **Step 1:** Form with inputs (hostname, port, database, username, password, optional SSH). Display host allowlist instructions. CTA “Test Connection”.
- **Step 2:** Tree view of schemas/tables with checkboxes, default all included. Show row counts (if accessible) and warnings for large tables.
- **Step 3:** Summary, schedule next sync toggle, start sync button. On success, progress bar with stages and logs.
- **Status Badges:** Connected, Syncing, Error (with tooltip).

#### 3.1.4 API Contract

| Endpoint | Method | Description | Request | Response |
| --- | --- | --- | --- | --- |
| `/api/data-sources` | POST | Create connection | `{ name, host, port, db, username, password, useSsh, sshConfig, includeTables[] }` | `201 { dataSourceId, status }` |
| `/api/data-sources/test-connection` | POST | Validate credentials | `{ host, port, db, username, password }` | `200 { ok: true, latencyMs }` or `422 { errorCode, message }` |
| `/api/semantic-sync` | POST | Start sync | `{ dataSourceId, triggeredBy }` | `202 { jobId }` |

**Sample Request**
```json
{
  "name": "Northwind Read",
  "host": "sql.leo-customer.co.uk",
  "port": 1433,
  "db": "Northwind",
  "username": "leo_reader",
  "password": "<encrypted>",
  "includeTables": ["dbo.Orders", "dbo.Customers"],
  "schedule": { "interval": "24h" }
}
```

#### 3.1.5 Validation Rules

| Field | Rule | Error Message |
| --- | --- | --- |
| Host | Must be FQDN/IP, not local | “Provide a valid hostname or IP address.” |
| Port | Integer 1–65535 | “Port must be a valid number between 1 and 65535.” |
| Username/Password | Non-empty, no whitespace | “Credentials are required.” |
| Include Tables | At least one selected | “Select at least one table to sync.” |
| SSH Config | Required if useSsh=true | “SSH configuration required when tunneling.” |

#### 3.1.6 Edge Cases & Error Handling
- **Firewall Blocked:** Show troubleshooting tips (allowlist IP, port check). Allow retry without re-entering all fields.
- **Large Schema:** Warn if >200 tables; recommend selective sync. Background sync can paginate metadata.
- **Credential Rotation:** On connection failure, mark status “Action Required” and send email to admins.
- **Partial Sync Failure:** Continue other tables, surface tasks needing review.

#### 3.1.7 Semantic Sync State Machine
```mermaid
stateDiagram-v2
    [*] --> Pending
    Pending --> Running : jobStarted
    Running --> WaitingForLLM : metadataCaptured
    WaitingForLLM --> Running : embeddingsGenerated
    Running --> Completed : persisted
    Running --> Failed : unrecoverableError
    Failed --> Pending : retryScheduled
```

### 3.2 Ask (Natural Language to SQL)

#### 3.2.1 Description
Users enter conversational prompts; the system generates SQL, validates safety, executes queries, and returns narratives, charts, and SQL for inspection.

#### 3.2.2 User Flow Diagram
```mermaid
sequenceDiagram
    participant User
    participant UI as Ask UI
    participant Backend as NL Service
    participant Guard as Safety Layer
    participant DB as MSSQL

    User->>UI: Submit prompt
    UI->>Backend: sendPrompt()
    Backend->>Guard: proposeSQL()
    Guard-->>Backend: safetyReport
    Backend->>DB: execute SQL (if safe)
    DB-->>Backend: result set / timeout
    Backend-->>UI: stream answer (Answer, SQL, Explain tabs)
    UI-->>User: render chart + narrative
```

#### 3.2.3 UI/UX Description
- **Layout:** Chat-style input at bottom, conversation history on left, result pane with tabs (Answer, Data & SQL, Explain). Show streaming tokens.
- **Answer Tab:** Chart with caption (e.g., bar, line). Narrative summary. Insight callouts.
- **Data & SQL Tab:** Paginated table (max 200 rows), SQL editor with syntax highlight, copy button, download CSV.
- **Explain Tab:** Outline of reasoning steps, assumptions, data coverage.
- **Actions:** “Pin to dashboard”, “Request clarification”.

#### 3.2.4 API Contract & Code Example

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/ai/query` | POST | Submit NL question |
| `/api/ai/query/stream` | GET (SSE) | Stream answer tokens |

**Sample Request (tool calling)**
```json
{
  "prompt": "What were monthly sales in 2024?",
  "context": {
    "tenantId": "org_123",
    "selectedTables": ["sales_orders", "customers"],
    "timezone": "Europe/London"
  }
}
```

**Sample OpenAI Tool Call**
```json
{
  "tool": "execute_sql",
  "input": {
    "sql": "SELECT DATEFROMPARTS(YEAR(order_date), MONTH(order_date), 1) AS month, SUM(total_amount) AS sales FROM sales_orders WHERE order_date BETWEEN @start AND @end GROUP BY DATEFROMPARTS(YEAR(order_date), MONTH(order_date), 1) ORDER BY month;",
    "params": {
      "@start": "2024-01-01",
      "@end": "2024-12-31"
    },
    "chart": {
      "type": "line",
      "x": "month",
      "y": "sales"
    }
  }
}
```

#### 3.2.5 Validation & Safety Checks
- Reject prompts exceeding 2,000 characters.
- Enforce rate limit: 60 questions/hour/org.
- Safety layer ensures SQL is SELECT-only, no system tables, row cap ≤ 5,000, estimated cost <5s.
- Retry up to twice with clarified prompt if SQL fails.

#### 3.2.6 Edge Cases
- **Ambiguous Prompt:** Return follow-up questions (e.g., “Which metric do you want?”).
- **Empty Results:** Display zero-state with suggestion (e.g., broaden date range).
- **Query Timeout (>8s):** Abort, show friendly message, autosuggest filters.
- **Schema Drift:** If table missing, trigger schema resync and inform user.

#### 3.2.7 Query Execution State Machine
```mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> Validated : guardrailsPass
    Validated --> Executing : dbCall
    Executing --> Completed : rowsReturned
    Executing --> Failed : dbError
    Failed --> Draft : autoRetry
```

### 3.3 Auto-Dashboard Generation

#### 3.3.1 Description
Generates dashboards from prompts or suggested templates. Each dashboard contains curated tiles (KPIs, charts, tables) with editable SQL and chart specs.

#### 3.3.2 User Flow
```mermaid
flowchart TD
    Start((Prompt)) --> AnalyzeIntent[Determine domain & goals]
    AnalyzeIntent --> ProposeTiles[Generate tile specs]
    ProposeTiles --> ValidateTiles[Run guardrails]
    ValidateTiles --> ExecuteTiles[Execute SQL for each tile]
    ExecuteTiles --> RenderPreview[Render dashboard preview]
    RenderPreview --> UserChoice{Accept?}
    UserChoice -- Yes --> SaveDashboard[Persist dashboard]
    UserChoice -- No --> EditTiles[Allow manual edits]
    EditTiles --> SaveDashboard
```

#### 3.3.3 UI/UX Wireframe Description
- **Prompt Drawer:** Input with suggestions (“Revenue overview”, “Customer retention”). Option to choose time horizon.
- **Preview:** Grid layout (2 columns desktop, 1 column mobile). Tiles show chart, SQL snippet, status (ready/loading/error).
- **Tile Actions:** Edit SQL (monaco editor), change visualization type, add filters, duplicate, delete.
- **Dashboard Settings:** Title, description, sharing options.

#### 3.3.4 API Summary

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/ai/auto-dashboard` | POST | Generate dashboard proposal |
| `/api/dashboards` | POST | Save dashboard |
| `/api/dashboards/{id}` | PATCH | Update layout/tiles |

#### 3.3.5 Dashboard Generation State Machine
```mermaid
stateDiagram-v2
    [*] --> GatheringContext
    GatheringContext --> ProposingTiles
    ProposingTiles --> Validating
    Validating --> ExecutingTiles
    ExecutingTiles --> DraftReady
    DraftReady --> Published : userSaves
    DraftReady --> Discarded : userCancels
```

#### 3.3.6 Edge Cases
- **Tile Execution Timeout:** Mark tile as “Needs Review” and allow manual fix.
- **Data Mismatch (e.g., no numeric columns):** Default to table view and notify user.
- **Duplicate Metric:** System deduplicates similar tiles using embedding similarity.

### 3.4 Dashboards & Sharing
- **Features:** Grid layout (drag/drop, resize), global filters (date range, org dimension), share with roles (Viewer+).
- **UI:** Dashboard toolbar with filters, auto-refresh toggle, share button, version history.
- **API:** `/api/dashboards/{id}/tiles`, `/api/dashboards/save-tile`, `/api/dashboards/tiles/{tileId}/delete`.
- **Edge Cases:** Missing tile -> show placeholder with option to refresh SQL; stale data -> display freshness badge.
- **Validation:** Dashboard name required, unique within org; layout validated to avoid overlaps.

### 3.5 Data Map
- **Features:** Searchable catalog, table detail view (columns, types, sample values, row counts, last sync), relationship graph.
- **User Flow:** List view -> click table -> slide-over with metadata -> view join graph -> request sample queries.
- **Diagram**
```mermaid
flowchart LR
    Catalog[List of tables] --> DetailView[Table detail]
    DetailView --> Columns[Columns & stats]
    DetailView --> Samples[Sample rows]
    DetailView --> Relationships[Join graph]
    Relationships --> SuggestedQuestions
```
- **Edge Cases:** Stale sync (>72h) -> highlight with warning; restricted table -> show lock icon.

### 3.6 Auditing & Cost Controls
- **Features:** Audit log table with filters (user, date, outcome), export CSV, daily usage summary (tokens, rows), rate limit config per org.
- **UI:** Admin console tab “Audit & Usage” with charts (queries/day, spend estimate).
- **API:** `/api/audit-logs`, `/api/org/quota`.
- **Edge Cases:** Heavy usage -> send email alerts; PII detection -> mask logs.

## 4. Data Model & Schema

### 4.1 Entity Relationship Diagram
```mermaid
erDiagram
    ORGANIZATIONS ||--o{ USERS : has
    ORGANIZATIONS ||--o{ DATA_SOURCES : owns
    ORGANIZATIONS ||--o{ DASHBOARDS : contains
    ORGANIZATIONS ||--o{ AUDIT_LOGS : records
    DATA_SOURCES ||--o{ SEMANTIC_ARTIFACTS : produces
    DASHBOARDS ||--o{ DASHBOARD_TILES : includes
    USERS ||--o{ AUDIT_LOGS : performs
    SEMANTIC_ARTIFACTS ||--o{ EMBEDDINGS : indexes
    DASHBOARD_TILES }o--|| QUERY_CACHE : uses
```

### 4.2 Table Specifications

| Table | Purpose | Key Columns | Constraints/Indexes |
| --- | --- | --- | --- |
| `organizations` | Tenant metadata | `id (UUID)`, `name`, `billingPlan`, `createdAt` | PK(id), unique(name) |
| `users` | Tenant users | `id`, `clerkUserId`, `orgId`, `email`, `role`, `status` | FK(orgId)→organizations.id, index on (orgId, role) |
| `data_sources` | MSSQL connections | `id`, `orgId`, `name`, `host`, `port`, `database`, `encryptedCredentials`, `status`, `lastSyncAt` | FK(orgId), unique(orgId, name) |
| `semantic_artifacts` | Stored metadata JSON | `id`, `dataSourceId`, `type`, `payload`, `checksum`, `createdAt` | FK(dataSourceId), index(type) |
| `embeddings` | Vector representations | `id`, `artifactId`, `vector(1536)`, `metadata` | FK(artifactId), vector index |
| `dashboards` | Dashboard definitions | `id`, `orgId`, `title`, `description`, `layout`, `createdBy`, `isArchived` | FK(orgId), index(orgId, isArchived) |
| `dashboard_tiles` | Individual tiles | `id`, `dashboardId`, `title`, `sql`, `visualType`, `config`, `refreshInterval` | FK(dashboardId) |
| `query_cache` | Cached results | `id`, `tileId`, `hash`, `result`, `expiresAt` | FK(tileId), unique(tileId, hash) |
| `audit_logs` | Immutable audit entries | `id`, `orgId`, `userId`, `action`, `sql`, `rowCount`, `durationMs`, `timestamp`, `status`, `metadata` | FK(orgId), FK(userId), btree index on (orgId, timestamp) |

### 4.3 Data Lifecycle
- **Creation:** Connections created by admins; semantic artifacts generated via sync; dashboards via UI or auto-generation.
- **Updates:** Credentials rotated -> new encrypted blobs; dashboards versioned on save; semantic artifacts replaced on each sync with checksum diff.
- **Retention:** Audit logs retained 24 months, archived to cold storage quarterly. Query cache TTL = 4 hours. Orgs deleted -> soft delete (30-day retention) then purge.
- **Deletion:** Admin-initiated deletion triggers cascade: dashboards archived, semantic artifacts removed, Qdrant vectors wiped.

### 4.4 Sample Data Structures

**Semantic Artifact (Table Metadata)**
```json
{
  "table": "dbo.orders",
  "rowCount": 54231,
  "lastProfiledAt": "2025-04-12T10:15:00Z",
  "columns": [
    {"name": "order_id", "type": "int", "description": "Unique order identifier", "nullability": "NOT NULL"},
    {"name": "order_date", "type": "datetime", "description": "Date order was placed", "sample": "2024-08-12"}
  ],
  "relationships": [
    {"target": "dbo.customers", "type": "many-to-one", "column": "customer_id"}
  ]
}
```

**Audit Log Entry**
```json
{
  "id": "log_9f12",
  "orgId": "org_123",
  "userId": "user_456",
  "action": "nl_query",
  "prompt": "Monthly sales in 2024",
  "sql": "SELECT ...",
  "rowCount": 12,
  "durationMs": 1430,
  "status": "success",
  "timestamp": "2025-04-12T18:32:01Z",
  "tokenUsage": {"prompt": 1550, "completion": 220}
}
```

## 5. Integration Specifications

### 5.1 OpenAI Responses API
- **Models:** `gpt-4.1` (default), `gpt-4.1-mini` fallback for low-cost operations.
- **Endpoints:** `POST https://api.openai.com/v1/responses`
- **Features Used:** Structured outputs, tool calling, prompt caching.
- **Request Structure:**
```json
{
  "model": "gpt-4.1",
  "input": [
    {"role": "system", "content": "You are the Leo analytics assistant..."},
    {"role": "user", "content": "What were monthly sales in 2024?"}
  ],
  "tools": [
    {
      "type": "function",
      "name": "execute_sql",
      "parameters": {
        "type": "object",
        "properties": {
          "sql": {"type": "string"},
          "params": {"type": "object"},
          "chart": {"type": "object"}
        },
        "required": ["sql"]
      }
    }
  ],
  "metadata": {"tenantId": "org_123"}
}
```
- **Error Handling:** Retry with exponential backoff (max 3 attempts). On 429, respect `Retry-After`. Log failures with trace ID in audit.
- **Cost Management:** Track token usage per org; enforce monthly spend caps.

### 5.2 Microsoft SQL Server Connection
- **Protocol:** TCP port 1433 (configurable). TLS enforced via `Encrypt=True;TrustServerCertificate=False`.
- **Connection Pooling:** 10 connections/org default, idle timeout 60s.
- **Read-Only Credentials:** Use `ApplicationIntent=ReadOnly` to route to read replicas when available.
- **Timeout Strategy:** Connection timeout 15s, command timeout 8s (configurable). On timeout, abort and log.
- **Firewall Guidance:** Provide static IP to allowlist. Support optional SSH tunnel (phase 2).

### 5.3 Clerk Authentication
- **Organizations:** Map to `organizations` table; roles (`owner`, `admin`, `member`, `viewer`).
- **Role Mapping:** Clerk membership metadata stored in Convex; enforce on every request.
- **Webhooks:** `/api/clerk-users-webhook` handles `user.created`, `user.updated`, `user.deleted`, `organizationMembership.created/deleted`.
- **Session Handling:** Validate JWT on server routes; refresh via Clerk SDK.
- **Audit:** Changes in membership recorded in audit logs.

### 5.4 External Dependencies & Rate Limits

| Service | Limit | Strategy |
| --- | --- | --- |
| OpenAI Responses API | 60 req/min per org | Queue high-volume orgs, degrade to cached answers |
| MSSQL | Org-specific | Respect connection pool, throttle retries |
| Clerk | 100 req/min | Cache org membership locally (TTL 60s) |
| Qdrant | n/a | Backpressure via task queue |

### 5.5 Retry & Fallback Logic
- Use circuit breaker for repeated MSSQL failures (open after 5 failures). Surfaced in UI.
- Maintain local cache of semantic artifacts for quick fallback when OpenAI unavailable (serve last best answer with warning).

## 6. User Experience Details

### 6.1 Onboarding Flow (Signup to First Insight)
```mermaid
sequenceDiagram
    participant Visitor
    participant Clerk as Clerk Hosted Page
    participant App as Leo App
    participant Wizard as Connection Wizard
    participant Sync as Semantic Sync Job

    Visitor->>Clerk: Sign up / join organization
    Clerk-->>App: Redirect with session token
    App->>Visitor: Welcome + Connect database CTA
    Visitor->>Wizard: Launch 3-step wizard
    Wizard->>Sync: Start semantic sync
    Sync-->>App: Progress updates
    App-->>Visitor: Show “Ask a question” prompt with sample
    Visitor->>App: Ask first question
    App-->>Visitor: Deliver first insight
```

### 6.2 Screen-by-Screen Specifications

| Screen | Layout | Components | States |
| --- | --- | --- | --- |
| Onboarding Wizard | 3-step modal, 60% width, dark panel | Form fields, progress indicator, inline docs, “Need help?” link | Default, valid, error (inline), testing (spinner) |
| Data Sources Index | Two-column list + detail pane | Cards with status badges, last sync, CTA buttons | Empty (illustration + CTA), syncing (progress bar), error (retry) |
| Ask Interface | Split view (history list left, answer right) | Prompt input, streaming answer, tabs, pin button | Loading (animated skeleton), success, error (retry prompt) |
| Dashboard Builder | Grid with draggable tiles, inspector sidebar | Tile cards, chart previews, SQL editor, filters | Draft (unsaved), editing, save success, execution error |
| Data Map | Table list + detail drawer | Search bar, table list, graph canvas, info tabs | Empty (no sync), stale (warning badge), restricted (lock icon) |
| Audit Console | Table + chart header | Filters (date, user, action), export button, usage charts | Empty (no activity), heavy usage (alert ribbon) |

### 6.3 Responsive Behavior
- **Breakpoints:** Mobile (<640px), Tablet (641–1023px), Desktop (≥1024px).
- **Mobile:** Single-column layouts, bottom sheet for filters, charts use sparkline mode.
- **Tablet:** Two-column where possible, collapsible sidebars.
- **Desktop:** Full grid, persistent navigation.

### 6.4 Dark Theme System
- **Color Palette:**
  - Background: `#0F172A`
  - Surface: `#111827`
  - Primary: `#38BDF8`
  - Success: `#34D399`
  - Warning: `#F59E0B`
  - Error: `#F87171`
- **Typography:** Inter 14/16/24/32 px scale, letter-spacing -1% for headers.
- **Spacing:** 4px base grid, tile gutter 16px.
- **Elevation:** Use translucent borders (`rgba(255,255,255,0.08)`) instead of shadows.

### 6.5 Accessibility Requirements
- WCAG 2.2 AA compliance.
- Support keyboard navigation: tab order, skip links, focus indicators.
- Provide ARIA labels for charts with textual summaries.
- Ensure color contrast ≥ 4.5:1.
- Screen reader friendly: live region for streaming answers.
- Provide high-level error summaries.

## 7. Security & Compliance

### 7.1 Authentication Flow
```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant Clerk
    participant App

    User->>Browser: Navigate to app
    Browser->>Clerk: Redirect to hosted sign-in
    Clerk-->>Browser: Session token + org context
    Browser->>App: Request protected page with token
    App->>Clerk: Verify token + fetch org membership
    Clerk-->>App: Membership + roles
    App-->>Browser: Render page with permissions applied
```

### 7.2 Authorization Matrix

| Resource / Action | Viewer | Member | Admin | Owner |
| --- | --- | --- | --- | --- |
| View dashboards | ✅ | ✅ | ✅ | ✅ |
| Run NL queries | ✅ | ✅ | ✅ | ✅ |
| Save dashboards | ❌ | ✅ | ✅ | ✅ |
| Manage data sources | ❌ | ❌ | ✅ | ✅ |
| Manage members | ❌ | ❌ | ✅ | ✅ |
| Configure quotas | ❌ | ❌ | ✅ | ✅ |
| Delete organization | ❌ | ❌ | ❌ | ✅ |

### 7.3 Data Privacy Measures
- Store only metadata, aggregates, and limited samples; no raw fact tables copied.
- Credentials encrypted at rest (libsodium sealed boxes) and in transit (TLS 1.3).
- Token usage and spend aggregated per org; no prompt content logged beyond audit requirement (masked for PII tokens).
- Support data deletion requests within 30 days.
- Adhere to UK/EU data residency by hosting in UK and using EU data centers when interfacing with OpenAI (if available).

### 7.4 Audit Logging Specifications
- **Events:** Auth (login/logout), data source changes, sync jobs, NL queries, dashboard CRUD, role changes.
- **Format:** JSON lines with fields: timestamp, orgId, userId, action, targetId, metadata, ipAddress, userAgent.
- **Retention:** 24 months active, 5 years cold storage.
- **Access:** Admins can query via UI; exports require Owner role.
- **Tamper-proofing:** Append-only table with checksum column; daily hash stored separately.

### 7.5 Security Testing Requirements
- Quarterly penetration tests focusing on multi-tenancy, SQL injection, token handling.
- Automated dependency scanning (Snyk/GitHub Dependabot).
- OWASP ASVS Level 2 review pre-GA.
- Verify guardrails against prompt injection and SQL bypass weekly with regression suite.

### 7.6 Compliance Considerations
- Privacy policy & DPA referencing metadata-only approach.
- Prioritize ISO 27001 readiness; maintain asset inventory.
- Document data flows for GDPR Article 30.

## 8. Performance Requirements

### 8.1 Performance Budgets

| Operation | P50 | P95 | Notes |
| --- | --- | --- | --- |
| NL→SQL answer | 3s | 8s | Includes OpenAI + query execution |
| Semantic sync (per table) | <10s | <30s | Background job; parallelized |
| Dashboard load (5 tiles) | 1.5s | 4s | Cache results when possible |
| Data Map search | 300ms | 800ms | Qdrant vector lookup |

### 8.2 Scalability Targets
- Support 200 concurrent users across tenants.
- Handle 5 queries/sec sustained, 20 burst with queueing.
- Manage schemas up to 500 tables, 50M rows per table (metadata only).
- Auto-dashboard generation up to 10 tiles/prompt.

### 8.3 Caching Strategy
- **Query Cache:** Cache tile results keyed by SQL hash + filters, TTL 4h, purged on data source sync.
- **Prompt Cache:** Use OpenAI prompt caching for shared system prompts.
- **Metadata Cache:** Store semantic artifacts in Convex with ETag for efficient retrieval.

### 8.4 Rate Limiting
- Org-level: 60 NL queries/hour, 10 dashboard generations/hour (configurable by plan).
- User-level: 20 NL queries/hour to prevent abuse.
- Soft limit notifications at 80% usage; hard limit returns 429 with guidance.

### 8.5 Degradation Strategy
- Serve cached dashboards, last successful responses when AI unavailable.
- Disable auto-dashboard temporarily if rate limit exceeded, keep manual SQL editing available.

## 9. Development Phases

### 9.1 Phase Breakdown

| Phase | Duration | Focus | Key Deliverables |
| --- | --- | --- | --- |
| Phase 0 – Foundation | 4 weeks | Infrastructure, auth, baseline MSSQL connectivity | VPS setup, Nginx, CI/CD, Clerk orgs, encrypted secret storage |
| Phase 1 – MVP | 8 weeks | Core features | Semantic sync, NL→SQL MVP, dashboard CRUD, audit logging, basic Data Map |
| Phase 2 – Enhancement | 6 weeks | UX polish, automation | Auto-dashboard, global filters, usage analytics, improved guardrails |
| Phase 3 – Scale | 6 weeks | Performance & data source expansion | Caching, observability, additional sync scheduling, multi-source roadmap |

### 9.2 Delivery Timeline (Gantt)
```mermaid
gantt
    title Leo AI Analytics Delivery Plan
    dateFormat  YYYY-MM-DD
    section Phase 0 - Foundation
    Infrastructure setup      :done,    p0i1, 2025-04-07, 2025-04-21
    Auth & Org management     :active,  p0i2, 2025-04-14, 2025-04-28
    Connection wizard         :        p0i3, 2025-04-22, 2025-05-05
    section Phase 1 - MVP
    Semantic sync engine      :        p1i1, 2025-05-06, 2025-06-03
    NL→SQL pipeline           :        p1i2, 2025-05-13, 2025-06-10
    Dashboard CRUD            :        p1i3, 2025-05-20, 2025-06-24
    Audit logging             :        p1i4, 2025-05-27, 2025-06-24
    section Phase 2 - Enhancement
    Auto-dashboard generator  :        p2i1, 2025-06-25, 2025-07-23
    UX polish & filters       :        p2i2, 2025-06-25, 2025-07-23
    Usage analytics           :        p2i3, 2025-07-01, 2025-07-29
    section Phase 3 - Scale
    Performance optimization  :        p3i1, 2025-07-30, 2025-08-27
    Observability rollout     :        p3i2, 2025-07-30, 2025-08-20
    Additional data sources   :        p3i3, 2025-08-13, 2025-09-10
```

## 10. Testing Strategy

### 10.1 Unit Testing
- Coverage target ≥80% for Convex functions, React components handling user input, guardrails.
- Mock OpenAI responses; test SQL sanitization functions.

### 10.2 Integration Testing
- Simulate end-to-end NL→SQL flow against test MSSQL database (Northwind clone).
- Validate semantic sync writes expected artifacts.
- Ensure Clerk webhooks update roles correctly.

### 10.3 End-to-End (E2E) Testing
- Cypress Playwright suite covering onboarding, question answering, dashboard creation, audit viewing.
- Use seeded MSSQL dataset to maintain deterministic responses.

### 10.4 Performance Testing
- Load tests (k6) targeting NL→SQL endpoint at 5 req/sec.
- Benchmark auto-dashboard (10 prompts) under load; monitor response times.
- Measure latency from UK VPS to typical customer regions (<150ms target).

### 10.5 Security Testing
- Automated SQL injection fuzzing of generated SQL.
- Pen-test via third-party once per release cycle.
- Validate prompt injection defense (e.g., instructions inside table data) via test harness.

### 10.6 Acceptance Criteria Summary
- Meet success metrics in Section 1.4.
- Complete regression checklist before moving to next phase.

## 11. Monitoring & Observability

### 11.1 Metrics

| Category | Metric | Description | Target |
| --- | --- | --- | --- |
| Application | `nl_query_duration_ms`, `dashboard_render_ms`, `sync_job_duration` | Key performance metrics | Stay within budgets |
| Business | `active_orgs`, `queries_per_org`, `dashboard_saves` | Adoption indicators | Track weekly |
| Infrastructure | CPU/memory (Node, Convex, Qdrant), network egress | Resource health | <70% sustained |
| Cost | `openai_tokens_prompt/completion`, `openai_cost_per_org` | Spend transparency | Alert at 80% budget |

### 11.2 Alerting Rules
- NL query failure rate >5% over 15 minutes -> PagerDuty (severity high).
- OpenAI 429 errors sustained 5 minutes -> degrade features + notify Slack.
- MSSQL connection failure for org >3 attempts -> email admin.
- Disk utilization >80% -> create Jira ticket.

### 11.3 Logging Strategy
- Structured JSON logs (level, timestamp, service, orgId, message, traceId).
- Log levels: Info (normal operations), Warn (recoverable), Error (impact), Fatal (requires intervention).
- Retention: 30 days hot (Loki), 365 days cold (S3).

### 11.4 Dashboards
- Grafana dashboards: Platform Overview, NL Query Performance, Sync Health, Cost & Usage.
- Stakeholder dashboard (monthly) summarizing org adoption, NL accuracy, spend.

## 12. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Incorrect SQL due to prompt injection or schema ambiguity | Medium | High | Strong guardrails, schema context, regression tests, human-in-the-loop fallback |
| MSSQL connectivity issues from customer firewalls | High | Medium | Provide IP allowlist guide, SSH tunnel option, connection monitoring |
| Cost overruns from OpenAI usage | Medium | High | Org-level budgets, token monitoring, fallback to cached answers |
| Single VPS outage | Medium | High | Daily backups, snapshot recovery plan, roadmap for HA |
| Regulatory changes (GDPR) requiring data residency | Low | Medium | Document flows, prefer EU endpoints, maintain DPA |
| Feature creep delaying MVP | Medium | Medium | Phase gating, freeze scope after each discovery sprint |

## 13. Appendices

### 13.1 Glossary
- **TTFI:** Time to First Insight.
- **NL→SQL:** Natural Language to Structured Query Language translation.
- **Semantic Sync:** Process of profiling schema, metadata, and embeddings.
- **RBAC:** Role-Based Access Control.
- **TTL:** Time To Live for cache entries.

### 13.2 API Reference Summary

| Endpoint | Method | Auth | Description |
| --- | --- | --- | --- |
| `/api/data-sources` | POST/GET | Admin | Manage data connections |
| `/api/data-sources/test-connection` | POST | Admin | Validate MSSQL credentials |
| `/api/semantic-sync` | POST | Admin | Trigger semantic sync |
| `/api/ai/query` | POST | Member+ | Submit NL question |
| `/api/ai/query/stream` | GET | Member+ | Receive streamed answer (SSE) |
| `/api/ai/auto-dashboard` | POST | Member+ | Generate dashboard | 
| `/api/dashboards` | GET/POST | Member+ | List/create dashboards |
| `/api/dashboards/{id}` | GET/PATCH/DELETE | Member+/Admin | Manage dashboard |
| `/api/dashboards/save-tile` | POST | Member+ | Save tile |
| `/api/dashboards/tiles/{tileId}/delete` | DELETE | Member+/Admin | Remove tile |
| `/api/audit-logs` | GET | Admin | Query audit events |

### 13.3 Configuration Reference

| Variable | Description | Example |
| --- | --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk frontend key | `pk_test_...` |
| `CLERK_SECRET_KEY` | Clerk backend key | `sk_test_...` |
| `OPENAI_API_KEY` | OpenAI secret | `sk-openai-...` |
| `CONVEX_DEPLOYMENT` | Convex deployment name | `prod` |
| `NEXT_PUBLIC_CONVEX_URL` | Convex public URL | `https://happy-martian.convex.cloud` |
| `MS_SQL_TUNNEL_CONFIG` | Optional SSH tunnel JSON | `{"host":"...","port":22}` |
| `AUDIT_DB_URL` | PostgreSQL connection string | `postgres://user:pass@host/audit` |
| `PROMPT_CACHE_ENABLED` | Toggle for OpenAI prompt caching | `true` |

### 13.4 Deployment Checklist
1. Update environment variables and secrets (Clerk, OpenAI, Convex, audit DB).
2. Run infrastructure playbook (Ansible/Terraform) to provision VPS, firewall, Docker.
3. Obtain/renew TLS certificates via Let’s Encrypt (auto via certbot cron).
4. Deploy containers via `docker compose up -d`.
5. Run database migrations for audit storage and Convex schema deployment.
6. Verify health endpoints (`/healthz`, `/api/status`).
7. Configure Grafana dashboards and alert rules.
8. Execute smoke tests: login, add test MSSQL, run sample query, check audit log.
9. Notify stakeholders and update status page.
10. Document release in changelog.

### 13.5 Sample Configuration Snippet
```yaml
# docker-compose.override.yml
services:
  nextjs:
    environment:
      - NODE_ENV=production
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - CLERK_SECRET_KEY=${CLERK_SECRET_KEY}
  convex:
    environment:
      - CONVEX_DEPLOYMENT=${CONVEX_DEPLOYMENT}
  qdrant:
    volumes:
      - qdrant_data:/qdrant/storage
volumes:
  qdrant_data: {}
```

### 13.6 Acceptance Test Checklist
- [ ] Connection wizard validates sample MSSQL server.
- [ ] Semantic sync completes on Northwind dataset in <15 minutes.
- [ ] NL question suite (10 prompts) passes accuracy baseline.
- [ ] Auto-dashboard prompt generates ≥4 tiles with valid SQL.
- [ ] Dashboard save & share workflow functional for Member and Viewer roles.
- [ ] Audit log captures NL query with correct metadata.
- [ ] Rate limiting triggers and surfaces UI notification at threshold.
- [ ] Observability dashboards show metrics after smoke test.

---

This enhanced PRD preserves the original product vision while adding the specifications, diagrams, and operational guidance required for engineering, design, and stakeholders to execute confidently.
