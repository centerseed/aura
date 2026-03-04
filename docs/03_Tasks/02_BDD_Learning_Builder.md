# BDD: Active Builder - 學習軌跡規劃器 (Learning Builder)

## 背景描述
在 Zentropy M6 中，Active Builder 的目標是將用戶「模糊的大型願景」轉化為「可落地的 Zentropy 任務結構」。
針對「學習」這個情境，最大的痛點是：**長達數月甚至一年的學習目標，若被一次性拆解為數百張零碎的每日卡片，將會導致嚴重的看板災難與視覺疲勞（Board Clutter）。**

因此，Learning Builder 的設計不是「窮盡拆解」，而是採用「**里程碑式大綱 (Milestone Focus) + 當前衝刺區拆解 (Current Sprint)**」的漸進式載入策略。這能讓用戶看見全貌，但每日只專注在眼前的具體任務。

---

## 1. 核心產出策略 (The "Not-Too-Many" Strategy)

假設用戶輸入的是：「我想花一年時間，從零開始學日文並通過 N2 檢定。」
這是一個 52 週的超大計畫。如果系統吐出 365 張「背單字」的卡片，這會是毀滅性的體驗。

**Learning Builder 的產出架構 (最多只生成 5-8 張卡片)：**
1. **建立 1 個專案 (Product)**: `學習日語 (零到 N2)` (這整個專案只會有一個優先度，例如預設為 P1)
2. **建立 4-6 個里程碑 (Milestones)**: 這些是真正的 `milestone` entity，而不是 Task。它們作為大綱存在。例如：「Q1:五十音與基礎文法」、「Q2:N4 情境會話」...
3. **只細拆「第一個里程碑 (The Next 2-4 Weeks)」:** 針對第一個 Milestone，生成 5-8 個可以直接執行的 `Task` (狀態為 `ACTIVE`)。未來的 Milestone 底下此時**完全沒有任何 Task** (留白，保護認知)。

---

## 2. BDD Scenario: 啟動 Learning Builder

### Scenario: 將中長期學習目標轉化為漸進式計畫
**Given** 用戶在 Inbox 建立了一個名為 `花半年學會前端開發` 的單一 Task
**When** 用戶點開該 Task 的詳細畫面
**And** 點擊 `✨ 請 Builder 幫我拆解這個大目標` 按鈕
**Then** Builder 應建立一個新 Product: `前端開發學習計畫` (優先度繼承或預設)
**And** 系統應生成 4 個 `Milestone` (對齊該 Product)，分別給予時間跨度：
    * Milestone: `Phase 1 (Month 1): HTML/CSS 與 JavaScript 基礎`
    * Milestone: `Phase 2 (Month 2-3): React 核心概念與 State Management`
    * Milestone: `Phase 3 (Month 4-5): Next.js Server Components`
    * Milestone: `Phase 4 (Month 6): 實作個人 Side Project 驗收`
**And** 系統只針對 **Phase 1** 生成具體的 `Task` (Status 為 `ACTIVE`)，並綁定這該 Milestone：
    * Task: `註冊 FreeCodeCamp 並完成 HTML/CSS 段落`
    * Task: `閱讀 MDN Javascript 基礎型別`
    * Task: `跟著教學做一個簡單的計算機網頁`
**And** 原始的那個巨大 Task `花半年學會前端開發` 將被刪除或轉為 Description。

---

## 3. BDD Scenario: 跨階段的動態調整與學習檢核 (Dynamic Check-in)

> （這是接續「漸進式產出」的重要環節。如果只是一昧照著最初的計畫生成後續任務，那就只是個模板產生器，失去了「教練」的價值。）

### 3.1 狀態檢核觸發機制 (Triggering the Check-in)
**Given** 當前 Milestone (`Phase 1: HTML/CSS 基礎`) 底下的最後一個 `ACTIVE` Task 被使用者標記為 `ARCHIVE`，或該 Milestone 被手動標記為 `completed`
**When** 系統的背景作業偵測到此狀態變更
**Then** 後端不立即生成 Phase 2 任務，而是建立一筆「待決議的教練互動 (Pending Coach Interaction)」。
**And** 在使用者的 Dashboard 頂部 (或 Morning Briefing 區塊)，浮現一張醒目的**「階段回顧卡 (Milestone Review Card)」**。

### 3.2 UI 介面設計：極簡回饋卡片 (The Review Card UX)
**Given** 使用者看見「階段回顧卡」
**Then** 卡片的 UI 結構應包含：
1. **肯定與引導 (Prompt)**：
   > 「🎉 恭喜完成 **Phase 1: HTML/CSS 基礎**！在展開 **Phase 2: React 核心概念** 之前，想確認一下：你對上一階段學的 CSS 版面配置覺得掌握度如何？」
2. **零摩擦選項 (Quick Actions)**：
   - 🟢 `[沒問題，這對我太簡單了]` (代表：可以直接加速或跳躍)
   - 🔵 `[穩穩的，按計畫繼續]` (代表：照原本大綱展開)
   - 🟡 `[有點模糊，想再多練習一下]` (代表：需要補救，降低難度)
3. **文字補充框 (Optional Text Input)**：
   - Placeholder: `可以告訴我哪裡卡住了，例如：「我對 CSS Grid 還是搞不懂...」`
   - 一個 `[送出並展開下一階段]` 的按鈕。

### 3.3 AI 流程與動態重建 (The AI Pipeline)
**Given** 使用者點擊了任一選項，或輸入了補充文字
**When** 前端將 `user_feedback` (例: "有點模糊" + "我對 CSS Grid 還是搞不懂") 與 `current_milestone`、`next_milestone` 傳送至 `/api/builder/unroll-milestone`
**Then** 系統將啟動 LLM 決策引擎，並套用以下 Prompt 模型：

```text
[System]
你是一位嚴謹但有同理心的程式導師。
你的學生剛完成了 Milestone_1 (HTML/CSS)，準備進入 Milestone_2 (React)。
使用者的回饋是：{user_feedback}。
如果使用者覺得困難，請在 Milestone_2 的前期插入「補救性/銜接性任務」。
如果使用者覺得太簡單，可以把 Milestone_2 中太基礎的任務合併或跳過。
請輸出 5-8 個結合使用者回饋的具體 Task，JSON 格式。
```

**And** 返回新的 JSON 結構。
**Then** 系統將這些新生成的 Task，綁定到 `Phase 2` 的 Milestone 之下。
**And** 這些任務被標記為 `ACTIVE`，立刻呈現在使用者的 Kanban / To-Do 列表上，供使用者衝刺：
    * 任務 1: `[觀念複習] 看這支 15 分鐘的 CSS Grid 圖解影片`
    * 任務 2: `[實戰結合] 用 React 刻一個有 Grid 版面的九宮格組件`
    * 任務 3: `[React] 了解 React Component 概念`

---

## 4. 領域知識注入 (Domain Knowledge Injection) 範例

Builder 的魔法在於它知道「該學什麼」，而不是讓生手盲人摸象。這套機制可以套用在任何學習領域上：

### 範例 A：軟體開發學習 (想學 Python 爬蟲)
**Builder 生成的 Phase 1 Tasks:**
1. ✅ `[環境] 下載 VS Code 與安裝 Python 3.x`
2. ✅ `[基礎] 了解 requests 函式庫與 GET/POST 概念`
3. ✅ `[基礎] 使用 BeautifulSoup 解析 HTML 標籤萃取文字`
4. ✅ `[實戰] 嘗試爬取 PTT 或 Yahoo 電影的前 10 筆標題` 

### 範例 B：語言學習 (想考過日文 N2)
> 語言學習的特性是「習慣累積與反覆驗收」，Builder 會注入對應的讀書計畫節奏。

**Builder 生成的 Phase 1 (五十音與 N5 基礎) Tasks:**
1. ✅ `[習慣] 每天早上 10 分鐘，用 Duolingo / APP 刷平假名 (重複設定: 每天)`
2. ✅ `[觀念] 觀看這支 20 分鐘的 N5 動詞分類基礎教學影片`
3. ✅ `[產出] 試著用日文寫下今天晚餐吃了什麼，並丟給 ChatGPT 改錯`
4. ✅ `[驗收] 週末完成一份 N5 模擬小測驗 (預計本週末)`

**動態檢核 (Dynamic Check-in) 對語言學習的應用：**
當第一週結束，用戶回答 `[🟡 有點模糊，動詞變化好難懂]` 時，進入 Phase 2 (N4 文法) 的任務就會被自動安插：
- `[補救] 觀看圖解動詞て形變化影片`
- `[實作] 寫下 5 句包含て形的日常造句`
*(Coach 發現你卡關，所以延後了原本排定的進階閱讀測驗，先幫你鞏固地基。)*
*(而不是空泛的「看書第一章、看書第二章」)*

---

## 結論 UX
- **產出數量管控**：無論許願多大，1 次 Builder 呼叫，最多只會在你的 Dashboard 產生 `< 10` 張立即可執行的卡片。
- **認知保護**：大目標永遠存在，但被封裝在「未展開」的中長期待辦清單裡。用戶只需要凝視眼前的「5 張任務」。
- **動能延續**：每完成一個小階段，就像破關一樣解鎖下一包任務，持續給予正回饋，避免一開始看到 100 件事而直接放棄。
