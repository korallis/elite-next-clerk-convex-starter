# Leo AI Delivery – Implementation Tracker

This tracker mirrors the **Leo AI Analytics PRD** and the GitHub Project board ("Leo AI Delivery") so that stakeholders can quickly assess delivery status without opening the project UI. Update the table whenever an item changes state or new work is discovered.

## Usage
- Each row corresponds to a discrete deliverable or milestone derived from `docs/PRD.md`.
- Link the GitHub issue once created; the issue should live on the "Leo AI Delivery" project in the correct column/phase.
- Status values: `Not Started`, `In Discovery`, `In Progress`, `In Review`, `Testing`, `Blocked`, `Done`.
- "Next Test Run" identifies the primary suite to execute before marking the item **Done** (e.g., `Jest – unit`, `Jest – integration`, `Playwright`, `k6`).
- Add new rows if the PRD is refined or scope changes. Remove rows only when the PRD requirement is deprecated.

## Summary Table

| PRD Section | Deliverable | GitHub Issue | Phase | Status | Last Updated | Next Test Run | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.0 Executive Summary | Stakeholder metrics dashboard populated | #1 | Phase 3 | In Review | 2025-10-15 | Jest – integration | Dashboard available at /dashboard/stakeholder-metrics; awaiting data validation |
| 2.0 Technical Architecture | Infra scripts (VPS, Nginx, SSL, Compose) | #2 | Phase 0 | Not Started | – | Jest – unit (ops utils) | Terraform/Ansible hand-off |
| 3.1 Data Connections | Connection wizard UI + include/exclude | #3 | Phase 1 | Not Started | – | Playwright | Tied to api/data-sources endpoints |
| 3.1 Semantic Sync | Background job execution + progress UI | #4 | Phase 1 | Not Started | – | Jest – integration | Move sync out of API request |
| 3.2 Ask NL→SQL | Ask page UI with streaming, CSV export, pin flow | #5 | Phase 1 | Not Started | – | Playwright · Jest – unit | Utilise `/api/ai/query` & `/stream` |
| 3.3 Auto-Dashboard | Tile validation + preview + edit workflow | #6 | Phase 2 | Not Started | – | Playwright · Jest – unit | Ensure SQL executes before save |
| 3.4 Dashboards | Grid layout, filters, sharing, caching | #7 | Phase 2 | Not Started | – | Jest – integration | Includes freshness badges |
| 3.5 Data Map | Search, relationship graph, freshness indicators | #8 | Phase 2 | Not Started | – | Playwright | Visual join graph + samples |
| 3.6 Auditing & Cost Controls | Admin audit console + usage alerts | #9 | Phase 2 | Not Started | – | Jest – integration | Surfaces `convex/queryAudits` |
| 4.0 Data Model | Migration automation + retention jobs | #10 | Phase 3 | Not Started | – | Jest – unit | Add archiving, soft delete, retention |
| 5.0 Integrations | OpenAI retry/circuit breaker & Clerk webhook hardening | #11 | Phase 1 | Not Started | – | Jest – unit | Include prompt caching toggle |
| 6.0 User Experience | Onboarding wizard, dark theme tokens, accessibility checks | #12 | Phase 1 | Not Started | – | Playwright | Cover mobile/desktop breakpoints |
| 7.0 Security & Compliance | RBAC enforcement + audit export + tamper checks | #13 | Phase 2 | Not Started | – | Jest – integration | Include masking & retention |
| 8.0 Performance | Caching layer + rate-limit dashboard | #14 | Phase 3 | Not Started | – | k6 · Jest – integration | Query cache & degradation strategy |
| 9.0 Phased Delivery | Project plan alignment + sprint cadence | #15 | Phase 0 | In Progress | 2025-10-15 | – | Maintain board & roadmap |
| 10.0 Testing Strategy | Jest migration, coverage gates, CI workflows | #16 | Phase 0 | Not Started | – | Jest – unit · Playwright · k6 | Replace Vitest scripts |
| 11.0 Monitoring & Observability | Grafana/Loki dashboards & alert rules | #17 | Phase 0 | Not Started | – | Manual verification | Link to deployment scripts |
| 12.0 Risks & Mitigations | Risk register + weekly review | #18 | Phase 0 | Not Started | – | Manual review | Summarise mitigation status |
| 13.0 Appendices | Deployment checklist automation | #19 | Phase 3 | Not Started | – | Manual validation | Validate script outputs |

## How to Update
1. **Create/Link Issue:** When an issue is opened for a requirement, add the issue number in the table (e.g., `#42`).
2. **Set Status:** Move status as work progresses. This should mirror the card’s column on the GitHub Project board.
3. **Record Tests:** Update "Next Test Run" to the suite that must pass before marking Done. Optionally note completed runs in `Notes`.
4. **Add Notes:** Capture blockers, dependencies, or context (e.g., "Waiting on MSSQL test fixture").
5. **Review Cadence:** During weekly sync, skim the table top-to-bottom and ensure every row has an up-to-date status and note.

> Tip: Consider automating updates via a future GitHub Action that writes to this table when project cards move columns.
