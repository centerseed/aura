# Task 003: Backend Foundation Implementation (Naruvia Phase 1)

**Status**: To Do
**Owner**: Antigravity
**Dependencies**: `docs/01_Specification/008_Database_Schema_Spec.md`

## 1. 目標 (Objective)
建立 Naruvia 的技術地基，設置 PostgreSQL 資料庫結構 (使用 SQLModel)，配置 Alembic 進行遷移版本控制，並建立基礎的 `LibrarianService` 骨架。這是所有 UI 開發的先決條件。

## 2. 範圍 (Scope)
*   **目錄**: `backend/app/domain/`
*   **目錄**: `backend/alembic/`
*   **檔案**: `backend/app/services/librarian.py`
*   **檔案**: `backend/app/infrastructure/db/`

## 3. 實作規格 (Implementation Specs)

### 3.1 資料庫模型 (`backend/app/domain/models.py`)
實作 `008_Database_Schema_Spec.md` 中定義的 Schema。
*   **Enums**: 定義 `StatusEnum` (`00_inbox`...`40_archive`) 與 `LifecycleEnum` (`finite`, `perpetual`)。
*   **Tables**:
    *   `User`: UUID, email, settings (JSONB).
    *   `Area`: UUID, user_id, name, description, is_custom, rolling_summary (JSONB).
    *   `Product`: UUID, user_id, area_id, name, description, status, lifecycle, embedding.
    *   `Topic`: UUID, user_id, product_id, name, semantic_center (Vector).
    *   `Task`: UUID, user_id, product_id, topic_id, content, status, embedding, ai_analysis (JSONB).
    *   `GovernanceProposal`: UUID, user_id, type, payload, status.
*   **Constraint**: 所有 UUID 必須使用 `uuid7` (具備排序性)。使用 `pgvector` 存儲向量。

### 3.2 資料庫基礎設施 (`backend/app/infrastructure/db.py`)
*   設置 `create_engine` (首選 Async，但在 Streamlit POC 階段若為了簡化可考慮 Sync - *決策：為了 Streamlit POC 相容性，核心邏輯暫時使用 Sync，或小心管理 Async* -> 修正：Streamlit 已經支援 async。為了未來性，我們將使用 **SQLModel (AsyncEngine)**，並在 Service 層使用 `async def`。)。
*   實作 `get_session()` 生成器。

### 3.3 Alembic 設置 (`backend/alembic/`)
*   初始化 `alembic init`。
*   配置 `env.py` 以匯入 `sqlmodel.SQLModel.metadata`。
*   建立輔助腳本：`scripts/db_revision.sh`, `scripts/db_upgrade.sh`。

### 3.4 Librarian Service 骨架 (`backend/app/services/librarian.py`)
*   建立 `LibrarianService` 類別。
*   方法 `process_brain_dump(text: str, user_id: UUID) -> List[Task]`。
    *   目前僅需佔位符或簡單邏輯。
*   整合 `GeminiAdapter` (已存在) 以確保 API Key 運作正常。

## 4. 驗證計畫 (Verification Plan)
1.  執行 `docker-compose up -d db` (啟動 Postgres + pgvector)。
2.  執行 `scripts/db_upgrade.sh`。
3.  執行測試腳本 `backend/tests/verify_db.py`：
    *   建立一個 User。
    *   建立一個 Area ("Life")。
    *   建立一個 Product ("Run Marathon")。
    *   斷言 (Assert) 這些項目存在於資料庫中。
