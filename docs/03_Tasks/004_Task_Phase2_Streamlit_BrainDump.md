# Task 004: Narrative Engine & Act 1/2 UI (Phase 2)

**Status**: To Do
**Owner**: Antigravity
**Dependencies**: `Task 003`

## 1. 目標 (Objective)
實作「三幕劇」的前兩幕：這不是傳統的任務管理介面，而是一個強調「被理解」的情感體驗。
Act 1: Chaos (輸入混亂) -> Act 2: Insight (AI 心理分析與反饋)。

## 2. 範圍 (Scope)
*   **Backend Logic**: `backend/app/services/librarian.py` (新增 Narrative Insight 功能)
*   **Frontend UI**: `frontend/app.py` (Single Page Application 邏輯)

## 3. 實作規格 (Implementation Specs)

### 3.1 Librarian Narrative Engine (`backend/app/services/librarian.py`)
*   **Method**: `generate_narrative_insight(text: str) -> dict`
*   **Prompt**: 設計一個專門的 Prompt，不進行任務分類，而是分析使用者的：
    *   **焦慮來源 (Source of Anxiety)**.
    *   **場景拉扯 (Conflicting Contexts)**.
    *   **隱形責任 (Hidden Obligations)**.
*   **Output JSON**:
    ```json
    {
      "insight_text": "我看到三個場景在拉扯你...",
      "anxiety_score": 0.9,
      "detected_contexts": ["Work", "Health"]
    }
    ```

### 3.2 Frontend Act 1: The Chaos (UI)
*   **State**: `st.session_state.step = 'act1'`
*   **Layout**: 極簡全螢幕。
*   **Identity**: 簡單的輸入框 `st.text_input("Hi, I'm...")` 用於 Alias 登入。
*   **Input**: 巨大 `st.text_area`，Placeholder 充滿共鳴的混亂例子。
*   **Action**: 按鈕 **`[ 幫我理清這一切 ]`** (Encouraging).
    *   點擊後轉場至 Act 2，並呼叫 `generate_narrative_insight`。

### 3.3 Frontend Act 2: The Insight (UI)
*   **State**: `st.session_state.step = 'act2'`
*   **UI**:
    *   顯示 `insight_text` (可做打字機效果)。
    *   **關鍵**: 這不是 Console，而是一封給使用者的信。
*   **Action Buttons**:
    *   Primary: **`[ 先幫我整理最焦慮的 ]`** -> 呼叫結構化邏輯 (Task 005) 並進入 Act 3。
    *   Secondary: `[ 這不是重點, 重來 ]` -> 回到 Act 1。

## 4. 驗證計畫 (Verification Plan)
1.  Act 1: 輸入 "User1"，打一段 "我好累，專案做不完，還要照顧貓"。
2.  Act 2: 看到 AI 回應 "工作與生活正在拉扯你..."，且有精準指出 "照顧貓" 是生活責任。
3.  確認 DB 尚未寫入正式 Task (Insights 可以暫存或不存)。
