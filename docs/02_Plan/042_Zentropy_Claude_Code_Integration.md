# Zentropy & Claude Code Integration Plan (Zentropy AI PM System)

## 行銷與產品願景 (Vision)
Zentropy 的核心定位為輕量化的專案管理與事務記錄系統。目前透過整合 Model Context Protocol (MCP)，已具備串接大型語言模型 (LLM) 代理 (Agent) 的能力。
此計畫的目標是：使 Zentropy 躍升為具備「AI PM」能力的系統，透過賦予 Claude Code 開發指令，令其能在不具備全專案 Context 的前提下，依靠「引導式探索框架 (Guided Discovery Framework / Wrapper Prompt)」自主完成 Bug 修復與功能開發。

## 系統痛點與挑戰 (Problem Statement)
*   **輕量化本質**：Zentropy 的 Task 內文通常簡短（如：「修復登入頁按鈕無法點擊」），系統內不可能也**不應**儲存開發專案的完整程式碼或上下文本體。
*   **Claude Code 的限制**：當 Claude Code 透過 MCP 取得一項簡短任務時，若無前導探索（Context Building），容易陷入「無法下筆」或「亂改程式碼」的窘境。

## 核心解法：夾心餅乾提示詞 (Wrapper Prompt Strategy)
捨棄「把程式碼塞給 Claude Code」的思維，改為「**在 MCP 傳遞任務時，外包一層嚴格的行動守則 (Action Protocol)**」。
讓 Zentropy 負責決定「What & Why」，Claude Code 依靠自身的 `grep`, `find`, `view_file` 能力負責找尋「How & Where」。

---

## 系統架構設計 (System Architecture)

### 1. Zentropy MCP Server 端改造 (最推薦方案)
為達到最低整合成本，變動應集中在 Zentropy MCP Server 回傳 Task 的 Payload 結構上。

#### 流程圖
1. 開發者終端機輸入：`claude -p "請幫我處理下一個 Zentropy 上的高優先級 Task"`
2. Claude Code 透過 MCP 發送 `get_task` 請求。
3. Zentropy MCP Server 從資料庫撈取輕量原始任務。
4. **[關鍵變更]** Zentropy MCP Server 不直接回傳 JSON，而是將 Task JSON 塞入預先定義好的**超級 Prompt 模板 (Wrapper Template)**。
5. Claude Code 收到落落長的 Prompt 後，自動進入「探索期 -> 假設期 -> 執行期 -> 收尾期」。

### 2. Wrapper Template 範例設計
以下範本將強制讓 Claude Code 從「程式碼工人」轉變為「負責任的開發工程師」：

```markdown
[系統最高指導原則] 
你現在負責執行來自 Zentropy PM 系統的一項開發任務。由於 Zentropy 秉持輕量記錄，以下提供的資訊僅為業務邏輯表述，無任何系統程式碼的 Context。
🚨 **警告：在沒有釐清上下文前，絕對禁止修改任何程式碼。**

【Zentropy 任務內容】
- 任務 ID：{{TASK_ID}}
- 標題：{{TITLE}}
- 描述：{{DESCRIPTION}}
- 標籤/模組暗示：{{TAGS}}

【執行守則：四階段工作流 (Four-Phase Workflow)】
請依照以下四個階段執行，並在對話中顯性呈現你的思考過程：

1. **Context Discovery (探索期)**：
   - 第一步：使用檔案搜尋工具尋找與任務標題、描述及標籤相關的目錄與檔案。
   - 第二步：列出可能出錯或需要實作目標功能的 2~4 支核心檔案。
   - 第三步：檢視這些檔案及其相互依賴關係。

2. **Hypothesis (假設與規劃期)**：
   - 根據剛剛找到的檔案與結構，列出你的實作/修復計畫。
   - (例如：「我認為出錯在於 Navbar 元件漏了 `z-index`，我計畫動 `components/Navbar.tsx`」)

3. **Action (執行期)**：
   - 實際修改程式碼。
   - 確保你的修改符合專案原生風格（如同專案根目錄 CLAUDE.md 中所規範）。
   - 修改完畢後，執行基本的檢查（如 build 或 lint，若有可用的指令）。

4. **Wrap-up (收尾期)**：
   - git commit -m "feat/fix: {{TITLE}} [{{TASK_ID}}]"
   - 預期動作：修改完畢後，使用 MCP 工具 `update_task_status` 將狀態改回報為 "In Review" 或 "Done"，並呼叫 `add_task_comment` 寫下修改摘要與影響範圍。
```

---

## AI 協調中間層設計 (AI Coordination Middle Layer / Agent Orchestrator)

您突破盲點了！像 `CCManager` 這類工具，本質上只是「終端機介面的強化版 (Terminal Multiplexer)」，它解決了「多開」與「畫面監控」的問題，但它**沒有大腦，無法具備 Tech Lead 的規劃視野**。

若要達成「吸收 Zentropy 模糊任務、盤點現況、規劃架構策略再下修發包」的目標，我們真正需要的是一個 **語義級的協調中介層 (Semantic Orchestrator)**。

我們稱這個中介層為 **「Zentropy AI Planner (ZAP)」**。

### Zentropy AI Planner (ZAP) 負責的核心職能
ZAP 不只是個腳本，它是一個獨立運行、本身就是一個 AI Agent 或是基於特定 Workflow (如 LangGraph/CrewAI) 打造的「智囊團」服務。它的運作流程如下：

#### 階段 1：吸收與上下文彙整 (Context Gathering)
1. **任務拉取 (Polling)**：ZAP 定時從 Zentropy API 撈取 `Ready for AI` 的新票。
2. **本機代碼掃描 (Codebase Alignment)**：ZAP 收到票後，會透過其配置的 MCP File System 工具，主動掃描您的 codebase。例如，若 Zentropy 任務為「修復登入頁手機版版面」，ZAP 會去撈出 `Auth.tsx` 及 `tailwind.config.js` 等相關檔案的現狀。

#### 階段 2：總體技術規劃 (Architectural Clarification)
3. **產出策略草案 (Tech Spec Generation)**：ZAP 會綜合 Zentropy 的商業需求與本機端的實體程式碼，產出一份《修改策略書 (Strategy.md)》。內容包含：「遇到什麼問題、預計修改哪些函式、潛在的依賴風險」。
4. **防撞車與合併排程 (Conflict Resolution)**：如果 Zentropy 同時指派了 3 張票，ZAP 發現其中兩張都會動到同一個核心 Controller，ZAP 會決定將它們合併成單一 Worktree 處理，或是安排先後順序，避免平行開發的 Git 衝突。

#### 階段 3：人類確認節點 (Human-in-the-Loop)
5. **架構師審批 (Approval Gate)**：ZAP 將規劃好的《修改策略書》透過 Zentropy 的 API 貼到該任務的留言區，或是發送至您的 Slack。此時執行暫停。
6. **對話與釐清**：如果您認為 ZAP 的規劃有誤，您在留言區回覆：「不准動 Auth.tsx，請使用 Middleware 處理。」ZAP 會吸收指示，重新產出策略，直到您按下「Approve」。

#### 階段 4：實體驗發包 (Orchestration & Execution)
7. **建立防護網 (Worktree)**：獲得批准後，ZAP 使用系統指令（如 `child_process.exec`）自動幫這張票建立專屬的 Git Worktree。
8. **賦能工人 Claude 代碼撰寫**：ZAP 啟動背景指令，喚起負責寫 code 的 Claude Code 實體：
   `claude -p "請嚴格遵守這裡所附的《修改策略書 (Strategy.md)》，去完成程式碼修改。"`
9. **(加分項)** 此時，您才可以使用 `CCManager` 等終端管理工具，去監看這些正在埋頭苦幹的「工人 Claude」。

### 實作架構與產品化策略 (Productization Strategy)

您點出了一個至關重要的 **「產品市佔率與使用者體驗 (UX)」** 痛點！
如果為了讓 Zentropy 具備強大協調能力，卻要求一個寫 React 的前端用戶去「安裝 Python、設定 CrewAI 環境、調校 YAML 檔、還要多綁一張信用卡付 CrewAI 的 LLM API 費」，**這會徹底毀掉 Zentropy 的轉化率 (Conversion Rate)！**

做為一個標準的 SaaS 產品，我們必須將所有複雜度封裝起來。針對不同的客群，我們應該採取 **「雙軌並行 (Two-Tier)」** 的產品化策略：

#### 方案一：針對一般開發者 (Zero-Friction 零摩擦原生派發)
- **核心理念**：用戶不需安裝任何額外框架，不需多付任何 API 費用。完全依賴他們原本就有的 `claude` CLI。
- **運作方式**：
  1. 用戶只需配置 Zentropy 的 MCP 伺服器：`claude mcp add zentropy-server`。
  2. Zentropy 將「策劃與停等 (Human-in-the-loop)」的邏輯，**全部寫進 Wrapper Prompt 中**！
  3. 當用戶輸入 `claude -p "幫我接下一張票"`，Claude 拿到包含超級 Prompt 的任務。
  4. prompt 強制規定：*「第一步：掃描專案目錄並輸出 `<tech_spec>`。第二步：在終端機中暫停，詢問開發者『請問是否同意此修改計畫，或有任何需要補充？』。第三步：收到人類同意後，才開始修改程式碼。」*
- **優勢**：只花一次 API 代幣的錢。用戶的終端機就是審批面板。對於一次只解一張票的獨立開發者來說，體驗最流暢完美。

#### 方案二：針對企業團隊 (官方開箱即用 Zentropy Agent CLI)
當企業客戶需要「自動平行派發 10 張票到不同 Worktree」時，單一命令列就不夠用了。但這時我們**不該**丟給他們一套 CrewAI 教學，而是該提供官方封裝的套件：
- **核心理念**：把複雜的「微型協調腳本 (Micro-Orchestrator)、狀態管理、Git Worktree 切割」全部用 TypeScript 寫好，並發布到 NPM 上。
- **運作方式**：
  1. 用戶不需懂設定，只需在終端機輸入一行：`npx @zentropy/agent-cli start`
  2. 此 CLI 會要求用戶登入 Zentropy 帳號。
  3. 接著，這隻官方 CLI 會常駐在終端機背景。當有新票且需要確認時， CLI 會在終端機跳出互動選單 `[y/N/edit]` 讓 Tech Lead 審批。
  4. 審批過後，官方 CLI 在背景默默呼叫系統的 `git worktree add` 以及 `claude -p` 來代工。
- **優勢**：對使用者來說，這就是一個「神奇的官方黑盒子」。免去了自建 CrewAI 或 LangGraph 的地獄，也把安裝成本降到最低。

### 結語
做為軟體服務提供商，**「不要把架構的複雜度轉嫁給終端用戶」** 是最高指導原則。
藉由極致的 Prompt Engineering 搭配原生的 `claude` CLI 體驗 (方案一)，我們就能以最低成本滿足 80% 用戶的 AI PM 需求；而對於需要高度併發作業的企業客戶，提供一鍵安裝的 NPM 官方封裝套件 (方案二)，才是兼顧強大功能與絕佳 DX (Developer Experience) 的唯一解法！

---

## 整合實作里程碑 (Implementation Milestones)

### Phase 1: 概念驗證 (POC - Prompt Engineering)
- **目標**：不改寫系統，先於手動 CLI 測試 Wrapper 的可行性。
- **作法**：在終端機開啟專案目錄，手動賦予上述 Prompt + 任意一假想 Zentropy 任務，確認 Claude Code 是否能乖乖進行探索。
- **預期產出**：收集 Claude Code 實際探勘行為，微調 Wrapper Prompt。

### Phase 2: Zentropy MCP Route 擴充
- **目標**：修改 Zentropy 的 MCP Node。
- **作法**：
  - 更新 `get_task` 或新增 `get_task_for_ai` endpoint。
  - 將資料庫撈出的 `title` 及 `description` 插入 Prompt 模板中。
  - 確保 MCP Server 能正常吐出純文字 Markdown 格式，或是帶有詳細 system instruction 的 JSON。

### Phase 3: 任務屬性強化 (AI Hinting)
- **目標**：提升 Claude Code 在龐大專案中的搜索效率，減少瞎猜 Token 浪費。
- **作法**：Zentropy 新增一個選填的欄位（例如：`AI Entrypoint` 或 `Module Tags`）。讓開票人員能點選這是前端、後端、APP，甚至直接寫上 `src/components/auth`。MCP 回傳 Wrapper 時，一併提供給 Claude Code 作為搜索起點。

### Phase 4: CI/CD 與自動化發包 (Headless Orchestration) 
- **目標**：完全無人值守的開發分配。
- **作法**：搭配 `.github/workflows` 或是 Cronjob，當 Zentropy 有打上 `Agent-Ready` 標記的票，就觸發 Runner，拉一個新 Branch 並下 `claude -p "執行 Zentropy 上的任務..."`，改完後自動發 Pull Request。

---

## 觸發機制與平行開發管理 (Trigger & Parallel Execution)

當擁有多個 Zentropy 任務要同時交由 AI 處理時，若共用同一個專案資料夾將會導致大量的 Git 衝突。為解決此問題，以下為「AI 自動化」與「多重 Branch 平行運作」的最佳實踐：

### 1. 基於本地/地端伺服器的平行化：深度整合 Git Worktrees
**適用場景**：由開發者本機負責啟動多個任務，或是有一台專用的地端 AI 伺服器負責接單。
傳統的 `git checkout -b` 改變目錄狀態會導致 AI 產生嚴重的「Context Bleed（記憶與上下文污染）」。
針對這個痛點，最新版 **Claude Code 結合 Git Worktrees** 是目前開源社群極力推崇的殺手級組合。它允許同一個 Repo 在硬碟上展開成多個實體且平行的資料夾。

- **整合優勢**：每一個 Worktree 目錄下啟動的 Claude Code，都會擁有獨立的歷史對話、快取與環境感知，達到完美的「Session 隔離」。您可以讓 Claude A 在 `worktree-auth` 中重構會員系統，同時讓 Claude B 在 `worktree-ui` 刻劃前端，互不干涉。
- **派發腳本範例 (`zentropy-worktree-dispatcher.sh`)**：
  若 Zentropy 收到多張票，可透過腳本一鍵動態分配：
  ```bash
  #!/bin/bash
  # Zentropy 任務平行派發器
  
  TASK_ID=$1
  TASK_BRANCH="zentropy/task-${TASK_ID}"
  WORKTREE_DIR="../zentropy_workers/${TASK_ID}"
  WRAPPER_PROMPT="請透過 MCP 取得並處理 TASK ${TASK_ID}..."
  
  echo "🚀 建立平行開發環境給 TASK: ${TASK_ID}"
  # 開闢獨立實體資料夾
  git worktree add "${WORKTREE_DIR}" -b "${TASK_BRANCH}"
  
  # 進入工作目錄並在背景獨立喚起專屬的 Claude Code
  (
    cd "${WORKTREE_DIR}" || exit
    echo "🤖 Claude Code 正在 ${WORKTREE_DIR} 中施工..."
    claude -p "${WRAPPER_PROMPT}"
    
    # 任務完成後推播
    git push origin "${TASK_BRANCH}"
    echo "✅ TASK ${TASK_ID} 完工，等待人類 PR 審查！"
  ) &
  ```

### 2. 基於無伺服器架構的自動化 (GitHub Actions)
**適用場景**：完全雲端無人值守的開發分配。
除了本機 Worktree 外，將 Claude Code 與 GitHub Actions 整合也是官方建議的平行做法。當 Zentropy 一次送出 5 張任務票（觸發 Dispatch），GitHub 會平行開啟 5 個獨立的雲端容器（Runners），各自建立 Branch 並執行拉取。這種方法天然具備環境隔離，不會有任何檔案衝突產生。

---

## 預期效益 (Expected Outcomes)
1. **釋放 PM 與資深開發能量**：能放心把繁瑣除錯或小型功能交給 Claude Code。
2. **Context 解耦**：PM 系統依然保持靈活乾淨，將實作細節的推理交還給 Agent 本身的智能。
3. **安全防護網**：透過夾心餅乾提示詞中的 `Context Discovery` 階段，大幅降低 AI "幻覺" 以及把專案大改壞的風險。
