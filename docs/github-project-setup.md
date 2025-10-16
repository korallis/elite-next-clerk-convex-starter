# GitHub Project Setup – Leo AI Delivery

Follow these steps to create and keep the "Leo AI Delivery" project board aligned with `docs/PRD.md` and `docs/implementation-tracker.md`.

## 1. Create the Project
1. Navigate to the repository in GitHub.
2. Open **Projects** → **New project** → choose **Board** (beta).
3. Name it **Leo AI Delivery** and set the description to reference `docs/PRD.md`.
4. Grant write access to all core contributors.

## 2. Configure Views
- **Board View (Default):** Columns `Backlog`, `Ready`, `In Progress`, `In Review`, `Testing`, `Done`.
- **Table View:** Add columns for custom fields (Phase, PRD Section, Owner, Test Suite) for reporting.
- **Timeline View:** Filter by `Phase` to plan the roadmap across the four delivery phases.

## 3. Custom Fields
Add the following fields from the project settings:
- `Phase` – single select (`Phase 0`, `Phase 1`, `Phase 2`, `Phase 3`).
- `PRD Section` – single select covering the main headers (`1.0 Executive Summary`, …, `13.0 Appendices`).
- `Owner` – text or user field.
- `Test Suite` – single select (`Jest – unit`, `Jest – integration`, `Playwright`, `k6`, `Security`).
- Optional: `Due` (date) and `Risk Level`.

## 4. Automation
- Configure workflows so that new issues land in **Backlog**.
- When a pull request is opened referencing the issue, move the card to **In Review**.
- When the pull request merges, move the card to **Testing**.
- Add a rule so that applying a `blocked` label returns the card to **Backlog**.

## 5. Issue Template Enforcement
- Ensure the repository uses `.github/ISSUE_TEMPLATE/prd-task.md`.
- Optionally, add `.github/ISSUE_TEMPLATE/config.yml` to disable blank issues if stricter intake is desired.

## 6. Seed the Backlog
Create issues for each row currently in `docs/implementation-tracker.md` (Phase 0 through Phase 3). Suggested naming pattern:
```
[Section 3.2] Ask interface – streaming query UX
```
Populate the project fields and add acceptance criteria from the PRD.

## 7. Weekly Ritual
- Review the board every Monday: update statuses, close completed cards, confirm tests executed.
- Sync the tracker by updating the `Status`, `GitHub Issue`, and `Last Updated` columns.
- Capture highlights/risks in a short comment or meeting notes.

## 8. Future Enhancements
- Automate tracker updates via Actions (e.g., on project card move).
- Generate burndown or throughput charts by exporting project data weekly.
- Integrate Slack notifications for cards entering `Blocked` or `Testing` for more than 48 hours.
