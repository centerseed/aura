# Onboarding Flow 測試驗證指南

**建立日期**: 2026-01-24
**狀態**: Ready for Testing
**關聯文件**: [003_POC_Analysis_and_Problem_Breakdown.md](../05_Refinery/003_POC_Analysis_and_Problem_Breakdown.md)

---

## 測試目的

驗證新用戶 onboarding 流程是否正確運作，包括：
1. 新用戶自動導航至 onboarding 頁面
2. Area 創建功能（包括 scope 字段）
3. AI Librarian 正確載入並使用 Area 邊界進行分類

---

## 測試前準備

### 1. 確認環境運行中

```bash
# 檢查資料庫
docker ps | grep naruvia_db

# 確認 migration 已執行
cd backend
source venv/bin/activate
alembic current
# 應顯示: 6491912acd13 (head)

# 啟動 Streamlit (如果尚未運行)
cd ../frontend
streamlit run main.py
```

### 2. 資料庫驗證

確認 `scope` 欄位已添加：

```bash
docker exec naruvia_db psql -U naruvia -d naruvia_db -c "\d areas"
```

應看到 `scope | character varying | | |` 欄位。

---

## 測試案例 1: 新用戶 Onboarding Flow

### 步驟

1. **清空瀏覽器 Session**
   - 在 Streamlit 左側邊欄點擊「完全清除狀態」按鈕
   - 或直接重新整理頁面

2. **輸入新用戶名稱**
   - 在左側邊欄「你的名字」欄位輸入: `TestUser001`
   - 按下 Enter 鍵

3. **驗證導航到 Onboarding**
   - ✅ 應該自動顯示「🌌 歡迎來到 Naruvia」標題
   - ✅ 副標題：「Information Entropy Reduction System」
   - ✅ 一句話描述：「Naruvia 幫你把腦中混亂的想法，自動整理成清晰的行動計畫。」
   - ✅ 三個目的說明（💭 🤖 🎯）
   - ✅ 看到「你現在戴著哪些「身分帽子」？」區塊

4. **選擇預設 Areas**
   - ✅ 應該看到 6 個預設選項：健康、工作、事業、財務、人際、個人
   - 勾選「工作」和「個人」
   - ✅ 勾選後應顯示對應的 scope 描述
     - 工作: "日常任務、工作專案、團隊協作、績效達成"
     - 個人: "興趣愛好、自我學習、心靈成長、休閒娛樂"

5. **自定義 Area**
   - 在「身分名稱」輸入: `Parent`
   - 在「這個身分包含什麼？」輸入: `育兒、家庭活動、親子教育`
   - ✅ 應該在下方摘要看到 3 個 Areas（工作、個人、Parent）

6. **提交 Onboarding**
   - 點擊「🚀 開始使用 Naruvia」按鈕
   - ✅ 應該看到「正在建立你的身分地圖...」spinner
   - ✅ 成功後顯示「✅ 身分地圖建立完成！」
   - ✅ 自動導航到 Brain Dump 頁面（Act 1）

### 資料庫驗證

```bash
# 查詢新用戶的 Areas
docker exec naruvia_db psql -U naruvia -d naruvia_db -c "
SELECT u.email, a.name, a.scope, a.is_custom
FROM areas a
JOIN users u ON a.user_id = u.id
WHERE u.email = 'testuser001@naruvia.local'
ORDER BY a.created_at;
"
```

**預期結果**:
```
email                      | name   | scope                                         | is_custom
---------------------------+--------+-----------------------------------------------+-----------
testuser001@naruvia.local | 工作   | 日常任務、工作專案、團隊協作、績效達成         | t
testuser001@naruvia.local | 個人   | 興趣愛好、自我學習、心靈成長、休閒娛樂         | t
testuser001@naruvia.local | Parent | 育兒、家庭活動、親子教育                       | t
```

---

## 測試案例 2: 現有用戶跳過 Onboarding

### 步驟

1. **切換到已有 Areas 的用戶**
   - 點擊左側邊欄的用戶下拉選單
   - 選擇 `aa@naruvia.local` 或其他現有用戶

2. **驗證導航**
   - ✅ 應該直接導航到 Dashboard 或 Brain Dump 頁面
   - ❌ 不應該看到 Onboarding 頁面

### 預期行為

系統應該檢測到用戶已有 Areas，跳過 onboarding 流程。

---

## 測試案例 3: AI Librarian 使用 Area 邊界分類

### 步驟

1. **確保已完成測試案例 1**
   - 用戶: `TestUser001`
   - Areas: 工作、個人、Parent

2. **輸入測試內容（涉及單一 Area）**
   - 在 Brain Dump 輸入框輸入:
     ```
     今天和孩子一起去公園玩，發現他最近對恐龍很感興趣，
     我在想要不要週末帶他去自然科學博物館。
     ```
   - 點擊「幫我整理這一切」

3. **驗證分類結果**
   - ✅ 應該分類到 **Parent** Area
   - ✅ 理由應提到「育兒、家庭活動、親子教育」與內容匹配
   - ❌ 不應該創建新的 Area（例如 "Family" 或 "Leisure"）

4. **輸入測試內容（涉及多個 Area）**
   - 在 Brain Dump 輸入框輸入:
     ```
     明天要交季度報告，還要準備下週的 Sprint Planning。
     下班後想去健身房，已經一週沒運動了。
     ```
   - 點擊「幫我整理這一切」

5. **驗證分類結果**
   - ✅ 第一條（季度報告、Sprint Planning）應分類到 **工作** Area
   - ✅ 第二條（健身房）應分類到 **個人** Area（或健康 Area，如果用戶有選）
   - ❌ 不應該創建新的 Area

### 除錯驗證（可選）

如果需要查看 AI Prompt 是否正確載入 Area 邊界，可在 `backend/app/services/librarian.py` 的 `structure_chaos()` 函數中添加 debug 輸出：

```python
# 在 line 186 之後添加
print(f"DEBUG: Context Summary:\n{context_summary}")
```

重新運行後，在終端應看到類似輸出：

```
DEBUG: Context Summary:

### 用戶的身分地圖 (User's Identity Map):
- **工作**: 日常任務、工作專案、團隊協作、績效達成
- **個人**: 興趣愛好、自我學習、心靈成長、休閒娛樂
- **Parent**: 育兒、家庭活動、親子教育
```

---

## 測試案例 4: Edge Cases

### 4.1 用戶不選擇任何 Area

**步驟**:
1. 創建新用戶 `TestUser002`
2. 進入 Onboarding 頁面
3. 不勾選任何預設選項，也不輸入自定義 Area
4. 嘗試點擊「開始使用 Naruvia」

**預期結果**:
- ✅ 按鈕應該是 disabled 狀態（無法點擊）
- ✅ 顯示警告：「⚠️ 請至少選擇或創建一個身分」

### 4.2 只輸入 Area 名稱但沒有 Scope

**步驟**:
1. 創建新用戶 `TestUser003`
2. 進入 Onboarding 頁面
3. 在「身分名稱」輸入 `Freelancer`
4. 不輸入 scope 描述
5. 嘗試點擊「開始使用 Naruvia」

**預期結果**:
- ✅ 按鈕應該是 disabled（因為 `all_areas` 列表為空）
- ✅ 只有同時提供名稱和 scope 才會加入列表

### 4.3 多語言 Area 名稱

**步驟**:
1. 創建新用戶 `TestUser004`
2. 自定義 Area:
   - 名稱: `學習者`
   - Scope: `技能提升、課程學習、知識累積`
3. 提交並驗證資料庫

**預期結果**:
- ✅ 中文 Area 名稱正確存儲
- ✅ AI Prompt 正確載入中文 Area 邊界

---

## 測試案例 5: 簡化版歡迎頁面驗證

### 步驟

1. **清空 Session，回到歡迎頁面**
   - 點擊「完全清除狀態」
   - 或直接重新整理頁面

2. **驗證歡迎頁面內容**
   - ✅ 標題: 🌌 歡迎來到 Naruvia
   - ✅ 副標: Information Entropy Reduction System
   - ✅ 一句話: 「Naruvia 幫你把腦中混亂的想法，自動整理成清晰的行動計畫。」
   - ✅ 三個目的:
     - 💭 隨時記錄想法，不再遺漏重要事項
     - 🤖 AI 自動分類，告別混亂的筆記本
     - 🎯 聚焦當下重要的事，減少決策疲勞
   - ❌ 不應該看到舊版的 4 個特色 + 4 個步驟

---

## 已知問題與限制

### 現有用戶的 Area 沒有 scope

- **現象**: 在 migration 之前創建的 Areas，scope 欄位為 NULL
- **影響**: AI Prompt 會顯示「（尚未定義範圍）」
- **緩解**: 未來可添加「編輯 Area 邊界」功能讓用戶補充

### AI 可能仍會誤創建 Area

- **現象**: 儘管 Prompt 已改進，AI 仍可能在極端情況下創建新 Area
- **緩解**: 監控實際使用情況，必要時實施回退機制（Plan Step 5）

---

## 測試檢查清單

- [ ] **Phase 1**: Database Migration
  - [ ] `scope` 欄位存在於 `areas` 表
  - [ ] Migration 版本為 `6491912acd13`

- [ ] **Phase 2**: Onboarding Flow
  - [ ] 新用戶自動導航到 onboarding
  - [ ] 現有用戶跳過 onboarding
  - [ ] 預設 6 個 Area 選項正確顯示
  - [ ] 自定義 Area 功能正常
  - [ ] Area 創建成功（含 scope）
  - [ ] 提交後正確導航到 Brain Dump

- [ ] **Phase 3**: Librarian Integration
  - [ ] AI Prompt 載入 Area 邊界定義
  - [ ] AI 優先吸附到既有 Area
  - [ ] AI 不隨意創建新 Area
  - [ ] 邊界匹配邏輯正確

- [ ] **Phase 4**: Edge Cases
  - [ ] 不選擇任何 Area 時按鈕 disabled
  - [ ] 中文 Area 名稱正常運作
  - [ ] 現有用戶數據不受影響

- [ ] **Phase 5**: UI 簡化
  - [ ] 歡迎頁面使用簡化版文案
  - [ ] 一句話 + 副標 + 三個目的

---

## 測試結果記錄

### 執行人員
- [ ] 開發者自測
- [ ] QA 驗證
- [ ] 用戶測試

### 測試日期
- [ ] 2026-01-24

### 測試環境
- [ ] Local Development (Streamlit + Docker)
- [ ] Staging
- [ ] Production

### 發現的問題
_（在此記錄測試過程中發現的任何 bugs 或改進點）_

---

## 成功標準

本次實作成功的標準：

- ✅ 新用戶註冊後自動進入 onboarding 流程
- ✅ 用戶可選擇預設身分或自定義身分
- ✅ Area 創建時包含 scope 描述
- ✅ Librarian Prompt 載入並顯示 Area 邊界定義
- ✅ AI 分類時優先吸附到既有 Area（而非創建新 Area）
- ✅ Database migration 成功執行
- ✅ 歡迎頁面文案已簡化

---

**備註**: 如發現任何問題，請記錄在 `docs/04_ADR/` 或建立新的 Refinery 文件。
