# Zentropy Technical Blueprint (全域技術藍圖)

本文件定義了 Zentropy 系統跨平台的實作架構、技術棧與測試策略。

## 1. 技術棧 (Tech Stack)
*   **Backend**: Python 3.10+ & FastAPI (異步、高性能)。
*   **Persistence**: PostgreSQL 16+ (Relational Data, JSONB).
*   **Vector Search**: pgvector Extension (L0 Funnel & Semantic Search).
*   **ORM**: SQLAlchemy 2.0+ (Async).
*   **Web POC**: Next.js 14+ (App Router), React 18+, Tailwind CSS, Prisma ORM
*   **Mobile App**: Flutter (REST API Client).
*   **LLM**: Gemini 2.5 Flash Lite (核心 NLU 引擎，透過 @ai-sdk/google 整合).
*   **AI SDK**: Vercel AI SDK (`ai` package) + Zod Schema 驗證.

## 2. 目錄結構 (Directory Structure) - Clean Arch 實踐

### 2.1 Backend (Python)
`backend/app/`
*   `domain/`: Entities (純數據模型) & Interfaces (定義 Repository/Service 接口)。
*   `application/`: Use Cases (業務流程邏輯) & DTOs。
*   `infrastructure/`: Firestore 實作、LLM API 實作、外部服務。
*   `interface/`: FastAPI Routes, Middleware。

### 2.2 Mobile (Flutter)
`app/lib/src/`
*   `domain/`: 核心業務模型與抽象介面。
*   `application/`: BLoC / Provider / Riverpod 邏輯層。
*   `infrastructure/`: API Client, Firebase 插件封裝。
*   `presentation/`: Widget UI 層。

## 3. 測試策略 (Testing Strategy - TDD First)

### 3.1 單元測試 (Unit Tests)
*   **目標**: 100% 覆蓋 `domain` 與 `application` 層。
*   **原則**: 不依賴外部網路與數據庫。使用 Mock 分離 Infrastructure。
*   **流程**: 撰寫失敗測試 -> 實作 Domain 邏輯 -> 通過測試。

### 3.2 整合測試 (Integration Tests)
*   **目標**: 驗證 FastAPI 到 Firestore、或是 Gatekeeper 到 Librarian 的鏈接。
*   **時機**: 每個功能 Task 完成後執行。

## 4. 數據模型與 Firestore 映射
(未來在此定義具體的 Collection 結構：Inputs, Users, Entities, etc.)

## 5. System Architecture Diagram

以下架構圖展示了各元件的交互流向，特別強調了 **Agent 協作鏈** 與 **治理閉環 (Governance Loop)**：

```mermaid
graph TD
    %% --- Clients ---
    subgraph Clients [Omni-Channel Entry]
        Web[Web Dashboard]
        Mobile[Flutter App]
        LINE[LINE Handler]
    end

    %% --- Orchestration Layer ---
    subgraph Orchestrator [Agent Orchestrator]
        GK[Gatekeeper Agent]
        LIB[Librarian Agent]
        COACH[Coach Agent]
        
        GK -->|Structured Input| LIB
        LIB -->|Governance Proposal| COACH
        COACH -->|Approval/Insight| Web
    end

    %% --- Governance Core (The Brain) ---
    subgraph Governance [Governance Core]
        Funnel[L0/L1 Funnel]
        Saga[Rolling Saga Builder]
        
        LIB -.-> Funnel
        Funnel -.-> Saga
    end

    %% --- Persistence Layer ---
    subgraph Persistence [State & Storage]
        Postgres[(PostgreSQL + pgvector)]
        subgraph Vault [Knowledge Vault]
            MD[Markdown Files]
        end
        
        LIB -->|Update Context/Vector| Postgres
        COACH -->|Commit Changes| MD
        Postgres <-->|Sync State| MD
    end

    %% --- Quality Loop ---
    subgraph QA [Quality Assurance]
        Judge[Judge Agent]
        
        Judge -.->|Health Check| Postgres
    end

    Clients --> GK
    Saga <--> Postgres
    Funnel <--> Postgres
```

## 6. Core Services Architecture & Governance Scalability

#### 5.1 Backend Service Layer (FastAPI)
The backend is structured around domain-driven services:

- **CoachService**: Aggregates data for the Coach Agent's dashboard.
- **LibrarianService**:
    - **Responsibility**: Handles "Semantic Refactoring" and "Knowledge Governance".
    - **Scalability & Cost Control (The Governance Funnel)**: To prevent Token explosion and high latency as user data grows, Librarian uses a 3-layer filter before invoking LLM:
        - **L0: Vector Pre-filtering (PostgreSQL + pgvector)**:
            - Instead of feeding all data, system calculates Cosine Similarity between incoming `Trivial Tasks` and existing `Active Entities`.
            - Only entities with similarity score > 0.6 are retrieved as candidates.
            - *Cost*: Negligible (Matrix Math).
        - **L1: Context Sliding Window**:
            - For identified candidate entities, do NOT load full history. Load only the `Current Narrative Summary` + `Last 5 Mutations`.
            - Historical details are compressed into the summary during previous refactoring cycles.
        - **L2: Incremental Batching**:
            - Governance runs as a background cron job (e.g., daily at 4 AM).
            - Processing small batches (10-20 items) daily is significantly cheaper and more accurate than monthly bulk processing.
    - **LLM Interaction**: Only after L0/L1 filtering, the condensed context is sent to Gemini for high-level reasoning (Gravity/Entropy checks).

- **VectorAnalyticsService**: 
    - Manages embeddings generation and vector search.
    - Providing relevance scores for context retrieval.
