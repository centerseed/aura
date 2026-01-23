# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

**SAM System (Stability-first Attention Management)** - 為創業者設計的「不失控」營運管理系統,採用雙軸管理模型 (Status × Entity) 與三個協作 AI Agents。

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
docker build -t aura-backend .
docker run -p 8080:8080 aura-backend
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
   - 根據 Entity 與 Naming Convention 自動歸檔至 `Aura_Vault/`
   - 上下文鏈接: 自動檢索並推薦相關 Reference

3. **The Coach (營運教練)** - 全局監控
   - 衝突偵測: 掃描 WBS 與日曆,預警任務重疊
   - 心理閉環: 主持晨報 (08:30) 與晚報 (21:00)

### Aura_Vault 歸檔邏輯
`Aura_Vault/` 存放業務文件,按 Entity 組織:
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
- Aura Agent Framework 實作
- MCP Client 接口實作
- Tool Access Layer (File_Tool, Calendar_Tool, NLU_Tool)
- 跨 Agent 的 Session_State 管理
