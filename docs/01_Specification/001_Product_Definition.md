# Zentropy Product Definition (產品白皮書)

**Ver 5.0 — AI 知識行動平台**

Zentropy 是一個讓個人與小團隊**在 AI 時代保持共識**的知識行動平台。它以 ZenOS 作為知識圖譜後端，專注在消費者 UI 層——讓用戶透過知識地圖、任務全景圖、Brain Dump 三個介面，把散落在各 AI 工具的思考過程收攏到同一套 ontology，讓 AI 的每個建議都有知識脈絡、讓多人的決策有共識基礎。

---

## 1. 核心問題：AI 工具各自為政

### 問題 A：個人知識不累積

用戶在 Claude Code、Cursor、ChatGPT 裡做了大量思考與決策，但這些**過程（context）沒有地方留下來**。Zentropy 只收到結果（task），不知道為什麼做這個決定、做了什麼取捨。每次對話都從零開始，AI 永遠不了解你。

### 問題 B：多人多 AI 失去共識

小團隊各自用 AI 做影響彼此的決策，卻沒有共享狀態。A 決定了方向，B 的 AI 還在舊的 context 裡給建議。**多 AI 協作的核心問題不是工具整合，而是共識維護。**

### 根本解法：共享 Ontology

Zentropy 的解法：以 ZenOS ontology 作為所有 AI 行動的 context 底層。每個思考過程（Brain Dump）、每個決策（entry）、每個正在進行的工作（task）都歸入知識圖譜，讓任何 AI agent 在任何時間都能讀到最新的共識狀態。

---

## 2. 目標用戶

### 核心 Persona

> **多專案工作者、微型創業團隊——手上跑 3+ 個平行事務，已在用 AI 工具，但 AI 的建議各說各話、沒有共識。**

| 類型 | 典型樣貌 | 核心痛點 |
|:---|:---|:---|
| **AI-Native 工作者** | 用 Cursor/Claude 工作，思考全在 AI 對話裡 | 換個工具就失憶，沒有跨工具的知識累積 |
| **微型創業者** | 1-5 人團隊，成員各自用 AI 協助決策 | 方向跑歪了才發現彼此認知不同 |
| **斜槓工作者** | 白天上班、晚上副業，多個身分切換 | 不同角色的 AI context 混在一起，公私不分 |
| **自由工作者** | 同時服務 3+ 客戶的設計師/開發者/顧問 | 每個客戶一套 context，AI 永遠搞不清楚在服務誰 |

### 為什麼不是所有人？

Zentropy 解決的是「多 AI 協作的共識問題」，對於只用一個 AI 工具的個人用戶來說問題不夠痛。核心 TAM 是**已在用多個 AI 工具、感受到 AI 建議不一致或知識無法累積**的用戶。

---

## 3. 架構：ZenOS 作為知識後端

### 3.1 Zentropy 不自建 Ontology Engine

Zentropy 直接使用 ZenOS 作為知識圖譜後端。每個 Zentropy 用戶 = 一個 ZenOS 租戶。這個架構決策帶來三個好處：

1. **統一知識底層**：創辦者和用戶的公私領域都在同一個知識圖譜，不再分裂
2. **驗證平台能力**：Zentropy 作為 ZenOS 的第一個真實 B2C 客戶，倒逼 ZenOS 定義清楚的 API 邊界
3. **開放 MCP 生態**：任何外部 AI agent 都能透過 ZenOS MCP 讀取 Zentropy 用戶的 context

### 3.2 兩層架構

```
知識層 (Knowledge Layer) ──── ZenOS Ontology API
  ├── Area (角色/身分)
  ├── Product (正在經營的資產)
  └── Entry (決策、洞察、學習)

行動層 (Action Layer) ─────── Zentropy UI + DB
  ├── Milestone (重要里程碑)
  └── Task (最小執行單元)
```

**知識層**由 ZenOS 管理，負責語意索引、跨角色關聯、drift detection。
**行動層**由 Zentropy 管理，負責任務狀態、進度追蹤、截止日提醒。

### 3.3 三層本體論（簡化版）

| 層級 | 概念 | 定義 | 範例 |
|:---|:---|:---|:---|
| **L1** | **Area (角色)** | 長期身分認同，也是隱私隔離容器 | `創辦人@副業`、`工程師@公司`、`個人生活` |
| **L2** | **Product (資產)** | 正在經營、具備持續價值的工作實體 | `Zentropy 產品`、`客戶 A 專案`、`健康管理` |
| **L3** | **Task (行動)** | 最小可執行單元，屬於某個 Product | `完成 login 頁面`、`撰寫週報` |

---

## 4. 核心 UI Surfaces

### 4.1 Brain Dump — 零摩擦思考輸入

用戶用任意語言、任意形式丟入碎片想法。系統用兩段式 embedding 找到最相關的 Product，由 LLM 決定追加 sub-item 或建新 Task，raw_input 完整保留。

**解決的問題**：思考過程不再只停在 Claude Code 的對話裡——丟進 Zentropy，就進了知識圖譜，下次任何 AI 都能讀到。

### 4.2 知識地圖 — Ontology 視覺化

以視覺方式呈現 Area、Product、Entry 的關聯結構。讓用戶一眼看到：
- 哪個 Product 的知識最豐富（可以放心交給 AI）
- 哪個 Product 是空的（AI 在這個領域是盲的）
- 不同 Product 之間有哪些意外關聯

### 4.3 任務全景圖 — 跨 Product 行動視角

跨所有 Product 的 Task 統一視圖，支援：
- 按 deadline、狀態、Product 篩選
- 衝突偵測（同一時段塞太多事）
- 進度停滯預警（超過 N 天沒動的 Task）

---

## 5. Librarian Engine（背景熵減）

Librarian 持續在背景運行，不需要用戶主動操作：

- **Rolling Summary**：維護每個 Product 的最新摘要，讓 AI 每次讀到的是精煉後的知識而非原始堆積
- **Drift Detection**：偵測知識圖譜的語意漂移——當實際行動偏離 Product 的宣稱方向時，主動提醒
- **Correction Learning**：從用戶對 AI 建議的修正中學習偏好，讓分類越來越準

Librarian 的產出會同步回 ZenOS ontology，確保外部 AI agent 讀到的也是最新狀態。

---

## 6. Workspace 協作

每個 Workspace 對應一個 ZenOS tenant，成員共享同一套 ontology：

- **Owner**：建立 Workspace，設定 Product 結構，管理共識邊界
- **Member**：讀取共享 Product 的 context，各自執行 Task
- **共識機制**：當 Member 的 Brain Dump 與共享 ontology 出現語意衝突時，系統標記待確認而非靜默覆蓋

**核心價值**：多人用不同 AI 工具協作時，共享狀態確保 AI 建議基於同一套事實，而非各自的 local context。

---

## 7. MCP 開放接入

Zentropy 透過 ZenOS MCP 暴露用戶的知識圖譜給外部 AI agent：

| 角色 | 功能 |
|:---|:---|
| **Context Provider** | 外部 AI（Claude Code、Cursor）讀取 Zentropy 的 Product 知識作為工作 context |
| **Action Handler** | 外部 AI 觸發 `capture_thought`，把對話決策直接存回 Zentropy |
| **Governance Engine** | 外部 AI 觸發 Librarian，維護知識整潔 |

**Vision**：To be the **shared context layer** for personal and team AI workflows.

---

## 8. 與競品的關鍵差異

| 維度 | 傳統任務工具（Notion、ClickUp） | AI 排程工具（Motion、Reclaim） | Zentropy v5.0 |
|:---|:---|:---|:---|
| **核心假設** | 用戶手動整理資訊 | 用戶主要問題是時間排程 | 用戶問題是 AI context 碎片化 |
| **知識層** | 無（靜態文件） | 無 | ZenOS ontology，語意索引 |
| **多 AI 協作** | 不支援 | 不支援 | **核心功能** — 共享 context |
| **思考過程** | 存文件，不索引 | 不存 | Brain Dump → ontology |
| **MCP 整合** | 無 | 無 | 原生支援，ZenOS API |

---

## 9. 商業模式

| 方案 | 定價 | 內容 |
|:---|:---|:---|
| **Atom** | Free | 單人、單 Workspace、基礎 Brain Dump、每月 50 次 Librarian |
| **Fusion** | Paid | 無限 Brain Dump、Librarian 無限、MCP 接入、行事曆整合 |
| **Nexus** | Premium | 多人 Workspace、共識機制、API 存取、進階 drift detection |

---

## 10. 近期優先序（v5.0 起）

| 階段 | 內容 | 狀態 |
|:---|:---|:---|
| **P0** | ZenOS API 整合、每用戶對應一個 tenant | 規劃中 |
| **P1** | Brain Dump v2（context 帶入 ontology）、知識地圖 MVP | 下一步 |
| **P2** | 任務全景圖重構（基於 ZenOS task）、Librarian drift detection | 規劃中 |
| **P3** | Workspace 協作、多成員共識機制 | 規劃中 |
| **P4** | MCP 開放接入、外部 AI context 讀取 | 規劃中 |

---

*Zentropy 不是另一個任務清單，它是 AI 時代的**知識共識層**——讓你和你的 AI 協作夥伴，永遠基於同一套事實行動。*
