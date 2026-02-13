# CLAUDE.md

## 🚨🚨🚨 最高優先級規則 - 部署安全 🚨🚨🚨

### GCP Project 隔離（違反即終止）

**Claude 曾經犯過的致命錯誤：把 Naruvia 的 Docker image 部署到 `paceriz-prod`（Havital 的生產環境），直接覆蓋了 Havital 的 Python/Flask backend，導致所有 Havital 用戶服務中斷。這是不可饒恕的錯誤。**

#### 絕對禁止部署到 `zentropy-4f7a5` 以外的 GCP project

1. **Naruvia 的唯一 GCP project 是 `zentropy-4f7a5`**
2. 🚫 **絕對禁止** 對 `paceriz-prod` 或任何其他 project 執行 `gcloud run deploy`、`gcloud builds submit`、`gcloud run services update` 等任何部署/修改操作
3. 🚫 **絕對禁止** 對非 `zentropy-4f7a5` 的 project 修改環境變數、流量路由、或任何生產配置
4. ✅ 對其他 project 只允許 **唯讀操作**（`describe`、`list`、`logging read`）

#### 部署方式（強制使用腳本）

🚫 **絕對禁止** 直接執行 `gcloud builds submit` 或 `gcloud run deploy` 命令
✅ **必須使用** 以下部署腳本，腳本內建 project 安全檢查：

| 服務 | 部署命令 | 腳本位置 |
|------|---------|---------|
| **API** (zentropy-api) | `cd api && bash scripts/deploy-api.sh` | `api/scripts/deploy-api.sh` |
| **Librarian** (librarian-service) | `cd poc-librarian-js && bash scripts/deploy.sh` | `poc-librarian-js/scripts/deploy.sh` |

**腳本內建安全機制**：
- 自動檢查 GCP project 是否為 `zentropy-4f7a5`，不是則自動切換
- API 腳本：部署前執行 lint → 單元測試 → 整合測試 → 覆蓋率 → build
- Librarian 腳本：部署前初始化 DB schema → build → 冒煙測試

**部署順序**（如果兩個都要部署）：
1. 先部署 **Librarian**（server 端），確認 health check 通過
2. 再部署 **API**（client 端），確認能正確呼叫 Librarian

---

## 🚨🚨🚨 最高優先級規則 - 資料安全 🚨🚨🚨

### 機密資訊保護（違反即終止）

**Claude 曾經犯過的嚴重錯誤：把 API keys、資料庫密碼、Service Account 私鑰寫入會被 git commit 的檔案中，導致機密洩漏到 GitHub。這是不可原諒的低級錯誤。**

#### 絕對禁止將以下資訊寫入任何可能被 commit 的檔案：

1. **API Keys / Tokens**
   - 🚫 Google API Key (`AIzaSy...`)
   - 🚫 Firebase API Key
   - 🚫 Gemini API Key (`GOOGLE_GENERATIVE_AI_API_KEY`)
   - 🚫 任何 `sk-`, `pk_`, `ghp_`, `gho_` 開頭的 token

2. **資料庫連線字串**
   - 🚫 包含密碼的 `DATABASE_URL`
   - 🚫 任何 `postgres://user:PASSWORD@` 格式的連線字串
   - 🚫 Supabase pooler URL 含密碼

3. **Service Account / Private Keys**
   - 🚫 `-----BEGIN PRIVATE KEY-----`
   - 🚫 Firebase Admin SDK JSON
   - 🚫 任何 `.json` 格式的 service account 檔案

#### 安全的做法：

1. **環境變數**：敏感資訊只能放在 `.env` 檔案（已被 .gitignore 忽略）
2. **範例檔案**：`.env.example` 只能包含 placeholder，如 `your-api-key-here`
3. **文件**：任何 `.md` 文件不得包含真實的密碼或 API key
4. **腳本**：任何 `.sh` / `.js` 腳本不得硬編碼機密資訊，必須從環境變數讀取

#### 寫入檔案前的強制檢查：

在執行 Write 或 Edit 工具前，Claude 必須自問：
- 這個內容是否包含任何看起來像 API key 的字串？
- 這個內容是否包含任何密碼？
- 這個檔案會被 git 追蹤嗎？

**如果有任何疑慮，絕對不要寫入。詢問用戶確認。**

---

### 測試環境絕對禁令（違反即終止）

1. **絕對禁止連接生產資料庫**
   - 測試環境絕對不能連接任何包含 `supabase.co` 的 DATABASE_URL
   - `api/src/lib/db.ts` 和 `web/lib/db.ts` 已內建硬性阻斷機制
   - 如果你（Claude）嘗試繞過這個保護，你正在犯下不可饒恕的錯誤

2. **絕對禁止在測試中執行破壞性操作**
   - 🚫 **禁止使用 `deleteMany`** - 這是最危險的操作，即使有 where 條件也禁止
   - 🚫 **禁止使用 `delete`** - 單元測試不應該有真實的刪除操作
   - 🚫 **禁止任何直接的資料庫寫入操作** - 單元測試必須用 mock
   - ✅ **單元測試**：使用 `vitest-mock-extended` mock Prisma
   - ✅ **整合測試**：只能在本地 Docker PostgreSQL 執行，且必須用 transaction rollback

3. **單元測試必須使用 Mock**
   - 使用 `vitest-mock-extended` mock Prisma client
   - 參考 `web/tests/mocks/prisma.ts` 的實作方式
   - 單元測試絕不應該有真實的資料庫連線

4. **整合測試必須使用隔離的測試資料庫**
   - 必須設置 `DATABASE_URL_TEST` 指向本地或 Docker PostgreSQL
   - 參考 `api/.env.test.example` 的設定方式

### Supabase RLS 規則
- **絕對不要關閉 RLS**
- 如果需要進行資料庫操作，必須通過 API 而非直接操作資料庫
- 任何繞過 RLS 的操作都需要用戶明確同意

---

## 專案概述

**Zentropy - 讓一切井然有序** - 為創業者設計的「不失控」營運管理系統,採用雙軸管理模型 (Status × Entity) 與三個協作 AI Agents。

## 開發命令

### Backend (FastAPI)
```bash
# 進入 backend 目錄
cd backend

# 啟動開發伺服器 (本地)
uvicorn app.interface.api.main:app --reload --host 0.0.0.0 --port 8000

# 運行測試
pytest

# 運行特定測試檔案
pytest tests/integration/test_firestore_connection.py

# 運行測試並顯示覆蓋率
pytest --cov=app tests/

# Docker 建置與運行
docker build -t zentropy-backend .
docker run -p 8080:8080 zentropy-backend
```

### 環境設定
- Backend 需要 `.env` 檔案 (參考 `backend/.env.example`)
- 需要 Firebase service account JSON 檔案連接 Firestore
- Python 3.10+ 環境,使用 `backend/venv` 虛擬環境

## 核心開發原則 (憲法級規範)

### Spec-Driven Development (SDD) 工作流
**嚴禁跳過階段** - 這是專案的最高指導原則:

1. **[00_Constitution](docs/00_Constitution)** - 最高法律,所有開發必須符合憲法
2. **[01_Specification](docs/01_Specification)** - 定義「做什麼」與業務價值
3. **[02_Plan](docs/02_Plan)** - 定義「怎麼做」,技術架構與 API 規格
4. **[03_Tasks](docs/03_Tasks)** - 原子任務清單,AI 可執行的具體 Task
5. **[04_ADR](docs/04_ADR)** - 架構決策紀錄 (不可刪除)
6. **[05_Refinery](docs/05_Refinery)** - 方法論精煉
7. **[06_Standards](docs/06_Standards)** - **開發必讀**: 工程標準與命名規範

**關鍵規則**:
- 沒有 Specification 就不准寫 Plan
- 沒有 Plan 就不准拆 Task
- 代碼改動前必須先更新對應文件
- `docs/` 是系統行為的唯一真實來源 (SSOT)

### Clean Architecture 強制規範
Backend (`backend/app/`) 嚴格遵循 Clean Architecture 四層架構:

```
domain/           # 🔵 核心領域層 (最內層)
├── entities/     # 核心數據模型 (無框架依賴)
└── interfaces/   # Repository/Service 行為介面

application/      # 🟢 應用程序層
└── use_cases/    # 業務工作流實作

infrastructure/   # 🔴 基礎設施層 (最外層)
├── firebase/     # Firestore Repository 實作
└── llm/          # Gemini API 整合

interface/        # 🟡 接口轉換層
├── api/          # FastAPI Controllers
└── presenters/   # 輸出格式化
```

**依賴規則**: 外層可依賴內層,內層絕不依賴外層。Domain 層絕不引用 FastAPI 或 Firestore。

**型別與命名規範** (強制執行):
- **資料庫層** (`infrastructure/repositories`): Prisma 原生格式 (camelCase + Date 物件,如 `createdAt: Date`)
- **領域層** (`domain/entities` & `domain/interfaces`): API 標準格式 (snake_case + ISO string,如 `created_at: string`)
- **Repository 層責任**: 必須實作 `toDomain()` 與 `toPrisma()` 方法完整處理格式轉換,嚴禁讓型別不匹配洩漏到 Use Case 層
- **Use Case 層禁令**: 只處理業務邏輯,絕不進行型別轉換或格式處理 (發現需要轉換即表示 Repository 層實作不完整)

### TDD (Test-Driven Development) 強制性
開發順序 (不可違反):
1. 先寫失敗的單元測試
2. 實作最少代碼使測試通過
3. 重構並確保測試通過

**測試覆蓋要求**:
- Domain 與 Application 層必須達到 100% Logic 覆蓋
- 所有 Use Case 必須有對應的單元測試
- 整合測試必須驗證與 Firestore/LLM 的協作

## 核心業務架構

### 雙軸管理模型 (Dual-Axis Matrix)
系統的核心資料架構基於兩個維度:

**橫軸 - Status (何時該看)**:
- `Active` (衝刺): 有期限、需主動推進
- `Maintain` (營運): 穩定維護,異常時亮燈
- `Reference` (知識庫): 無時效性,AI 自動關聯

**縱軸 - Entity (關於什麼)**:
- `Area` (領域): 最高層級分類
- `Project/Subject` (主體): 具體業務實體
- `Topic` (主題): 專案下的具體議題

### 三個協作 AI Agents
系統由三名 Agent 實現全自動化管理:

1. **The Gatekeeper (守門人)** - NLU 閘道器
   - 接收原始輸入 (文字/語音/照片)
   - 執行穩定化處理: 識別 Action/Note,掛載 Entity,判定風險等級
   - 輸出結構化 JSON

2. **The Librarian (圖書管理員)** - 檔案專家
   - 根據 Entity 與 Naming Convention 自動歸檔至 `Zentropy_Vault/`
   - 上下文鏈接: 自動檢索並推薦相關 Reference

3. **The Coach (營運教練)** - 全局監控
   - 衝突偵測: 掃描 WBS 與日曆,預警任務重疊
   - 心理閉環: 主持晨報 (08:30) 與晚報 (21:00)

### Aura_Vault 歸檔邏輯
`Zentropy_Vault/` 存放業務文件,按 Entity 組織:
- `00_Core/`: 核心架構與策略
- `01_Compliance/`: 法律合規
- `02_Treasury/`: 財務稅務
- `03_Lifecycle/`: 專案生命週期
- `05_Growth/`: 成長與行銷
- `06_History/`: 歷史歸檔

檔案命名遵循 `XXX_主題描述_版本.md` 格式 (詳見 `docs/06_Standards/001_Naming_and_Taxonomy.md`)

## 技術棧

**Backend**:
- Python 3.10+
- FastAPI (Asynchronous)
- Pydantic v2
- Google Cloud Firestore
- Google Generative AI (Gemini)
- Pytest + pytest-asyncio

**Frontend** (規劃中):
- Next.js

**部署**:
- Docker 容器化
- Google Cloud Run

## 重要文件路徑參考

**必讀文件** (修改代碼前務必閱讀):
- `docs/00_Constitution/001_Constitution.md` - 專案憲法
- `docs/06_Standards/002_Software_Engineering_Standards.md` - Clean Arch & TDD 標準
- `docs/06_Standards/001_Naming_and_Taxonomy.md` - 命名規範與術語

**規格與計畫**:
- `docs/01_Specification/001_Product_Definition.md` - 產品定義
- `docs/01_Specification/002_Functional_Specification.md` - 功能規格
- `docs/02_Plan/001_Backend_Implementation_Plan.md` - Backend 實作計畫

**開發流程**:
- `docs/05_Refinery/002_SDD_Workflow_Guide.md` - SDD 工作流指南

## 開發注意事項

1. **穩定 > 性能**: 系統首要任務是提供穩定感,避免引入不可預測的焦慮
2. **規格即真理**: 任何代碼改動必須有對應的規格支持,嚴禁「憑感覺編碼」
3. **介面優先**: 永遠先定義 Interface,再撰寫實作
4. **錯誤處理**: 嚴禁吞掉異常,所有錯誤轉化為 Domain Exception 或記錄於 Log
5. **文件同步更新**: Specification 與 Plan 必須隨代碼異動同步更新
6. **任務歸檔**: 完成的 Tasks 移至 `docs/03_Tasks/Archive/`

## 當前開發階段

**Milestone 1**: 基礎環境與雲端對齊 (已完成)
- Firebase 專案設定
- FastAPI 基礎架構
- Dockerfile 與本地測試

**Milestone 2**: Agent Orchestration & MCP Integration (進行中)
- Zentropy Agent Framework 實作
- MCP Client 接口實作
- Tool Access Layer (File_Tool, Calendar_Tool, NLU_Tool)
- 跨 Agent 的 Session_State 管理
