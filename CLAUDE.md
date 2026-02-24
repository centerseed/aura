# CLAUDE.md — Zentropy

## 🚨 Safety Rules (ABSOLUTE — Never Violate)

### 1. GCP & Firebase Deployment Isolation
- **ONLY deploy to `zentropy-4f7a5`** — any other GCP project is FORBIDDEN
- **ONLY deploy Firebase Hosting to the `zentropy-4f7a5` Firebase project** — any other Firebase project is FORBIDDEN
- **YOU MUST use deploy scripts** — never run `gcloud builds submit`, `gcloud run deploy`, or `firebase deploy` directly
  - API: `./scripts/deploy-api.sh`
  - Librarian: `./scripts/deploy-librarian.sh`
  - Web: `./scripts/deploy-web.sh`
- Deploy order: Librarian first → API second

### 2. Secret Protection
- **NEVER write secrets to any git-tracked file** — API keys, DB passwords, private keys
- `.env` files only (already in `.gitignore`); `.env.example` uses placeholders only
- Before Write/Edit: ask yourself — does this contain a secret? Is this file git-tracked?

### 3. Test Environment
- **NEVER connect to production DB** (`supabase.co`) in tests — hard blocks exist in `api/src/lib/db.ts`
- **NEVER use `deleteMany` or `delete` in unit tests** — use mocks (`vitest-mock-extended`)
- Integration tests: local Docker PostgreSQL only, with transaction rollback
- **NEVER disable Supabase RLS**

---

## Workflow Orchestration

### 1. Plan First
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- Write specs upfront — no Spec = no Plan = no Task (SDD workflow)
- Reference: `docs/05_Refinery/002_SDD_Workflow_Guide.md`

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- One subagent per focused execution task

### 3. Self-Improvement Loop
- After ANY user correction: update `docs/03_Tasks/lessons.md` with the pattern
- Write a rule that prevents the same mistake from happening again
- Review lessons at session start for relevant context

### 4. Verification Before Done
- **NEVER say a task is complete without proving it works**
- Run the verification checklist below before declaring done
- Ask yourself: "Would a senior engineer approve this?"

### 5. Autonomous Bug Fixing
- When given a bug report: just fix it — don't ask for hand-holding
- Point at tests, errors, failing tests — then resolve them
- Go fix failing CI tests without being told how

---

## Verification Checklist (MUST complete before "done")

**Backend (backend/):**
```bash
pytest --cov=app tests/          # 測試 + 覆蓋率
```

**API (api/):**
```bash
npm run lint && npm run test && npm run build
```

**Web (web/):**
```bash
npm run lint && npm run type-check && npm run build
```

🚫 "Logic looks correct" is NOT verification. Actually run the commands.

---

## Common Commands

```bash
# Backend 開發伺服器
cd backend && uvicorn app.interface.api.main:app --reload --host 0.0.0.0 --port 8000

# Backend 測試
cd backend && pytest --cov=app tests/

# 驗證線上版本
curl <SERVICE_URL>/health   # 檢查 version 欄位是否與 api/version.json 一致
```

---

## Architecture Constraints

- **Clean Architecture**: `domain` → `application` → `infrastructure` → `interface`
  - Outer layers depend on inner; inner layers NEVER import outer
  - Domain layer: zero dependency on FastAPI or Firestore
- **Type conversion**: Repository layer owns `toDomain()` / `toPrisma()` — Use Case layer NEVER does type conversion
- **TDD**: Write failing test first → minimal implementation → refactor

---

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Minimal impact.
- **No Laziness**: Find root causes. No temporary fixes. Senior-engineer standards.
- **Spec is Truth**: `docs/` is SSOT — code changes must be preceded by doc updates
- **No Silent Failures**: All errors become Domain Exceptions or get logged. Never swallow.
