# Task 005: Act 3 Clarity & Structure (Phase 3)

**Status**: To Do
**Owner**: Antigravity
**Dependencies**: `Task 004`

## 1. 目標 (Objective)
實作「三幕劇」的最後一幕：Clarity (清晰化)。將前一幕的 Insight 轉化為具體的結構圖，並揭露 Naruvia 的 Ontology。

## 2. 範圍 (Scope)
*   **Backend Logic**: `backend/app/services/librarian.py` (新增 Structure Chaos 功能)
*   **Frontend UI**: `frontend/app.py` (Act 3 View)

## 3. 實作規格 (Implementation Specs)

### 3.1 Librarian Structure Engine (`backend/app/services/librarian.py`)
*   **Method**: `structure_chaos(text: str) -> List[Task]`
    *   這是原本的 `process_input`，但現在是為了 Act 3 服務。
    *   將文字轉換為 Area/Product/Topic 結構。
    *   重點：必須能將 Insight 中的 "隱形責任" 具體化為 Product。

### 3.2 Frontend Act 3: The Clarity (UI)
*   **State**: `st.session_state.step = 'act3'`
*   **Layout**: 左右分割 (Split View)。
*   **Left (Gray)**: 顯示原始的 Chaos Text (Read-only)。
*   **Right (Clear)**: 顯示整理後的樹狀結構 (Tree View)。
    *   **Style**: 不要用死板的表格。用縮排與 emoji 展示階層。
    *   **命名揭露**:
        > **【工作 Area】**
        > └ 正在累積的事 (Product)：**稅務申報**
        >    - 待辦 (Topic): 跟會計約時間
*   **Footer Reveal**:
    *   顯示一段小字：「Naruvia 其實是用三個層次在理解你：生活場景 (Area) → 累積中的事 (Product) → 你實際在做的事 (Topic)」。
    *   Button: `[ 再丟一段內容給我 ]` (Reset to Act 1)。

## 4. 驗證計畫 (Verification Plan)
1.  從 Act 2 點擊「整理」。
2.  Act 3 右側出現清晰的清單，階層正確。
3.  確認資料已寫入 DB。
4.  點擊 Reset，確認 Session 狀態重置，可以再次輸入。
