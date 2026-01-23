
# Naruvia Database Schema Specification (PostgreSQL)

本文件定義了 Naruvia 後端的關聯式資料庫結構。設計原則遵循 `002_Functional_Specification` 中定義的三層本體論 (Area/Product/Topic)。

## 1. Design Principles (設計原則)

*   **Identities**: 所有 Primary Key 使用 `UUID v7` (具備時間排序性)。
*   **Vector First**: 核心實體 (`products`, `tasks`, `topics`) 均具備 `embedding` 欄位以支援語義搜尋。
*   **Flexible Metadata**: 大量使用 `JSONB` 欄位儲存非結構化屬性 (如 AI 分析結果、滾動摘要)。
*   **Soft Delete**: 所有核心表具備 `deleted_at` 欄位。

## 2. Shared Enums (共用枚舉)

為了確保狀態流轉的一致性，`products` 與 `tasks` 表共用以下狀態定義 (Status Enum)：

| Value | Description |
| :--- | :--- |
| `00_inbox` | 未分類入口 (Tasks Only) |
| `10_active` | 高動能衝刺區 |
| `20_maintain` | 週期性營運區 |
| `30_reference` | 靜態知識庫 |
| `40_archive` | 歷史存檔 |

## 3. Core Tables (核心實體表)

### 3.1 `users` (用戶)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | User ID |
| `email` | String | Unique, Not Null | Google Auth Email |
| `settings` | JSONB | Default `{}` | 用戶偏好 (Prompts, MVP Seeds) |

### 3.2 `areas` (L1: Identity & Context)
代表用戶的長期身分與責任邊界。
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Area ID |
| `user_id` | UUID | FK -> users.id | Owner |
| `name` | String | Not Null | e.g., "02_Career_Google", "05_Startup_X" |
| `description` | String | | 用於 AI 判斷此 Area 的邊界 |
| `is_custom` | Boolean | Default False | True=用戶自定義, False=系統預設 |
| `rolling_summary` | JSONB | | **關鍵**: 存儲此 Area 的長期記憶摘要 (Chain of Density) |

### 3.3 `products` (L2: Shareable Assets)
代表具備產出價值的實體資產。
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Product ID |
| `user_id` | UUID | FK -> users.id | **Tenant Check**: 直接擁有者 |
| `area_id` | UUID | FK -> areas.id | 所屬身分 |
| `name` | String | Not Null | e.g., "Naruvia_Backend", "My_Health" |
| `description` | String | | Asset Goal definition |
| `status` | Enum | See Shared Enums | 狀態抽屜 (`10_active` ~ `40_archive`) |
| `embedding` | Vector(768) | | 用於 L0 Search |

### 3.4 `topics` (L3: Nature of Action)
代表工作性質的聚類。
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Topic ID |
| `user_id` | UUID | FK -> users.id | **Tenant Check**: 直接擁有者 |
| `product_id` | UUID | FK -> products.id | 親代產品 (或可設計為跨產品共享) |
| `name` | String | Not Null | e.g., "Feature", "Bugfix" |
| `semantic_center` | Vector(768) | | 用於判斷新 Task 是否屬於此 Topic (Centroid) |

### 3.5 `tasks` (Atomic Work Unit)
最底層的任務或筆記碎料。注意：Task 物理上直接屬於 Product (L2)，Topic 只是其性質標籤。
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Task ID |
| `user_id` | UUID | FK -> users.id | **Tenant Check**: 直接擁有者 (*Critical for Dashboard*) |
| `product_id` | UUID | FK -> products.id | **Core Relation**: 任務直接隸屬於某個資產 |
| `topic_id` | UUID | FK -> topics.id | (Nullable) 性質分類標籤 (Attribute) |
| `content` | Text | Not Null | 原始內容 (Markdown) |
| `status` | Enum | See Shared Enums | 狀態抽屜 (`00_inbox` ~ `40_archive`) |
| `embedding` | Vector(768) | | 用於語義關聯與去重 |
| `ai_analysis` | JSONB | | 存儲 Librarian 的分析結果 (Reasoning, Entity Tags) |

## 3. Indexes & Performance

1.  **Vector Index**: `tasks` 與 `topics` 上的 `embedding` 欄位建立 `HNSW` 索引，加速 `ORDER BY embedding <=> q`。
2.  **Compound Index**: `(user_id, status)` 用於快速拉取 Dashboard 活躍清單。
3.  **GIN Index**: `tasks.ai_analysis` (JSONB) 用於高效率查詢 AI 標籤。

## 5. Migration Architecture (Alembic Workflow)

為了確保 Schema 變更的可追溯性與一致性，本系統採用 **Alembic** 進行版本控制。

### 5.1 架構原則
*   **Code-First**: `app/domain/models.py` (SQLModel) 是唯一的 Schema 定義來源。嚴禁手動修改 DB Table。
*   **Versioned**: 每次變更都會產生一個 timestamped migration script (e.g., `20260124_1530_add_vectors.py`)，並納入 Git 管理。
*   **Automation**: 透過 Helper Scripts 封裝複雜的 alembic 指令。

### 5.2 目錄結構
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

### 5.3 開發流程 SOP
1.  **Modify**: 在 Python 代碼中修改 Model (如新增欄位)。
2.  **Generate**: 執行 `./scripts/db_revision.sh "Description of change"`。
    *   Alembic 會自動比對 Code vs DB，產生 Python Script。
3.  **Review**: **(Critical)** 人工檢查產生的 `.py` 檔，確認沒有意外的 `DROP TABLE` 或 `DROP COLUMN`。
4.  **Apply**: 執行 `./scripts/db_upgrade.sh` 應用變更到本地 DB。
5.  **Commit**: 將 Python Model 與 Migration Script 一起 commit 進 Git。

### 5.4 腳本規格
*   `db_revision.sh`: 封裝 `alembic revision --autogenerate -m "$1"`
*   `db_upgrade.sh`: 封裝 `alembic upgrade head`
