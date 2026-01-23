
# Naruvia Streamlit POC Implementation Plan

本計畫定義了如何使用 Streamlit 快速構建 Naruvia 的互動式原型 (Proof of Concept)。目標是在 24 小時內產出一個可部署、可演示的 Web App。

## 1. 架構設計 (Architecture)

為了速度，我們採用 **"Monolith via Streamlit"** 模式：

*   **Frontend**: Streamlit (Python)
*   **Logic**:直接引用 `backend.app.services` 中的 Python Class (LibrarianService)。
*   **Database**: PostgreSQL (Supabase / Neon / Local Docker)。
*   **Configuration**: 使用 `.env` (Local) 與 `st.secrets` (Cloud)。

## 2. 目錄結構 (Directory Structure)

```
Naruvia/
├── backend/                  # 核心邏輯 (與正式版共用)
│   ├── app/
│   │   ├── domain/           # Models (SQLModel)
│   │   ├── services/         # Librarian Logic
│   │   └── infrastructure/   # LLM Adapter
│   └── ...
├── frontend/                 # POC 專用介面
│   ├── app.py                # Entry Point
│   ├── pages/
│   │   ├── 1_Context_Setup.py
│   │   ├── 2_Rapid_Ingest.py
│   │   ├── 3_Librarian_Console.py
│   │   └── 4_Kanban_Board.py
│   └── components/           # UI 一般元件
└── requirements.txt          # 包含 streamlit, sqlmodel, google-generativeai
```

## 3. 實作步驟 (Step-by-Step Tasks)

### Phase 1: Foundation (Data & Logic)
- [ ] **Task 1.1**: Setup `backend/app/domain/models.py`. (SQLModel 定義 Area, Product, Task).
- [ ] **Task 1.2**: Implement `DatabaseService`. (負責 init_db 和 get_session).
- [ ] **Task 1.3**: Implement `LibrarianService.process_input()`. (核心 NLU 邏輯，將 String 轉為 Task 物件).

### Phase 2: Streamlit UI Implementation
- [ ] **Task 2.0**: **Session & Auth Simulation (Sidebar)**.
    - Input: `User Alias` (e.g., "Max").
    - Logic: Check DB for user. If not exists -> Create User & Run Seed.
    - Set `st.session_state.current_user` for global access.
- [ ] **Task 2.1**: **Context Setup Page**.
    - 表單：新增 Area, 新增 Product。
    - 列表：顯示目前 Ontology。
- [ ] **Task 2.2**: **Rapid Ingest Page**.
    - Text Area + "Save to Inbox" 按鈕。
- [ ] **Task 2.3**: **Librarian Console (The Magic)**.
    - 讀取 Inbox 資料。
    - 顯示 "Thinking..." (Stream LLM output).
    - 顯示 Diff View (原始 vs 結構化)。
    - "Commit" 按鈕 (寫入 DB)。
- [ ] **Task 2.4**: **Kanban Board**.
    - 依 Status (Active/Maintain) 分欄顯示 Tasks。

### Phase 3: Deployment
- [ ] **Task 3.1**: Create `Supabase` project & get connection string.
- [ ] **Task 3.2**: Push to Github.
- [ ] **Task 3.3**: Deploy to Streamlit Cloud & Configure Secrets.

## 4. 成功標準 (Success Criteria)
1.  用戶打開網頁，在側邊欄輸入 User Alias (如 "DemoUser") 即可進入專屬空間。
2.  能新增一個 "Project Alpha"。
3.  能輸入 "明天要跟客戶開會"。
4.  在 Console 看到 AI 自動把它歸類到 `Work > Project Alpha > Meeting`。
5.  在看板上看到這張卡片。
