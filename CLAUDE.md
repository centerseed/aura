# CLAUDE.md

## CRITICAL RULES - Data Security

### Credential Protection (Violation = Termination)

**Never write API keys, database passwords, or service account private keys into any file that could be git committed.**

#### Absolutely forbidden in any committable file:

1. **API Keys / Tokens**
   - Google API Key (`AIzaSy...`)
   - Firebase API Key
   - Gemini API Key (`GOOGLE_GENERATIVE_AI_API_KEY`)
   - Any `sk-`, `pk_`, `ghp_`, `gho_` prefixed tokens

2. **Database connection strings**
   - `DATABASE_URL` containing passwords
   - Any `postgres://user:PASSWORD@` format strings
   - Supabase pooler URLs with passwords

3. **Service Account / Private Keys**
   - `-----BEGIN PRIVATE KEY-----`
   - Firebase Admin SDK JSON
   - Any `.json` service account files

#### Safe practices:

1. **Environment variables**: Secrets go ONLY in `.env` files (git-ignored)
2. **Example files**: `.env.example` may only contain placeholders like `your-api-key-here`
3. **Documentation**: No `.md` file may contain real passwords or API keys
4. **Scripts**: No `.sh` / `.js` script may hardcode secrets; read from environment variables

#### Mandatory pre-write check:

Before using Write or Edit tools, ask:
- Does this content contain anything resembling an API key?
- Does this content contain any password?
- Will this file be tracked by git?

**If any doubt, do NOT write. Ask the user to confirm.**

---

### Test Environment Absolute Prohibitions (Violation = Termination)

1. **Never connect to production database in tests**
   - Tests must never connect to any `DATABASE_URL` containing `supabase.co`
   - `api/src/lib/db.ts` and `web/lib/db.ts` have hardcoded safety blocks
   - Both `api/vitest.config.ts` and `web/vitest.config.ts` abort if DATABASE_URL points to Supabase
   - Attempting to bypass these protections is an unforgivable error

2. **Never execute destructive operations in tests**
   - `deleteMany` - the most dangerous operation, forbidden even with where clauses
   - `delete` - unit tests should not have real delete operations
   - Any direct database write operations - unit tests must use mocks
   - **Unit tests**: Use `vitest-mock-extended` to mock Prisma
   - **Integration tests**: Only on local Docker PostgreSQL with transaction rollback

3. **Unit tests must use mocks**
   - Use `vitest-mock-extended` to mock Prisma client
   - Reference implementation: `web/tests/mocks/prisma.ts`
   - Unit tests must never have real database connections

4. **Integration tests must use isolated test databases**
   - Set `DATABASE_URL_TEST` pointing to local or Docker PostgreSQL
   - Reference: `api/.env.test.example`

### Supabase RLS Rules
- **Never disable RLS**
- Database operations must go through the API, not direct database access
- Any RLS bypass requires explicit user consent

---

## Project Overview

**Zentropy** - An operations management system for entrepreneurs, built on the Dual-Axis Model (Status x Entity) with AI-assisted workflows.

## Repository Structure

This is a monorepo with three application targets:

```
aura/
├── api/                    # Backend API (Next.js 16, TypeScript)
├── web/                    # Web frontend (Next.js 16, React 19)
├── app/                    # Mobile app (Flutter, Dart)
├── docs/                   # Documentation (SDD 7-tier structure)
├── packages/               # Shared packages (git submodules)
├── scripts/                # Deployment & development scripts
├── docker-compose.yml      # Local PostgreSQL + pgvector
└── CLAUDE.md               # This file
```

## Development Commands

### API Backend (Next.js)
```bash
cd api

# Development server (port 3002)
npm run dev

# Run unit tests + remote tests
npm test

# Run only unit tests
npm run test:unit

# Run integration tests (requires local DB)
npm run test:integration

# Run all tests (unit + integration + remote)
npm run test:all

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# Prisma
npm run prisma:generate
npm run prisma:migrate

# Build & lint
npm run build
npm run lint
```

### Web Frontend (Next.js + React)
```bash
cd web

# Development server (port 3000)
npm run dev

# Run all tests
npm test

# Test subsets
npm run test:unit
npm run test:integration
npm run test:components
npm run test:e2e

# E2E against local API
npm run test:e2e:local

# Coverage
npm run test:coverage

# Build & lint
npm run build
npm run lint

# Prisma (web has its own Prisma client)
npm run db:generate
npm run db:push
```

### Flutter Mobile App
```bash
cd app

# Run the app
flutter run

# Run tests
flutter test

# Build
flutter build apk    # Android
flutter build ios     # iOS
```

### Local Database (Docker)
```bash
# Start PostgreSQL + pgvector
docker compose up -d

# Connection: postgresql://naruvia:naruvia_password@localhost:5432/naruvia_db
```

### Deployment Scripts
```bash
scripts/deploy-all.sh        # Deploy both API and web
scripts/deploy-api.sh        # Deploy API to Cloud Run
scripts/deploy-web.sh        # Deploy web to Firebase Hosting
scripts/dev-api.sh           # Start API dev server
scripts/dev-web.sh           # Start web dev server
```

### Environment Setup
- API: Copy `api/.env.example` -> `api/.env`
- Web: Copy `web/.env.local.example` -> `web/.env.local`
- Tests: Copy `api/.env.test.example` -> `api/.env.test`
- Required: Firebase service account credentials, Gemini API key, PostgreSQL database URL

## Tech Stack

### API Backend (`api/`)
- **Runtime**: Node.js 20+
- **Framework**: Next.js 16.1.4 (App Router, API routes)
- **Language**: TypeScript 5
- **ORM**: Prisma 6 with PostgreSQL
- **Database**: PostgreSQL 16 + pgvector
- **AI**: Google Generative AI (Gemini) via `@ai-sdk/google`
- **Auth**: Firebase Admin SDK
- **Validation**: Zod
- **Testing**: Vitest 3.2 + vitest-mock-extended
- **Database Adapter**: Neon serverless (@prisma/adapter-neon) for production

### Web Frontend (`web/`)
- **Framework**: Next.js 16.1.4 (App Router)
- **UI**: React 19, Tailwind CSS 3.4
- **Components**: Radix UI primitives (Dialog, Dropdown, Popover, Select, Tabs, Toast, Slider)
- **Drag & Drop**: @dnd-kit (core, sortable, utilities)
- **Icons**: Lucide React
- **Date**: date-fns 4
- **Auth**: Firebase client SDK
- **AI**: Google Generative AI (Gemini) via `@ai-sdk/google`
- **ORM**: Prisma 6 (web has its own Prisma client for SSR)
- **Testing**: Vitest 3.2, Testing Library (React), happy-dom
- **Mocking**: vitest-mock-extended

### Flutter Mobile App (`app/`)
- **SDK**: Flutter 3.10.4+, Dart ^3.10.4
- **State Management**: Riverpod (flutter_riverpod)
- **Navigation**: GoRouter
- **HTTP**: Dio + Retrofit
- **Local Storage**: Hive
- **Auth**: Firebase Auth + Google Sign-In
- **Code Generation**: Freezed, json_serializable
- **Testing**: Mockito, Mocktail

### Infrastructure
- **Database**: PostgreSQL 16 + pgvector (Supabase-hosted in production, Docker locally)
- **Deployment**: Google Cloud Run (API), Firebase Hosting (web)
- **Containerization**: Docker (multi-stage builds, node:20-slim/alpine)
- **Auth Provider**: Firebase Authentication

## Database Schema (Prisma)

Core models in `api/prisma/schema.prisma`:

| Model | Description |
|-------|-------------|
| `User` | Users with auth_provider (EMAIL/GOOGLE/ANONYMOUS) |
| `Area` | Top-level organizational categories |
| `Product` | Business entities within areas (status + lifecycle) |
| `Topic` | Subjects within products |
| `Task` | Action items with sub_items, references, AI analysis |
| `TaskAIMetadata` | AI-generated metadata for tasks |
| `Milestone` | Time-bound goals linked to entities |
| `GovernanceProposal` | System governance proposals |
| `SystemEvaluationLog` | AI evaluation audit logs |

**Enums**: Status (INBOX/ACTIVE/MAINTAIN/REFERENCE/ARCHIVE), Lifecycle (FINITE/PERPETUAL), AuthProvider (EMAIL/GOOGLE/ANONYMOUS)

## Architecture

### Clean Architecture (enforced across all platforms)

Both `api/src/` and `web/` follow a 4-layer Clean Architecture:

```
domain/               # Core domain layer (innermost)
├── entities/         # Data models (no framework dependencies)
├── interfaces/       # Repository/Service behavior contracts
├── value-objects/    # Status, Lifecycle, DrawerStatus enums
└── constants/        # Validation rules

application/          # Application layer
└── use-cases/        # Business workflow implementations

infrastructure/       # Infrastructure layer (outermost)
├── repositories/     # Prisma repository implementations
├── api/              # (web only) API client modules
└── auth/             # (web only) Token manager, Firebase auth

interface/            # Interface layer (API only)
└── api/              # Next.js API route handlers (api/src/app/api/)
```

**Dependency rule**: Outer layers may depend on inner layers. Inner layers NEVER depend on outer layers. Domain layer never references Next.js, Prisma, or Firebase directly.

**Type & naming conventions** (enforced):
- **Database layer** (`infrastructure/repositories`): Prisma native format (camelCase + Date objects)
- **Domain layer** (`domain/entities` & `domain/interfaces`): API standard format (snake_case + ISO strings)
- **Repository responsibility**: Must implement `toDomain()` and `toPrisma()` methods for complete format conversion; type mismatches must never leak to Use Case layer
- **Use Case prohibition**: Only business logic; never type conversion or format handling

### Flutter App Architecture (`app/lib/`)

```
lib/
├── domain/           # Domain models
├── application/      # Use cases
├── data/             # Repositories, data sources
├── presentation/     # UI layer
│   ├── screens/      # Screen modules (home, auth, dashboard, project, focus, capture, review, profile, splash)
│   ├── widgets/      # Reusable widgets
│   ├── providers/    # Riverpod providers
│   └── routes/       # GoRouter navigation
└── config/           # App configuration
```

### API Endpoints (30 routes in `api/src/app/api/`)

- **Areas**: CRUD (4 endpoints)
- **Products**: CRUD + reorganize + reorder (7 endpoints)
- **Tasks**: CRUD + sub-items + references + merge (10 endpoints)
- **Milestones**: CRUD (4 endpoints)
- **Auth**: signin (1 endpoint)
- **Users**: current user (2 endpoints)
- **AI**: suggest-product, brain-dump, adjust-tags (3 endpoints)
- **Library**: get library (1 endpoint)

## Core Development Principles (Constitutional Rules)

### Spec-Driven Development (SDD) Workflow
**Skipping stages is forbidden** - this is the project's supreme directive:

1. **[00_Constitution](docs/00_Constitution)** - Supreme law; all development must comply
2. **[01_Specification](docs/01_Specification)** - Defines "what" and business value
3. **[02_Plan](docs/02_Plan)** - Defines "how", technical architecture & API specs
4. **[03_Tasks](docs/03_Tasks)** - Atomic task lists, AI-executable tasks
5. **[04_ADR / 04_POC](docs/04_POC)** - Architecture decisions & proof of concepts
6. **[05_Refinery](docs/05_Refinery)** - Methodology refinement
7. **[06_Standards](docs/06_Standards)** - **Must-read**: Engineering standards & naming conventions

**Key rules**:
- No Specification = no Plan allowed
- No Plan = no Task breakdown allowed
- Code changes must be preceded by documentation updates
- `docs/` is the Single Source of Truth (SSOT) for system behavior

### TDD (Test-Driven Development) Enforcement
Development order (non-negotiable):
1. Write a failing unit test first
2. Implement minimum code to pass
3. Refactor while keeping tests green

**Coverage requirements**:
- Domain and Application layers must reach 100% logic coverage
- All Use Cases must have corresponding unit tests
- Integration tests must verify external service collaboration

## Testing

### Test Infrastructure

| Component | Framework | Config | Mock Library |
|-----------|-----------|--------|-------------|
| API | Vitest 3.2 | `api/vitest.config.ts` | built-in vi.mock |
| Web | Vitest 3.2 | `web/vitest.config.ts` | vitest-mock-extended |
| Flutter | flutter_test | `app/pubspec.yaml` | mockito, mocktail |

### Safety Mechanisms
- Both `api/vitest.config.ts` and `web/vitest.config.ts` will **abort with exit code 1** if `DATABASE_URL` contains `supabase`
- Web runs `verify:test-safety` as a pretest hook
- API overrides `DATABASE_URL` with `DATABASE_URL_TEST` when available

### Mock References
- Prisma mock: `web/tests/mocks/prisma.ts`
- Firebase Admin mock: `web/tests/mocks/firebase-admin.ts`
- Google AI mock: `web/tests/mocks/google-ai.ts`

## Business Architecture

### Dual-Axis Management Model (Dual-Axis Matrix)

**Horizontal axis - Status (when to look)**:
- `INBOX`: Uncategorized incoming items
- `ACTIVE`: Has deadlines, needs active progress
- `MAINTAIN`: Stable maintenance, alert on anomalies
- `REFERENCE`: No time sensitivity, AI auto-links
- `ARCHIVE`: Completed/retired items

**Vertical axis - Entity (what about)**:
- `Area`: Top-level classification
- `Product` (Subject): Concrete business entity (with Lifecycle: FINITE or PERPETUAL)
- `Topic`: Specific subject under a product
- `Task`: Actionable items with sub-items and references

### AI Features (implemented)
- **Brain Dump**: Natural language input parsed into structured tasks
- **Suggest Product**: AI suggests product categorization
- **Adjust Tags**: AI-assisted status/lifecycle tagging
- **Reorganize**: AI-driven task and product reorganization
- **Embeddings**: Vector embeddings for semantic search (pgvector)

### Three Collaborative AI Agents (planned)
1. **The Gatekeeper** - NLU gateway for input processing
2. **The Librarian** - File management and context linking
3. **The Coach** - Operational monitoring and conflict detection

## Key File Paths

**Must-read before modifying code**:
- `docs/00_Constitution/001_Constitution.md` - Project constitution
- `docs/06_Standards/002_Software_Engineering_Standards.md` - Clean Arch & TDD standards
- `docs/06_Standards/001_Naming_and_Taxonomy.md` - Naming conventions & taxonomy

**Specifications & Plans**:
- `docs/01_Specification/001_Product_Definition.md` - Product definition
- `docs/01_Specification/002_Functional_Specification.md` - Functional spec
- `docs/01_Specification/007_MVP_Specification.md` - MVP scope
- `docs/02_Plan/001_Backend_Implementation_Plan.md` - Backend plan
- `docs/02_Plan/035_Frontend_Backend_Separation_Architecture.md` - API/Web separation
- `docs/02_Plan/030_Flutter_App_Implementation_Plan.md` - Flutter app plan

**Database**:
- `api/prisma/schema.prisma` - Database schema (authoritative)
- `web/prisma/` - Web's Prisma schema (mirrors API)

**Development workflow**:
- `docs/05_Refinery/002_SDD_Workflow_Guide.md` - SDD workflow guide

## Development Guidelines

1. **Stability > Performance**: The system's primary mission is providing stability; avoid introducing unpredictable anxiety
2. **Spec is truth**: Any code change must have corresponding spec support; no "coding by feel"
3. **Interface first**: Always define the Interface before writing implementation
4. **Error handling**: Never swallow exceptions; all errors become Domain Exceptions or are logged
5. **Documentation sync**: Specification and Plan must be updated alongside code changes
6. **Task archival**: Completed Tasks move to `docs/03_Tasks/Archive/`
7. **No over-engineering**: Only make changes directly requested or clearly necessary

## Current Development Stage

**Phase 1**: Foundation & Cloud Alignment (completed)
- Firebase project setup, Dockerfile, local testing
- Backend migrated from Python/FastAPI to Next.js/TypeScript

**Phase 2**: Core Product Features (completed)
- Full CRUD for Areas, Products, Tasks, Milestones
- Kanban board with drag-and-drop
- Firebase Authentication integration
- PostgreSQL with Prisma ORM

**Phase 3**: AI Integration & Flutter App (in progress)
- Brain dump, suggest-product, adjust-tags, reorganize AI features
- Flutter mobile app with Riverpod state management
- Task references and sub-items system
- Evaluation logging and audit trail
- Frontend-backend separation architecture
