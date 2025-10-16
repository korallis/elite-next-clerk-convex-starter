# Semantic Understanding v2 (EAR) — Robust Data‑Aware AI Plan

Goal: ensure Ask and Auto‑Dashboard consistently use the correct tables, columns, and joins for each organization’s connected data; learn from errors and user feedback.

## Problem Statement
When asked “How many candidates have status Active?”, the system queried `dbo.awr_clock` instead of the canonical `dbo.can_candidates` joined to the status dimension. Root causes: weak schema linking (no explicit entity/attribute mapping), no join‑path planner, a relevance bug that ignores column‑level hits for their owning table, and no learning from feedback.

## Objectives
- Accurate entity/attribute resolution to canonical tables.
- Deterministic join‑path planning over the schema graph.
- Stronger retrieval combining vectors + rules + admin overrides.
- Feedback loop to learn from corrections and outcomes.

---

## Phase 1 — Quick Fixes (Day 0–1)

### 1.1 Fix table ranking bug (column→table mapping)
Current code only matches `keys.has("column:${t.artifactKey}")` which never equals stored keys like `column:schema.table.column`.

Illustrative patch intent for `selectRelevantTables`:
```ts
// After vector search
const hits = await searchTopK(orgId, vector, 10);
const tableScores = new Map<string, number>(); // key: schema.table
for (const h of hits) {
  if (h.id.startsWith("table:")) {
    const k = h.id.slice("table:".length); // schema.table
    tableScores.set(k, (tableScores.get(k) || 0) + h.score);
  } else if (h.id.startsWith("column:")) {
    const rest = h.id.slice("column:".length); // schema.table.column
    const [schema, table] = rest.split(".");
    const k = `${schema}.${table}`;
    tableScores.set(k, (tableScores.get(k) || 0) + h.score * 0.9);
  }
}
const ranked = tables
  .map((t) => ({ t, s: tableScores.get(t.artifactKey) || 0 }))
  .sort((a, b) => b.s - a.s)
  .filter((e) => e.s > 0)
  .slice(0, 5)
  .map((e) => e.t);
```

### 1.2 Embed simple aliases
Augment table/column embedding text with: singular/plural forms, snake_case → words (“can_candidates” → “candidate”), and basic synonyms (configurable).

---

## Phase 2 — Semantic Catalog v2 (Entities–Attributes–Relationships)
Persist in Convex as semantic artifacts.

### 2.1 Entities
Represents a canonical business object and its defaults.
```json
{
  "type": "entity",
  "key": "Entity:Candidate",
  "default_table": "dbo.can_candidates",
  "id_column": "candidate_id",
  "synonyms": ["candidate", "candidates"],
  "notes": "Primary table for candidate counts and attributes."
}
```

### 2.2 Attributes
Bind a business attribute to its source location and required join.
```json
{
  "type": "attribute",
  "key": "Candidate.status",
  "entity": "Entity:Candidate",
  "source": {
    "table": "dbo.can_candidate_status",
    "column": "name",
    "join": "dbo.can_candidates.status_id = dbo.can_candidate_status.id"
  },
  "synonyms": ["status", "state"],
  "constraints": { "domain": ["Active", "Inactive", "Pending"] }
}
```

### 2.3 Relationship Graph
- Nodes: tables; edges: FKs + admin “blessed joins”.
- Precompute shortest/best paths between entity default tables and attribute tables.
- Store per‑org boosts/bans and synonym expansions.

### 2.4 Indexer updates
- Classify tables (fact/dimension/bridge) by FK degree, cardinality, and naming.
- Detect entities from table names & keys (e.g., `can_candidates` → Candidate).
- Build attribute dictionary from column names + FK traversals.
- Embed enriched items (tables/columns/entities/attributes) with samples and synonyms.

---

## Phase 3 — Query Engine v2

### 3.1 Pipeline
1) Entity/attribute extraction from the question (small LLM or rules).
2) Resolve via Catalog v2 (entity default table and attribute source).
3) Plan joins using the relationship graph (prefer blessed paths; penalize fact→fact).
4) Constrained SQL generation: allow only resolved tables/columns and the planned joins.
5) Validation and one self‑correction: capture execution error, re‑prompt with error + catalog context, then re‑execute.

### 3.2 Prompt skeleton
```
Use ONLY these tables/columns and join path:
- dbo.can_candidates(...)
JOIN dbo.can_candidate_status ON can_candidates.status_id = can_candidate_status.id
Task: {question}
Return JSON {sql, rationale, chart, follow_up_questions}.
```

### 3.3 Guardrails
- Read-only pool, `TOP {N}` caps, timeout/row limits, safe identifiers, and explicit allowlist of planned tables/columns.

---

## Phase 4 — Learning & Feedback
- UI affordances: mark wrong table/join/result; provide correct table/SQL.
- Persist: per‑org boosts/bans, synonyms, and validated Q→SQL exemplars.
- Outcome learning: success reinforces chosen tables/paths; errors decay weights; retrieval uses this memory.

---

## Phase 5 — Auto‑Dashboard Alignment
- Reuse Catalog v2 + planner for tile selection (measures/dimensions/joins).
- Cache tile plans with TTL; invalidate on schema change.

---

## Rollout & Safety
- Feature flag `SEMANTIC_V2_ENABLED`; current behavior as fallback.
- Telemetry: precision@k of table selection, join accuracy, success/error rate, latency.
- Audit trace: chosen entities, tables, join path, rationale, and corrections.

---

## Acceptance Criteria
- “How many candidates have status Active?” resolves to `dbo.can_candidates` + status dim and returns correct count.
- ≥90% of golden questions use expected tables; execution error rate <5%; latency ≤ 1.5× current.

## Timeline (est.)
- Phase 1: 0–1 day
- Phase 2: 2–3 days
- Phase 3: 3–4 days
- Phase 4: 2 days
- Phase 5 + rollout: 1–2 days

---

## References (Perplexity‑validated)
- Schema linking and graph planners: RSL‑SQL (2024), RAT‑SQL, Graphix‑Text2SQL — arXiv 2411.00073; arXiv 2408.05109; VLDB’24.
- Modular pipelines: DIN‑SQL (2023) — COLING’25.
- Execution‑feedback repair loops: surveys and practices — arXiv 2501.09310; arXiv 2509.00581; AWS Bedrock blog.
- Semantic layers for entities/attributes/relationships: dbt SL (2024) — dbt blog/docs; Wren AI post.
- Vector retrieval best practices: Qdrant guides; schema vectorization discussions.

---

## File
This plan is saved as `docs/SEMANTIC_V2.md`.
