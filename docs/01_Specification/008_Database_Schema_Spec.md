
# Zentropy Database Schema Specification (PostgreSQL)

本文件定義了 Zentropy 後端的關聯式資料庫結構。設計原則遵循 `002_Functional_Specification` 中定義的三層本體論 (Area/Product/Topic)。

> **實作參考**: Web POC 使用 Prisma ORM，Schema 定義於 `web/prisma/schema.prisma`

## 1. Design Principles (設計原則)

*   **Identities**: 所有 Primary Key 使用 `UUID`。
*   **Vector First**: 核心實體 (`products`, `tasks`, `topics`) 均具備 `embedding` 欄位以支援語義搜尋。
*   **Flexible Metadata**: 大量使用 `JSONB` 欄位儲存非結構化屬性 (如 AI 分析結果、滾動摘要)。
*   **Soft Delete**: 所有核心表具備 `deleted_at` 欄位。
*   **Timestamp Tracking**: 所有表均具備 `created_at` 與 `updated_at` 欄位。

## 2. Shared Enums (共用枚舉)

### 2.1 Status Enum (狀態抽屜)
為了確保狀態流轉的一致性，`products` 與 `tasks` 表共用以下狀態定義：

| Value | Description |
| :--- | :--- |
| `INBOX` | 未分類入口 (Tasks Only) |
| `ACTIVE` | 高動能衝刺區 |
| `MAINTAIN` | 週期性營運區 |
| `REFERENCE` | 靜態知識庫 |
| `ARCHIVE` | 歷史存檔 |

### 2.2 Lifecycle Enum (生命週期)

| Value | Description |
| :--- | :--- |
| `FINITE` | 有終點的專案 (e.g., App v1.0) |
| `PERPETUAL` | 永續維護的資產 (e.g., Health, Server) |

### 2.3 MilestoneStatus Enum (里程碑狀態)

| Value | Description |
| :--- | :--- |
| `planned` | 已規劃 |
| `in_progress` | 進行中 |
| `completed` | 已完成 |
| `delayed` | 延遲 |
| `cancelled` | 已取消 |

### 2.4 EntityType Enum (實體類型)

| Value | Description |
| :--- | :--- |
| `AREA` | L1 身分層級 |
| `PRODUCT` | L2 資產層級 |
| `TOPIC` | L3 主題層級 |

## 3. Core Tables (核心實體表)

### 3.1 `users` (用戶)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | User ID |
| `created_at` | Timestamp | Not Null, Default Now | 建立時間 |
| `updated_at` | Timestamp | Not Null, Auto Update | 更新時間 |
| `deleted_at` | Timestamp | Nullable | 軟刪除時間 |
| `email` | String | Unique, Not Null | Google Auth Email |
| `settings` | JSONB | Default `{}` | 用戶偏好 (Prompts, MVP Seeds) |

### 3.2 `areas` (L1: Identity & Context)
代表用戶的長期身分與責任邊界。
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Area ID |
| `created_at` | Timestamp | Not Null, Default Now | 建立時間 |
| `updated_at` | Timestamp | Not Null, Auto Update | 更新時間 |
| `deleted_at` | Timestamp | Nullable | 軟刪除時間 |
| `user_id` | UUID | FK -> users.id | Owner |
| `name` | String | Not Null | e.g., "工作", "生活", "創業" |
| `description` | String | Nullable | 用於 AI 判斷此 Area 的邊界 |
| `scope` | String | Nullable | **新增**: Area 的職責範圍描述 (用於 AI 分類) |
| `is_custom` | Boolean | Default False | True=用戶自定義, False=系統預設 |
| `rolling_summary` | JSONB | Nullable | **關鍵**: 存儲此 Area 的長期記憶摘要 (Chain of Density) |

### 3.3 `products` (L2: Shareable Assets)
代表具備產出價值的實體資產。
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Product ID |
| `created_at` | Timestamp | Not Null, Default Now | 建立時間 |
| `updated_at` | Timestamp | Not Null, Auto Update | 更新時間 |
| `deleted_at` | Timestamp | Nullable | 軟刪除時間 |
| `user_id` | UUID | FK -> users.id | **Tenant Check**: 直接擁有者 |
| `area_id` | UUID | FK -> areas.id | 所屬身分 |
| `name` | String | Not Null | e.g., "Zentropy_Backend", "My_Health" |
| `description` | String | Nullable | Asset Goal definition |
| `status` | Enum (Status) | Not Null | 狀態抽屜 (`ACTIVE` ~ `ARCHIVE`) |
| `lifecycle` | Enum (Lifecycle) | Not Null | `FINITE` 或 `PERPETUAL` |
| `embedding` | Vector(768) | Nullable | 用於 L0 Search |

### 3.4 `topics` (L3: Nature of Action)
代表工作性質的聚類。
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Topic ID |
| `created_at` | Timestamp | Not Null, Default Now | 建立時間 |
| `updated_at` | Timestamp | Not Null, Auto Update | 更新時間 |
| `deleted_at` | Timestamp | Nullable | 軟刪除時間 |
| `user_id` | UUID | FK -> users.id | **Tenant Check**: 直接擁有者 |
| `product_id` | UUID | FK -> products.id | 親代產品 |
| `name` | String | Not Null | e.g., "Feature", "Bugfix", "Design" |
| `semantic_center` | Vector(768) | Nullable | 用於判斷新 Task 是否屬於此 Topic (Centroid) |

### 3.5 `tasks` (Atomic Work Unit)
最底層的任務或筆記碎料。注意：Task 物理上直接屬於 Product (L2)，Topic 只是其性質標籤。
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Task ID |
| `created_at` | Timestamp | Not Null, Default Now | 建立時間 |
| `updated_at` | Timestamp | Not Null, Auto Update | 更新時間 |
| `deleted_at` | Timestamp | Nullable | 軟刪除時間 |
| `user_id` | UUID | FK -> users.id | **Tenant Check**: 直接擁有者 |
| `product_id` | UUID | FK -> products.id | **Core Relation**: 任務直接隸屬於某個資產 |
| `topic_id` | UUID | FK -> topics.id | (Nullable) 性質分類標籤 (Attribute) |
| `content` | Text | Not Null | 任務標題/內容 |
| `status` | Enum (Status) | Not Null | 狀態抽屜 (`INBOX` ~ `ARCHIVE`) |
| `start_date` | Timestamp | Nullable | 計劃開始日期 |
| `due_date` | Timestamp | Nullable | 截止日期 |
| `inferred_from_milestone` | UUID | Nullable | **AI 時間推斷**: 關聯的里程碑 ID |
| `time_confidence` | Float | Nullable | **AI 時間推斷**: 信心分數 (0.0-1.0) |
| `embedding` | Vector(768) | Nullable | 用於語義關聯與去重 |
| `ai_analysis` | JSONB | Nullable | 存儲 Librarian 的分析結果 (含 time_reasoning) |
| `references` | JSONB | Default `[]` | **參考資料**: 儲存 URL 連結或文字備註的陣列 |

### 3.6 `milestones` (里程碑)
定義 Product 層級的目標日期，用於 AI 時間推斷。
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Milestone ID |
| `created_at` | Timestamp | Not Null, Default Now | 建立時間 |
| `updated_at` | Timestamp | Not Null, Auto Update | 更新時間 |
| `deleted_at` | Timestamp | Nullable | 軟刪除時間 |
| `user_id` | UUID | FK -> users.id | Owner |
| `name` | String | Not Null | e.g., "MVP 上線", "Beta 測試完成" |
| `target_date` | Timestamp | Not Null | 目標日期 |
| `status` | Enum (MilestoneStatus) | Default `planned` | 里程碑狀態 |
| `entity_type` | Enum (EntityType) | Not Null | 關聯的實體類型 (通常為 `PRODUCT`) |
| `entity_id` | UUID | Not Null | 關聯的實體 ID |
| `priority` | Integer | Default 5 | 優先級 (1-10) |
| `description` | String | Nullable | 里程碑描述 |

### 3.7 `governance_proposals` (AI Suggestions)
儲存需要 User/Coach 核准的高風險治理建議 (The "Suggestion" Actions)。
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Proposal ID |
| `created_at` | Timestamp | Not Null, Default Now | 建立時間 |
| `updated_at` | Timestamp | Not Null, Auto Update | 更新時間 |
| `deleted_at` | Timestamp | Nullable | 軟刪除時間 |
| `user_id` | UUID | FK -> users.id | Owner |
| `type` | String | Not Null | e.g., `create_product`, `merge_topic`, `archive_entity` |
| `target_id` | UUID | Nullable | 涉及的現有實體 ID (若有) |
| `payload` | JSONB | Not Null | 建議變更的內容 (e.g., `{ "new_name": "...", "reason": "..." }`) |
| `status` | Enum (ProposalStatus) | Default `PENDING` | `PENDING`, `APPROVED`, `REJECTED` |

## 4. AI Analysis JSONB Structure (AI 分析 JSON 結構)

`tasks.ai_analysis` 欄位儲存 AI 分析結果：

```json
{
  "narrative": "任務的上下文敘述",
  "lifecycle": "FINITE | PERPETUAL",
  "strategy_used": "boundary_match | semantic_anchor | new_structure",
  "reasoning": "分類推理說明（繁體中文）",
  "time_reasoning": "時間推斷理由（繁體中文）",
  "manual_adjustment": "手動調整記錄（如有）",
  "adjusted_at": "2026-01-25T00:00:00Z"
}
```

`tasks.references` 欄位儲存參考資料陣列：

```json
[
  {
    "id": "uuid-string",
    "type": "url",
    "content": "https://example.com/resource",
    "title": "資源標題（可選）",
    "created_at": "2026-01-26T00:00:00Z"
  },
  {
    "id": "uuid-string",
    "type": "note",
    "content": "參考 John 在會議中的建議",
    "created_at": "2026-01-26T00:00:00Z"
  }
]
```

**參考資料類型**:
- `url`: 網頁連結，content 為完整 URL，可選填 title
- `note`: 純文字備註，content 為任意文字說明

**合併規則**: 當 Task 合併或變成 sub-item 時，兩個 Task 的 references 陣列會自動合併，並根據 `id` 去除重複項目。

## 5. Indexes & Performance

1.  **Vector Index**: `tasks` 與 `topics` 上的 `embedding` 欄位建立 `HNSW` 索引，加速 `ORDER BY embedding <=> q`。
2.  **Compound Index**: `(user_id, status)` 用於快速拉取 Dashboard 活躍清單。
3.  **GIN Index**: `tasks.ai_analysis` (JSONB) 用於高效率查詢 AI 標籤。
4.  **Time Index**: `(user_id, due_date)` 用於快速拉取時間視圖任務。

## 6. Migration Architecture

### 6.1 Web POC (Prisma)
*   **Schema File**: `web/prisma/schema.prisma`
*   **Migration Command**: `npx prisma migrate dev --name <description>`
*   **Generate Client**: `npx prisma generate`

### 6.2 Backend (Alembic)
*   **Code-First**: `app/domain/models.py` (SQLModel) 是唯一的 Schema 定義來源。
*   **Versioned**: 每次變更都會產生 timestamped migration script。

```
backend/
├── alembic/
│   ├── versions/      # 所有的遷移腳本 (Migration History)
│   └── env.py         # Alembic Config (連結 App Models)
├── alembic.ini        # Main Config
└── scripts/
    ├── db_revision.sh # 生成新的遷移檔
    └── db_upgrade.sh  # 執行遷移到最新版
```

### 6.3 開發流程 SOP
1.  **Modify**: 在 Python 代碼中修改 Model (如新增欄位)。
2.  **Generate**: 執行 `./scripts/db_revision.sh "Description of change"`。
3.  **Review**: **(Critical)** 人工檢查產生的 `.py` 檔。
4.  **Apply**: 執行 `./scripts/db_upgrade.sh` 應用變更到本地 DB。
5.  **Commit**: 將 Python Model 與 Migration Script 一起 commit 進 Git。

---

*此 Schema 設計支援完整的 AI 時間推斷功能與多實體類型的里程碑關聯。*

