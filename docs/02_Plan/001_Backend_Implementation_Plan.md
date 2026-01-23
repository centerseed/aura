
# Aura Backend Implementation Plan (Phase 2 & 3)

本計畫定義了 Naruvia Backend 從 POC 驗證過渡到正式生產環境的具體開發路徑。核心專注於實作經過驗證的 **Entropy Reduction Governance (熵減治理)** 與 **Rolling Structured Memory (滾動結構化記憶)**。

---

## Technical Architecture Overview
*   **Language**: Python 3.10+
*   **Framework**: FastAPI
*   **LLM**: Gemini 1.5 Pro (Governance) / Flash (Routine Tasks)
*   **Persistence**: PostgreSQL 16+ with `pgvector`
*   **ORM**: SQLAlchemy 2.0+ (Async)
*   **Memory**: Area-based Rolling Summary (Stored in Postgres JSONB)
*   **Vector**: L0 Funnel via `pgvector` (Unified DB)
*   **Quality**: Judge Agent Evaluation Pipeline

---

## Phase 2: Core Services Implementation (Librarian Ecosystem)

**Objective**: Build the sophisticated "Librarian Service" that handles knowledge governance using the First Principles validated in POC.

### 2.1 Librarian Service Structure
- [ ] **Task 2.1.1**: Scaffold `LibrarianService` and Domain Models.
    - Setup `SQLModel` / `SQLAlchemy` async engine.
    - Define tables: `trivial_inputs`, `entities`, `area_contexts` (w/ JSONB summary).
- [ ] **Task 2.1.2**: Implement **Structure-Aware Saga (Rolling Summary)** mechanism.
    - Port logic from `memory_compression_poc.py` (Chain of Density Prompt).
    - Implement Repository layer for `AreaContext` CRUD.
- [ ] **Task 2.1.3**: Implement **Governance Funnel (Scalability Layer)**.
    - **L0**: Implement `pgvector` search to find candidate Entities (`ORDER BY embedding <=> q`).
    - **L1**: Sliding Window Context builder (Summary + last 5 mutations).
- [ ] **Task 2.1.4**: Implement **Governance Logic (The Brain)**.
    - Port logic from `adapter_reorganize_demo.py` (Gravity Tracking & Entropy Reduction).
    - Implement `Exclusion Check` for Life domain (Bitcoin != Cat).

### 2.2 Quality Assurance & Prompt Ops
- [ ] **Task 2.2.1**: Set up `tests/evaluation/` directory for Golden Set.
- [ ] **Task 2.2.2**: Implement `JudgeAgent` to verify Summary Recall & Hallucination rates.
- [ ] **Task 2.2.3**: Integrate "Daily Health Check" cron job skeleton.

---

## Phase 3: Agent Orchestration & API Exposure

**Objective**: Connect Librarian to the rest of the system via Coach/Gatekeeper and expose APIs.

### 3.1 Coach Service Integration
- [ ] **Task 3.1.1**: Implement `CoachService` to govern the "Approval Flow".
    - When Librarian proposes a change (e.g., specific merge or new tag), Coach must review it based on user preferences.
    - Logic: High Entropy changes (Life domain) require Coach approval; Low Entropy (Work domain) can be auto-merged.
- [ ] **Task 3.1.2**: Create `ReviewDashboard` API for frontend to display "Before vs After" states (like the POC output).

### 3.2 Data Ingestion Pipeline
- [ ] **Task 3.2.1**: Update `GatekeeperService` to route raw inputs to `LibrarianService` (asynchronously).
- [ ] **Task 3.2.2**: Implement the "Incremental Batching" trigger (e.g., runs every 4 hours or when inputs > 10).

### 3.3 Vector & Search Infrastructure
- [ ] **Task 3.3.1**: Integrate `pgvector` extension in Postgres Docker/Cloud setup.
- [ ] **Task 3.3.2**: Implement `EmbeddingService` to vectorize input/entity descriptions.

## Phase 4: Meta-Governance (Tag Renovation)
- [ ] **Task 4.1**: Implement `TagAuditor` service to calculate density & trigger alerts.
- [ ] **Task 4.2**: Implement `ClusteringEngine` (scikit-learn or simple cosine logic) for proposal generation.
- [ ] **Task 4.3**: Integrate `BlueprintReview` UI in Coach Dashboard.
- [ ] **Task 4.4**: Implement `MigrationExecutor` with rollback capability.
