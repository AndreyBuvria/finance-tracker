# Finance Tracker — workspace

Single git repository (monorepo): specs and agents in `.claude/`, backend and frontend in their own top-level folders.

Specs (`.claude/docs/`):

- `PLAN.md` — what to build and in what order; data model, API, business rules.
- `FEATURES.md` — user-facing behavior, UI text, edge cases.
- `DESIGN.md` — UI design brief (Figma prompt for Phase 1 screens).

Projects:

- `finance-tracker-api/` — .NET backend. Its `CLAUDE.md` holds the backend rules.
- `finance-tracker-web/` — Angular frontend. Its `CLAUDE.md` holds the frontend rules.

Keep backend and frontend files in their own folders; never put files for one inside the other. CI workflows live in the root `.github/workflows/` with path filters per folder.

## Agents (`.claude/agents/`)

Run Claude Code from the repo root so the agents and both projects are available.

| Agent | Use for |
| --- | --- |
| `backend-developer` | Backend tasks in `finance-tracker-api` (API, auth, accounts, categories, transactions, budgets, dashboard, alerts) |
| `import-pipeline-developer` | Phase 4 CSV import: parsers, hashing/dedup, categorization, pre-signed upload, Lambda, LocalStack |
| `frontend-developer` | Angular tasks in `finance-tracker-web` |
| `devops-engineer` | Docker Compose, GitHub Actions, Phase 3 AWS deployment (asks before anything that costs money) |
| `backend-convention-reviewer` | Read-only: backend code vs `finance-tracker-api/CLAUDE.md` |
| `frontend-convention-reviewer` | Read-only: Angular code vs `finance-tracker-web/CLAUDE.md` + `DESIGN.md` formatting |
| `spec-qa-reviewer` | Read-only: implemented behavior vs `PLAN.md` + `FEATURES.md`, incl. frontend↔backend contract. Run before ticking a task |

Suggested flow for any task (whoever writes the code): implement → matching convention reviewer → `spec-qa-reviewer` → tick the checkbox in `PLAN.md`.

**Paths:** when a doc, agent or rule says `PLAN.md`, `FEATURES.md` or `DESIGN.md`, it means the file in `.claude/docs/`.

**Delegation rule:** every change to frontend or backend code or config — no matter how small, including refactors, fixes and restructuring — goes to the dedicated agent (`frontend-developer`, `backend-developer`, `import-pipeline-developer`, `devops-engineer`). The main session only coordinates, edits the docs in `.claude/` (`docs/*.md`, `CLAUDE.md` files, agent definitions) and relays results.
