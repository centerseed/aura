
# Zentropy Web POC Specification (Next.js)

本文件定義了 Zentropy 的 Web POC 實作規格。此 POC 用於直觀展示核心治理能力 (Entropy Reduction) 與 AI 驅動的任務管理系統。

## 1. 技術選型 (Technology Stack)

*   **Web Framework**: Next.js 14+ (App Router) + React 18+
*   **UI Library**: Tailwind CSS + shadcn/ui + Lucide Icons
*   **Drag & Drop**: @dnd-kit/core + @dnd-kit/sortable
*   **Backend API**: Next.js Route Handlers (API Routes)
*   **ORM**: Prisma Client
*   **Persistence**: PostgreSQL 16+ (支援 pgvector 擴展)
*   **LLM**: Google Gemini 2.5 Flash Lite via `@ai-sdk/google`
*   **AI SDK**: Vercel AI SDK (`ai` package) + Zod Schema 驗證

## 2. 功能模組 (Modules)

### 2.1 Onboarding Tour (新手引導)
*   **功能**: 引導用戶了解系統概念與操作方式。
*   **路徑**: `/onboarding/tour`
*   **UI**:
    *   三頁式動畫引導介紹核心概念
    *   Area/Product/Topic 三層架構說明
    *   完成後導向主 Dashboard

### 2.2 Dashboard (主控台)
*   **功能**: 綜合視圖，展示用戶的所有 Area、Product 和 Task。
*   **路徑**: `/dashboard`
*   **視圖切換**:
    *   **Structure View**: 依 Area → Product 層級展示任務
    *   **Timeline View**: 依時間軸展示任務（日/週視圖）
    *   **Gantt View**: 甘特圖視圖，顯示里程碑與任務時程

### 2.3 Quick Capture (快速輸入)
*   **功能**: 自然語言輸入界面，支援多種 AI 操作。
*   **輸入模式**:
    *   **Brain Dump**: 將混亂輸入結構化為任務
    *   **Adjust Tags**: 自然語言調整任務分類
    *   **Reorganize**: AI 分析並建議結構重組
*   **UI 元素**:
    *   多行文字輸入區域
    *   AI 處理結果預覽
    *   確認/修改/取消操作按鈕

### 2.4 Structure View (結構視圖)
*   **功能**: 展示組織良好的任務層級結構。
*   **UI 特性**:
    *   **Area 摺疊面板**: 可展開/收合的身分區塊
    *   **Product 卡片**: 
        *   顯示專案名稱與里程碑
        *   支援拖曳移動到不同 Area
        *   顯示所屬任務清單
    *   **Task 項目**:
        *   顯示標題、Topic 標籤、截止日期
        *   支援拖曳到不同 Product
        *   Drawer 狀態色彩標示
        *   一鍵完成按鈕
    *   **Drag & Drop**:
        *   Task 可拖曳到任意 Product
        *   Product 可拖曳到任意 Area
        *   Task 拖到 Area 時觸發 AI 專案推薦

### 2.5 Timeline View (時間軸視圖)
*   **功能**: 以時間為主軸展示任務。
*   **UI 特性**:
    *   日視圖 / 週視圖切換
    *   依據 due_date 分組顯示
    *   逾期任務高亮顯示
    *   無日期任務獨立區塊

### 2.6 Milestone Management (里程碑管理)
*   **功能**: 為 Product 設定目標日期。
*   **操作**:
    *   直接在 Product 卡片上新增/編輯里程碑
    *   顯示剩餘天數與狀態
    *   支援多個里程碑（依日期排序）

### 2.7 Product & Area 管理
*   **功能**: 手動管理組織結構。
*   **操作**:
    *   新增 Area（設定名稱與範圍描述）
    *   在 Area 下新增 Product
    *   編輯 Area 的名稱與 scope

## 3. API 端點 (API Routes)

### 3.1 LLM 相關 API

| 端點 | 方法 | 功能 |
|------|------|------|
| `/api/brain-dump` | POST | 將自然語言輸入結構化為任務 |
| `/api/adjust-tags` | POST | 解析並執行標籤調整指令 |
| `/api/suggest-product` | POST | AI 推薦專案名稱 |
| `/api/reorganize` | POST | AI 分析並建議重組結構 |

### 3.2 CRUD API

| 端點 | 方法 | 功能 |
|------|------|------|
| `/api/users` | GET | 獲取用戶資訊 |
| `/api/library` | GET | 獲取完整 Area → Product → Task 結構 |
| `/api/areas` | GET/POST | 獲取/建立 Area |
| `/api/areas/[id]` | PATCH/DELETE | 更新/刪除 Area |
| `/api/products` | GET/POST | 獲取/建立 Product |
| `/api/products/[id]` | PATCH/DELETE | 更新/刪除 Product |
| `/api/tasks` | GET/POST/PATCH | 任務 CRUD |
| `/api/milestones` | GET/POST | 里程碑 CRUD |
| `/api/milestones/[id]` | PATCH/DELETE | 更新/刪除里程碑 |

## 4. 資料結構 (Prisma Schema)

### 4.1 核心 Enums
```prisma
enum Status {
  INBOX     // 收件匣
  ACTIVE    // 進行中
  MAINTAIN  // 維護中
  REFERENCE // 參考資料
  ARCHIVE   // 已歸檔
}

enum Lifecycle {
  FINITE    // 有終點的專案
  PERPETUAL // 永續維護
}

enum MilestoneStatus {
  planned
  in_progress
  completed
  delayed
  cancelled
}
```

### 4.2 核心 Models
*   **User**: id, email, settings
*   **Area**: id, user_id, name, description, scope, rolling_summary
*   **Product**: id, user_id, area_id, name, status, lifecycle, embedding
*   **Topic**: id, user_id, product_id, name, semantic_center
*   **Task**: id, user_id, product_id, topic_id, content, status, due_date, time_confidence, inferred_from_milestone, ai_analysis
*   **Milestone**: id, user_id, name, target_date, status, entity_type, entity_id, priority, description

## 5. AI 功能詳述

### 5.1 Brain Dump (腦內傾倒)
*   **輸入**: 自然語言文字
*   **輸出**: 結構化任務清單
*   **AI 判斷**:
    *   標題精簡化
    *   三層標籤分類 (Area/Product/Topic)
    *   Drawer 狀態分配
    *   Due Date 推斷（三階段策略）
    *   分類理由說明

### 5.2 Adjust Tags (標籤調整)
*   **輸入**: 自然語言調整指令
*   **輸出**: 任務移動/Topic 變更操作
*   **支援指令範例**:
    *   「把 XX 移到 YY 專案」
    *   「把所有關於 ZZ 的任務歸到 WW 專案」
    *   「把 XX 的 Topic 改成 YY」

### 5.3 Time Inference (時間推斷)
*   **三階段策略**:
    *   **A (強關聯 0.8-1.0)**: 任務與里程碑直接相關
    *   **B (中關聯 0.5-0.8)**: 任務屬於有里程碑的 Product
    *   **C (弱關聯 0.2-0.5)**: 依據 Drawer 狀態默認推斷
*   **輸出欄位**: due_date, time_confidence, time_reasoning, inferred_from_milestone

## 6. 目標體驗 (Target Experience)

1.  用戶在 Dashboard 看到清晰的 Area/Product 結構
2.  開啟 Quick Capture，輸入「明天要把 Zentropy 架構圖畫好，還有記得買牛奶」
3.  AI 自動拆解為兩條結構化任務：
    *   Task A: 「繪製架構圖」→ `工作` > `Zentropy` (Active, 明天到期)
    *   Task B: 「買牛奶」→ `生活` > `日常」(Active, 本週內)
4.  用戶可拖曳任務到不同專案
5.  用戶可設定里程碑，系統自動推斷相關任務的截止日期
6.  用戶感受到：「它真的懂我的意圖，而且井然有序。」

---

*此 POC 採用現代化 Web 技術棧，具備完整的前後端分離架構，可直接擴展為生產環境。*
