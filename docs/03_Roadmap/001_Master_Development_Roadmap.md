
# Zentropy Master Development Roadmap

**Version**: v1.0
**Date**: 2026-01-26
**Vision**: To be the Operating System for Personal Agency & Collaborative Assets.

本文件整合了 Zentropy 的所有核心發展計畫，從目前的單人 POC 直至未來的多人協作生態系。

---

## Phase 1: The Core Foundation (目前階段)
**目標**: 建立穩固的單人治理系統，驗證「主動熵減」的核心價值。

### 1.1 Web POC Refinement (架構升級)
*   **Tech Stack**: Next.js (App Router) + Supabase (Postgres/Auth) + Cloud Run.
*   **Key Tasks**:
    - [ ] 遷移至 Supabase Auth (Google Login)。
    - [ ] 將 Prisma Schema 遷移至 Supabase SQL，並啟用 RLS。
    - [ ] 實作前後端分離：Frontend (Firebase Hosting) + Backend API (Cloud Run)。

### 1.2 Librarian Engine v1 (治理引擎)
*   **Focus**: State Mutations & Personalization.
*   **Key Tasks**:
    - [ ] 實作 `entity_snapshots` 表，記錄 Product/Area 的時空演變。
    - [ ] 實作 `user_corrections` 表，捕捉用戶對 AI 建議的修正（隱性回饋）。
    - [ ] 開發「修正向量計算」邏輯 (Vector Delta Calculation)。
    - [ ] 實作 Brain Dump API 的個人化搜尋 (RAG + Bias Vector)。

### 1.3 MCP Server Alpha (無頭協議)
*   **Focus**: Headless Integration with Cursor/Claude.
*   **Key Tasks**:
    - [ ] 開發 MCP Server (Node.js SDK)。
    - [ ] 實作 `zentropy://` Resources (讀取 Spec/Tasks)。
    - [ ] 實作 `capture_thought` Tool (寫入 Inbox)。

---

## Phase 2: The Deep Governance (深度治理)
**目標**: 強化 AI 的長期記憶與敘事能力，建立數據護城河。

### 2.1 Recursive Narrative Memory (遞歸記憶)
*   **Focus**: Rolling Sagas.
*   **Key Tasks**:
    - [ ] 實作 `narrative_nodes` 表 (L0/L1/L2 層級)。
    - [ ] 開發 "Weekly Saga Generator" (Cron Job)，自動週更 Product 摘要。
    - [ ] 在 Dashboard 實作 "Time Travel" 視圖，查看專案演進歷史。

### 2.2 Prompt Quality Loop (品質閉環)
*   **Focus**: Evaluation & Tracking.
*   **Key Tasks**:
    - [ ] 實作 `ai_usage_logs` 追蹤所有 Token 用量與結果。
    - [ ] 開發 Judge Agent 每日抽樣評估機制。
    - [ ] 建立 AI Health Dashboard (監控幻覺率與修正率)。

---

## Phase 3: Collaborative Assets (多人協作)
**目標**: 將個人的資產 (Product) 開放給與特定的協作者，但嚴格控制治理權限。

### 3.1 Collaboration Schema & RLS
*   **Concept**: 協作發生在 **L2 Product** 層級 (非 Area 層級)。
*   **Schema Update**:
    ```sql
    CREATE TABLE product_collaborators (
      product_id UUID REFERENCES products(id),
      user_id UUID REFERENCES users(id),
      role VARCHAR(20) CHECK (role IN ('OWNER', 'EDITOR', 'VIEWER')),
      PRIMARY KEY (product_id, user_id)
    );
    ```
*   **Key Tasks**:
    - [ ] 更新 Supabase RLS Policies，支援基於 `product_collaborators` 的存取控制。
    - [ ] 實作邀請機制 (Invite by Email)。

### 3.2 Granular Permissions (權限分級)
*   **Owner (治理者)**:
    - 唯一擁有者，擁有 **AI Reorganize** 權限 (只有 Owner 能按「一鍵整理」)。
    - 可以邀請/移除成員。
    - 可以修改 Product 的元數據 (Narrative, Status)。
*   **Editor (貢獻者)**:
    - 可以 Create/Edit/Move 自己的 Tasks。
    - 可以將 Task 標記為 Complete。
    - **無法**觸發 AI 重組 (避免破壞 Owner 的結構)。
    - **無法**更改 Product 的 Status (如 Archive)。
*   **Viewer (觀察者)**:
    - 僅能查看 Tasks 和 Sagas。

### 3.3 Collaboration UI
*   **Key Tasks**:
    - [ ] Product Header 顯示協作者頭像。
    - [ ] Task Card 顯示 "Created By" / "Assigned To"。
    - [ ] Activity Log: 顯示誰修改了什麼 (避免 AI 治理與人工修改混淆)。

---

## Phase 4: Ecosystem & Mobile (生態系與行動版)
**目標**: 全面接管用戶的數位生活入口。

### 4.1 Mobile App (Flutter)
*   **Focus**: Capture & Review.
*   **Key Tasks**:
    - [ ] 快速語音輸入 (Voice Capture)。
    - [ ] Push Notification (Coach 的晚報推送)。
    - [ ] Widget (今日 Active Tasks)。

### 4.2 Integrations (Gatekeeper 擴展)
*   **Focus**: Ingestion Channels.
*   **Key Tasks**:
    - [ ] Telegram/LINE Bot (轉發訊息進 Inbox)。
    - [ ] Gmail Add-on (將郵件轉為 Task)。
    - [ ] Calendar Sync (雙向同步 Due Date)。

---

## 技術堆疊演進路徑

| Stage | Backend | Database | AI Model | Auth |
| :--- | :--- | :--- | :--- | :--- |
| **P1** | Cloud Run (Node.js) | Supabase (Postgres) | Gemini 2.5 Flash | Supabase Auth |
| **P2** | Cloud Run + Scheduler | Supabase + pgvector | Gemini 2.5 Flash Lite (Sagas) | Supabase Auth |
| **P3** | Cloud Run (Scalable) | Supabase (RLS Heavy) | Ensembles (Router) | Supabase + SSO |

---

## 關鍵里程碑 (Milestones)

*   **M1 (Alpha)**: 單人版，具備基本 AI 分類與 MCP 讀取功能。 (Target: Month 1)
*   **M2 (Beta)**: 具備完整 Librarian Engine (記憶+修正) 與 MCP 寫入功能。 (Target: Month 2)
*   **M3 (v1.0)**: 推出多人協作功能 (Product Level Sharing)。 (Target: Month 3-4)
