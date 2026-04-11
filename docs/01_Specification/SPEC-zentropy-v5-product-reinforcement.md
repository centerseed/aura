---
type: SPEC
id: SPEC-zentropy-v5-product-reinforcement
status: Draft
ontology_entity: Zentropy
created: 2026-04-10
updated: 2026-04-10
---

# Feature Spec: Zentropy v5.0 Product Reinforcement

> Layering note: 本文件是 Zentropy v5.0 的產品補強稿，聚焦 what / why。ZenOS Core 的 how 與接入契約仍以 `SPEC-zenos-core`、`SPEC-zenos-external-integration`、`SPEC-identity-and-access`、`SPEC-zenos-auth-federation` 為準。
>
> Status note: 本文件保留了 Zentropy 在 `AI context / shared consensus / external AI write-back` 階段的思考脈絡。自 `SPEC-zentropy-v5_1-product-definition` 與 `SPEC-zentropy-dual-graph-architecture` 之後，它不再作為當前對外主心智的 SSOT，而是作為可回收的產品探索背景。

## 背景與動機

`Zentropy Product Definition v5.0` 已把產品方向從「AI 營運長」收斂為「AI 知識行動平台」，並明確採用 `ZenOS as knowledge backend`。

這個方向是對的，但目前仍有三個產品層面的缺口：

1. v5.0 已說明「不只是 todo list」，但尚未具體定義「為什麼接上 ZenOS 後就不再只是 todo list」。
2. 既有 Zentropy 規格仍殘留大量「自帶 core」的語意，容易讓產品邊界重新模糊。
3. 競品比較仍停留在功能表層，尚未把「shared ontology + shared consensus + action feedback loop」這種結構性差異講透。

本文件的目的，是把 v5.0 補強成可拿來指導後續 PM、Architect、Marketing 的產品 SSOT。

更新說明：

- 這份文件當初要解的是「如何避免 Zentropy 退化成 AI todo list」。
- 後續產品方向已再往 consumer 路線收斂為「先解決混亂，再讓重要的東西浮現」。
- 因此本文件中的 team consensus、shared ontology、context-first task 等段落，現階段應視為**可回收能力庫**，而非當前首頁與主體驗的第一層敘事。

## 目標用戶

### 核心 Persona

> 已經在使用 2 個以上 AI 工具工作，但開始感受到「AI 建議彼此不一致、知識無法累積、團隊沒有共享事實」的人。

### 真正的 TA 篩選條件

不是所有忙碌的人都需要 Zentropy。最適合的 TA 必須同時符合以下 4 項中的至少 3 項：

1. 日常工作高度依賴 AI 對話，而不是只把 AI 當搜尋引擎
2. 同時維護 3 個以上平行脈絡（專案、客戶、角色、產品）
3. 已經感受到 context 在不同 AI 工具之間無法延續
4. 曾因決策背景遺失、協作認知落差、AI 建議不一致而出現返工

### Beachhead TA

#### Beachhead A：AI-Native 個體工作者

- **典型樣貌**：創業者、PM、獨立開發者、內容創作者
- **目前工具**：Claude Code、Cursor、ChatGPT、Notion、Todoist
- **當前痛點**：想法全在 AI 對話裡，最後只留下零碎 task 或文件
- **為何最先買單**：問題痛、採用門檻低、單人即可感受到 context accumulation 的價值

#### Beachhead B：2-5 人微型創業團隊

- **典型樣貌**：創辦人 + 設計 + 工程 + 營運
- **目前工具**：各自用不同 AI，靠 Slack / Notion / 線上會議對齊
- **當前痛點**：表面上有共享看板，實際上沒有共享認知
- **為何重要**：這是 Zentropy 最早能把「shared consensus」做出明顯差異的場景

### Secondary TA

#### 多客戶自由工作者

- **典型樣貌**：設計師、顧問、開發者
- **核心問題**：客戶脈絡混線，AI 很容易跨客戶污染
- **產品價值**：每個客戶 Product 都是清楚的 context boundary

#### 多角色斜槓工作者

- **典型樣貌**：正職 + 副業 + 個人品牌
- **核心問題**：角色切換時 AI 沒有身份邊界
- **產品價值**：Area / Product / narrative 幫助 AI 正確站位

### 暫時不是 TA 的人

#### 非 TA 1：只用單一 AI 工具的個人用戶

- 問題不夠痛
- 更可能被一般 note app 或 task app 解決

#### 非 TA 2：還沒把工作搬進 AI 的傳統團隊

- 目前教育成本太高
- 他們先需要的是 AI adoption，不是 consensus layer

#### 非 TA 3：只想要更強排程的人

- Motion / Reclaim / Sunsama 更直接
- Zentropy 的核心不是時間安排，而是 shared context

### 代表性人群

| 類型 | 典型樣貌 | 為什麼需要 Zentropy + ZenOS |
|---|---|---|
| AI-Native 個體工作者 | Claude Code 寫規劃、Cursor 寫程式、ChatGPT 做研究 | 思考過程散落在不同工具，下一次永遠從零開始 |
| 微型創業團隊 | 2-5 人，各自用不同 AI 輔助決策 | 問題不是 task 太多，而是 AI 站在不同事實上工作 |
| 多客戶自由工作者 | 同時服務 3+ 客戶，每個客戶一套 context | AI 經常把 A 客戶的邏輯帶到 B 客戶 |
| 多角色斜槓工作者 | 正職、創作、副業並行 | 不同角色的知識與行動容易混線 |

### Jobs To Be Done

#### Job 1：把 AI 對話變成可累積的工作記憶

- 當我在不同 AI 工具裡討論問題時，
- 我想把真正重要的 reasoning 留下來，
- 這樣下次不需要重新解釋我為什麼做這個決定。

#### Job 2：讓團隊與 AI 基於同一套事實工作

- 當團隊每個人都在用自己的 AI 工具時，
- 我想確保大家取得的是同一份最新 Product narrative，
- 這樣 AI 不會在過期 context 上繼續放大錯誤。

#### Job 3：讓 task 背後的 why 不消失

- 當我要執行某個 task 時，
- 我想知道它為什麼存在、依據什麼知識、會影響什麼，
- 這樣我做的不是孤立待辦，而是正確方向上的行動。

#### Job 4：在方向漂移前被提醒

- 當我看起來很忙、task 也一直在完成時，
- 我想及早知道自己是不是已經偏離 Product 的真正目標，
- 這樣我能在返工前修正方向。

## Spec 相容性

已比對的既有文件：

- `Zentropy Product Definition v5.0`
- `002_Functional_Specification`
- `003_System_Infrastructure_Spec`
- `008_Database_Schema_Spec`
- `009_Librarian_Engine_Spec`
- `SPEC-zenos-core`
- `SPEC-zenos-external-integration`
- `SPEC-identity-and-access`
- `SPEC-zenos-auth-federation`
- `ADR-025-zenos-core-layering`
- `SPEC-zentropy-v5_1-product-definition`
- `SPEC-zentropy-dual-graph-architecture`

衝突與處理：

1. `002/003/008/009` 仍保留大量 Zentropy 自帶 ontology / governance / milestone core 的語意。
   處理：本文件明確收斂為「知識層在 ZenOS、體驗層在 Zentropy」；既有舊文件需在後續版本逐步改寫。
2. `Zentropy Product Definition v5.0` 已寫「知識層 = ZenOS、行動層 = Zentropy UI + DB」，但對「如何不退化成 todo list」描述仍不足。
   處理：本文件補強成具體產品能力與 user story。
3. `SPEC-zenos-external-integration` 已把 milestone 映射到 `Plan`、正式 task 映射到 `Task`。
   處理：本文件採納該前提，不再讓 Zentropy 自定義平行驗收邊界。
4. `SPEC-zentropy-v5_1-product-definition` 已把產品主軸收斂為「讓一切井然有序 / 重要的東西自然會浮現」。
   處理：本文件不再作為主定位 SSOT，而是保留作為未來可回收的進階能力與中後期路線參考。
5. `SPEC-zentropy-dual-graph-architecture` 已定義前台 Flow/Map 與 ZenOS Core 的邊界。
   處理：本文件中涉及直接將 consumer 輸入視為知識層 mutation 的想法，應受 dual-graph 架構約束，不可單獨實施。

## 使用方式

閱讀本文件時，請以以下優先序理解：

1. `SPEC-zentropy-v5_1-product-definition`
   - 當前產品主軸與對外心智
2. `SPEC-zentropy-dual-graph-architecture`
   - 當前資料與知識邊界
3. 本文件
   - 可回收的中後期能力、多人多 AI 情境、shared context / consensus 探索

本文件最適合用於：

- 評估未來是否重新引入 team / consensus 能力
- 從中提取可進入 Map Layer 或 promotion rule 的高階能力
- 作為 Architect 設計中後期 capability roadmap 的背景

## 核心產品主張

### Zentropy 不是 AI Todo List

如果 Zentropy 只是：

- 更好看的 task board
- 更快的 Brain Dump 收件匣
- AI 幫忙分類的待辦清單

那它仍會退化成高級 todo list。

Zentropy 真正的產品定義應是：

> **Zentropy 是讓人和 AI 能基於同一套共享事實持續行動的工作台。**

它的本質不是「管理任務」，而是：

1. 捕獲思考過程
2. 把思考變成共享知識
3. 把知識約束後續行動
4. 把行動結果再回饋成新的知識

這四步形成一個閉環，才是 Zentropy 接上 ZenOS 後的真實產品價值。

### 產品公式

`Zentropy = Capture + Consensus + Execution`

其中：

- `Capture`：把散落在 AI 工具裡的思考過程帶回同一套 ontology
- `Consensus`：讓多人與多 AI 共享同一套最新事實
- `Execution`：讓 task 不只是待辦，而是 knowledge-aware action

## 接上 ZenOS 後，產品價值如何升級

### 1. Task 變成有知識來源的行動節點

一般 todo list 的 task 只有「做什麼」。

接上 ZenOS 後，Zentropy 的 task 應該同時帶有：

- 它屬於哪個 Product / Area
- 它來自哪個 Brain Dump / Entry / Decision
- 它依賴哪些既有知識
- 它影響哪些後續工作
- 這個 task 所處的 context 是否穩定

這讓 task 從「待辦項」升級成「知識圖譜上的可執行節點」。

### 2. Brain Dump 不再只是 inbox，而是 knowledge router

接上 ZenOS 後，Brain Dump 的作用不應只是：

`輸入 -> 建 task`

而應是：

`輸入 -> 判斷 decision / insight / task / conflict -> 路由到知識層與行動層`

這樣用戶在 AI 對話裡產生的高價值內容，才不會被壓扁成一條 task title。

### 3. Librarian 升級為反退化引擎

接上 ZenOS 後，Librarian 最重要的能力不是「整理」，而是：

- 發現 knowledge drift
- 發現 consensus conflict
- 發現 context gap

也就是說，Zentropy 不只是幫你記住做什麼，而是主動提醒你：

- 你最近的行動已經偏離原本 Product 的方向
- 這個 Product 的知識太薄，AI 其實在盲飛
- 團隊成員與不同 AI 正在基於不同版本的事實工作

### 4. 多人協作從共享看板升級為共享事實

大多數協作工具共享的是：

- ticket
- comment
- status

Zentropy + ZenOS 應共享的是：

- Product 的 current narrative
- 已被確認的決策與洞察
- 尚未解決的分歧與衝突

這才是多人多 AI 時代真正的共識層。

## 需求

### P0（必須有）

#### Context-first Task

- **描述**：每個重要 task 都必須能展示其知識來源與影響脈絡，而不是只顯示標題、deadline、status。
- **Acceptance Criteria**：
  - Given 一個由 Brain Dump 或外部 AI 生成的 task, When 使用者打開 task 詳情, Then 系統可顯示其關聯 Product 與至少一條來源 context。
  - Given 一個 task 來自既有 decision / entry, When 使用者檢視 task, Then 系統能標示該來源而非把 task 視為無上下文的孤立項目。

#### Brain Dump Meaning Routing

- **描述**：Brain Dump 必須能區分「可執行工作」與「高價值知識」，避免所有輸入都退化成 todo。
- **Acceptance Criteria**：
  - Given 一段包含明確決策的輸入, When 系統分析 Brain Dump, Then 系統可將其中至少一部分保留為知識層內容，而非只建 task。
  - Given 一段帶有語意衝突的輸入, When 系統無法直接併入既有 ontology, Then 系統會標記待確認而不是靜默覆寫。

#### Product Narrative Surface

- **描述**：每個 Product 應該有一個可以被人與 AI 共同消費的 current narrative，而不是只有 task 列表。
- **Acceptance Criteria**：
  - Given 使用者進入任一 Product, When 該 Product 已有累積知識, Then 系統可顯示該 Product 的 current narrative summary。
  - Given 該 Product 的近期 task 與 narrative 明顯不一致, When Librarian 完成背景分析, Then 系統可顯示 drift warning。

#### Consensus-aware Workspace

- **描述**：Workspace 協作時，系統必須強調共享事實，而非只有共享待辦。
- **Acceptance Criteria**：
  - Given 兩位成員在同一 Workspace 使用不同 AI 工具, When 他們存取同一 Product, Then 系統提供同一份 current narrative 與共識狀態。
  - Given 新輸入與共享 Product 的既有敘事相衝突, When 系統分析完成, Then 系統標示此衝突為待確認事項。

### P1（應該有）

#### Context Gap Detection

- **描述**：系統主動指出哪些 Product 的 task 很多，但知識太薄，屬於 AI 高風險區。
- **Acceptance Criteria**：
  - Given 某 Product 有多個活躍 task 但缺少決策/洞察沉澱, When 使用者檢視 Product 健康度, Then 系統標示為 context gap。

#### Why / Impact View In Task Panorama

- **描述**：任務全景圖不只顯示 deadline 與 status，也要顯示 why / impact 視角。
- **Acceptance Criteria**：
  - Given 使用者切換到 task panorama, When task 已綁定來源與影響資訊, Then 至少可用一種視圖按來源脈絡或影響範圍篩選 task。

#### External AI Write-back

- **描述**：外部 AI 工具不只讀 context，也能把關鍵結果寫回 Zentropy。
- **Acceptance Criteria**：
  - Given 使用者在外部 AI 完成一段重要決策討論, When 觸發 write-back, Then 該內容可被寫回對應 Product 的知識與行動脈絡。

### P2（可以有）

#### Consensus Review Flow

- **描述**：針對多人或多 AI 的衝突敘事，提供專門的 review flow。
- **Acceptance Criteria**：
  - Given 同一 Product 有兩條互相矛盾的方向性輸入, When 系統偵測到衝突, Then 使用者可在一個明確的 surface 中做確認或合併決策。

#### AI Evidence Trail

- **描述**：AI 的建議需附帶其依據的 Product narrative / decision / entry。
- **Acceptance Criteria**：
  - Given AI 生成一個具體建議, When 使用者查看建議來源, Then 系統能顯示它依據的是哪些知識節點，而非黑盒輸出。

## 更多 User Stories

### Story 1：AI-Native 開發者不再失去思考過程

- Barry 在 Claude Code 裡討論了一小時產品方向，最後只在 task app 裡留下「重構 onboarding」。
- 一週後，他已經忘了當初為什麼要重構、取捨了哪些方案。
- 使用 Zentropy + ZenOS 後，Claude 對話裡的關鍵 decision 與 insight 可回寫到對應 Product。
- 後續任何 AI 再碰到這個 Product，都能基於當時的 reasoning 工作，而不是重新猜。

### Story 2：小團隊避免「彼此都很忙，但方向已經分裂」

- 創辦人用 Claude 討論商業模式，設計師用 ChatGPT 思考 landing page，工程師用 Cursor 做實作拆解。
- 三個人各自都很有效率，但 AI 站在三套不同 context 上。
- 使用 Zentropy + ZenOS 後，團隊共享同一個 Product narrative。
- 當任一人的新 Brain Dump 與 current narrative 衝突，系統先標記分歧，再要求確認。

### Story 3：自由工作者不再把客戶 context 搞混

- 設計師同時服務三個客戶，平常用同一套 AI 工具工作。
- AI 很容易把 A 客戶的風格偏好帶到 B 客戶。
- 使用 Zentropy + ZenOS 後，每個客戶 Product 都有自己的知識邊界與 narrative。
- AI 讀取 context 時先進入正確 Product，因此輸出不再跨客戶污染。

### Story 4：用戶知道自己不是「沒做完」，而是「正在做錯方向」

- 使用者最近一週完成很多 task，但 Product 的主要目標其實沒有前進。
- 一般 todo 工具只會說完成率很高。
- Zentropy + ZenOS 會指出：行動與 Product narrative 發生 drift。
- 這讓用戶得到的是方向修正，而不是假性的效率滿足感。

### Story 5：外部 AI 成為共享共識層的讀寫客戶端

- 使用者主要工作仍在 Claude Code、Cursor、ChatGPT。
- Zentropy 不要求用戶放棄既有工具，而是成為 shared context layer。
- 外部 AI 讀 context，完成工作後再把結果寫回 Zentropy / ZenOS。
- Zentropy 因此不是另一個工作入口，而是所有 AI 工作入口背後的共享記憶層。

## User Story Matrix

### TA A：AI-Native 個體工作者

#### Story A1：跨工具持續接續思考

- **情境**：白天在 Claude Code 做產品拆解，晚上在 ChatGPT 做市場分析
- **現況痛點**：兩邊 AI 不知道彼此已經發生過什麼
- **理想結果**：第二個 AI 讀到第一個 AI 的關鍵 reasoning，不需重述背景

#### Story A2：從對話直接生成可追溯的工作

- **情境**：與 AI 討論後決定做一個 onboarding 改版
- **現況痛點**：最後只留下「改 onboarding」，why 消失
- **理想結果**：task 自帶 decision source、相關 Product narrative、後續 impact

#### Story A3：被提醒自己正在忙錯方向

- **情境**：一週完成十幾個 task
- **現況痛點**：產出很多，但核心 Product 沒變清楚
- **理想結果**：系統指出這些 task 與 Product narrative drift

### TA B：2-5 人微型創業團隊

#### Story B1：創辦人與工程師不再各自和 AI 說不同版本的故事

- **情境**：創辦人改了產品方向，但工程師的 AI 還在舊脈絡上拆 task
- **現況痛點**：返工不是因為執行差，而是因為 context 沒同步
- **理想結果**：新 decision 進入共享 ontology 後，後續 AI 都基於同一版本工作

#### Story B2：設計、產品、工程對同一 Product 有同一份 current narrative

- **情境**：三個角色都在推同一個 Product
- **現況痛點**：每個人心中的「現在最重要的是什麼」不同
- **理想結果**：每個人進入 Product 時先看到同一份 narrative，而不是先看到各自的 task list

#### Story B3：衝突不是事後發現，而是事前浮現

- **情境**：設計稿走向與工程實作方向開始背離
- **現況痛點**：通常到 review 才發現彼此不是在做同一件事
- **理想結果**：系統先把這種 divergence 標為 consensus conflict

### TA C：多客戶自由工作者

#### Story C1：AI 不再跨客戶串 context

- **情境**：早上服務 A 客戶，下午切到 B 客戶
- **現況痛點**：AI 會把 A 的品牌語氣和產品假設帶到 B
- **理想結果**：每個客戶 Product 是獨立知識邊界，AI 只能讀該邊界的 narrative

#### Story C2：每個客戶的決策背景都能被追溯

- **情境**：客戶兩週後質疑某個方向為何這樣選
- **現況痛點**：只找得到 task，找不到當時決策背景
- **理想結果**：能追到當時的 Brain Dump、decision 和後續行動

### TA D：多角色斜槓工作者

#### Story D1：正職與副業的 AI 脈絡不再互相污染

- **情境**：中午處理公司需求，晚上處理自己的內容產品
- **現況痛點**：AI 給建議時常混入錯的身份視角
- **理想結果**：Area 成為 AI 的身份邊界，讓建議更貼近當前角色

#### Story D2：同一個人也需要和自己的不同角色維持共識

- **情境**：副業的長期目標與正職的短期壓力互相拉扯
- **現況痛點**：不是沒有 task，而是不知道哪個 narrative 該優先
- **理想結果**：Zentropy 幫他看見不同 Area / Product 的競爭與衝突

## Aha Moments

### Aha 1：AI 真的記得我為什麼這樣做

用戶第一次感受到：

- 上週在另一個 AI 工具裡做出的決策
- 今天這個 AI 真的知道
- 而且不是靠手動複製貼上

這是 Zentropy 與一般 AI 筆記工具的第一個分水嶺。

### Aha 2：我不是沒效率，我是 context 已經漂掉

用戶第一次看到：

- task 完成很多
- 但系統指出 Product drift

這一刻 Zentropy 從 productivity tool 升級為 decision tool。

### Aha 3：團隊共享的不是看板，而是同一套事實

團隊第一次發現：

- 不同 AI 工具給出的建議開始一致
- 不是因為 prompt 更厲害
- 而是因為它們讀到了同一套 ontology

這是最強的團隊級價值證據。

## 市場切入假設

### Phase 1：先賣「不再重講背景」

最先能打動早期用戶的價值，不是 ontology，也不是 consensus。
而是非常直接的：

> 我不用再把同一段背景跟不同 AI 重講 5 次。

這是最容易被感知的個人價值。

### Phase 2：再賣「團隊 AI 不再各說各話」

當個人價值被證明後，再往上打團隊：

> 我們不是多了一個任務工具，而是終於有一套共享事實讓 AI 對齊。

這是團隊版的核心賣點。

### Phase 3：最後賣「AI Consensus Layer」

當產品有足夠案例後，才把品類名稱往上升：

> Zentropy 是 AI workflows 的 shared context and consensus layer。

這是市場教育層，而不是最早期 landing page 的主訊息。

## 與競品差異，接上 ZenOS 後放大的地方

### 與傳統任務工具的差異

Notion、ClickUp、Todoist 的核心是：

- 記錄工作
- 管理欄位
- 顯示狀態

Zentropy + ZenOS 的核心是：

- 累積思考
- 維持共識
- 讓行動受知識約束

差異不在「AI 幫忙分類」，而在「AI 與人共同站在同一套 evolving ontology 上行動」。

### 與 Motion / Reclaim / Sunsama 的差異

這類產品主要解的是：

- 時間怎麼排
- 今日先做什麼

Zentropy + ZenOS 解的是更上游的問題：

- 哪些事其實屬於同一個 Product narrative
- 哪些任務看似忙碌，實則正在製造 drift
- 多個 AI 是否站在同一套事實上給建議

也就是說，排程工具優化的是 `time allocation`，而 Zentropy 優化的是 `context alignment`。

### 與知識工具的差異

Tana、Heptabase、Notion AI 等知識工具的核心強項是：

- 個人整理
- 視覺化整理
- 知識可視化

但它們多半停在：

- knowledge representation

Zentropy + ZenOS 要往前一步做到：

- knowledge-to-action routing
- action-to-knowledge feedback
- team consensus maintenance

### 與 AI + Obsidian 的差異

`AI + Obsidian` 會是 Zentropy 最常被拿來比較的替代方案，因為兩者都看起來像：

- 把 AI 對話留下來
- 讓知識可被整理與搜尋
- 讓使用者下次不必完全從零開始

如果 Zentropy 只做到這一層，它會被市場理解成「更產品化的 AI 筆記系統」，難以建立真正的新類別。

因此，Zentropy 的差異不能建立在「知識管理更好」，而必須建立在以下三點：

1. **ongoing work，而不是 static notes**
   - Obsidian 的主體是筆記與文件
   - Zentropy 的主體應是「正在推進的 Product 與其背後的脈絡」
2. **context-to-action**
   - Zentropy 的知識不是只拿來存與找，而是直接約束後續 task 與下一步行動
3. **shared live state**
   - Obsidian 偏個人知識庫
   - Zentropy 要處理的是多人與多 AI 共用同一份 evolving reality

一句話差異：

> Obsidian 幫用戶保存想法。  
> Zentropy 幫用戶在做事時帶著正確背景前進。

因此，Zentropy 對外不應主打「第二大腦」或「AI 筆記」，而應主打：

- AI 工作不中斷
- 背景不失憶
- task 不脫離 why
- 團隊不各說各話

### 與通用 AI Agent 框架的差異

OpenAI/Cursor/Claude 類工具是強 agent，不是強 shared state。

它們的問題不是不聰明，而是：

- 它們沒有持久、共享、可治理的工作記憶層

Zentropy + ZenOS 的價值，是提供這個 agent 之上的 shared state runtime。

## 市場尚未充分發現的潛力

### 1. 「AI 共識層」會是新軟體類別

目前市場大多還把問題切成：

- 任務管理
- 知識管理
- AI 助手

但多人多 AI 的真實問題，是這三者之間缺少共享狀態。

Zentropy + ZenOS 的潛力，是定義出一個新類別：

> **AI Consensus Layer**

它不是 PM tool，不是 note app，也不是 chatbot，而是讓所有 AI 與人共享同一套現實模型的底層。

### 2. 從個人生產力切入，向團隊治理升級

多數工具先做團隊，再往下切個人。
Zentropy 反過來：

- 先從個人的 AI context accumulation 切入
- 再長成多人 shared consensus

這樣的好處是：

- 初始 adoption 成本低
- 一旦進入多人協作，切換成本和資料飛輪會很強

### 3. 對外 AI 工具生態的中立層

市場還在用「哪個模型最強」思考 AI 工具。
但長期更稀缺的是：

- 模型可以替換
- context layer 不能常換

Zentropy + ZenOS 的潛力，在於成為：

> 不綁單一模型、單一 IDE、單一 AI 廠牌的共享 context substrate

### 4. 從工作管理走向 decision infrastructure

一旦 Product narrative、entry、task、feedback 都進入同一個 ontology，
Zentropy 的長期潛力就不只是管理執行，而是管理：

- 決策如何形成
- 決策如何傳播
- 決策何時開始失效

這會比 todo / project management 類別更深，因為它開始觸及「公司如何維持一致判斷」。

## 對現有用戶的遷移原則

### 核心原則：不替換舊習慣，只在舊習慣上疊加價值

現有 Zentropy 用戶已經熟悉的入口主要是：

- Brain Dump
- Task 清單
- 基本整理與回顧

如果 v5.0 之後的產品要求使用者先理解：

- ontology
- governance
- consensus
- L1/L2/L3
- MCP / federation

才能正常使用，那等於實際上重新做了一個新產品，會直接破壞既有習慣。

因此 v5.0 之後的升級必須遵守：

1. **入口不變**
   - 還是可以直接 Brain Dump
   - 還是可以直接看 task
   - 還是可以不理解 ZenOS 就完成日常操作
2. **新能力先隱藏在原流程裡**
   - task 多出來源 context
   - Product 多出 current summary
   - Brain Dump 多出 related context
   - 衝突時才提示 needs review
3. **重概念晚一點才顯性化**
   - workspace 共識
   - 外部 AI write-back
   - drift detection
   - consensus review
   這些應該在進階使用者或團隊場景才逐步露出

### 不應發生的遷移方式

- 不應要求所有現有用戶重新整理既有資料到新 ontology 結構後才能繼續使用
- 不應把 Brain Dump 直接改成多步治理流程
- 不應讓 task surface 因新概念而變得更難讀
- 不應把 ZenOS 的治理術語直接暴露成消費產品的主心智

### 應優先出現的升級感

現有用戶第一次感受到 v5.0 強化版時，應該覺得：

- 這還是我熟悉的 Zentropy
- 但它現在更懂我剛剛為什麼要做這件事
- 它不再只是記 task，而是真的記住脈絡

也就是：

> 熟悉的入口，明顯更聰明的結果。

### 分階段 rollout 建議

#### Phase 1：零心智切換

只增加：

- task 來源 context
- Product summary
- Brain Dump 關聯建議

不增加：

- 新術語
- 新流程
- 新操作負擔

#### Phase 2：進階 context 能力

只對進階用戶或付費用戶開：

- external AI write-back
- drift hint
- context gap warning

#### Phase 3：團隊 consensus 能力

只在團隊或 Workspace 場景打開：

- shared narrative
- conflict review
- consensus-aware collaboration

## Migration Spec

### 目標

讓現有 Zentropy 用戶在不改變原本核心使用習慣的前提下，逐步獲得：

- task 的來源脈絡
- Product 的 current narrative
- 跨 AI 的 context continuity
- 更高階的 drift / conflict / context-gap 能力

### 遷移原則

#### Principle 1：舊資料先可用，再逐步變聰明

舊有 task / product 不應因為缺少新欄位就失效。

做法：

- 沒有來源 context 的舊 task 仍可正常顯示與操作
- 沒有 narrative 的 Product 先顯示空狀態或輕提示
- 系統在背景逐步補齊 summary / linkage，而不是要求用戶手動重建

#### Principle 2：新欄位是 additive，不是 breaking

新增能力應優先採用附加欄位與附加 surface，而不是重寫舊資料語意。

範例：

- task 新增 `source_context`、`related_entry_ids`、`why_summary`
- Product 新增 `current_narrative`
- Brain Dump 結果新增 `routing_type` 與 `related_context`

而不是：

- 直接廢除舊 task model
- 要求所有 task 都先轉成新 ontology object 才能使用

#### Principle 3：用戶只在有價值時才看見遷移結果

遷移產物不應先以「資料修復」呈現給使用者，而應以「更懂你」的產品收益呈現。

例如：

- 不是顯示「已完成 narrative backfill」
- 而是顯示「這個 task 來自你上週的產品討論」

### 遷移對象

#### A. 舊 Task

現況：

- 只有 title / status / deadline / product 等執行欄位
- 缺少 why / source / impact

遷移方向：

- 補 `why_summary`
- 補 `source_context`
- 若可推斷，補 `related_entry_ids`

Backfill 策略：

1. 先用 rule-based 與歷史 Product 關聯補最基本 context
2. 只對活躍 task 做 AI 補強
3. 已封存 task 不做高成本補強

#### B. 舊 Product

現況：

- 可能只有名稱、描述、task 列表
- 沒有 current narrative

遷移方向：

- 建立 `current_narrative`
- 補 `context_health`
- 補 `recent_decisions` 概覽

Backfill 策略：

1. 先針對高活躍 Product 生成 narrative
2. 長尾 Product 保持空白，直到再次活躍或被用戶打開

#### C. 舊 Brain Dump

現況：

- 可能只留下 task 結果
- 缺少「輸入原文 -> 知識 / 行動」的路由紀錄

遷移方向：

- 新輸入開始保存 raw input 與 routing 結果
- 舊輸入不強制回補完整 routing
- 只在能高信心推斷時補上來源摘要

### 資料遷移分期

#### Migration Phase M0：相容層

目標：

- 新版前端 / 後端能讀取舊資料
- 新欄位全部視為 optional

Done Criteria：

- 舊 task / Product 不需 migration 即可正常顯示
- 新版 UI 對缺欄位有合理 fallback

#### Migration Phase M1：低成本補強

目標：

- 用 rule-based 與 cached summary 幫活躍資料補最基本 context

包含：

- task 對 Product 的來源補充
- Product summary 初版
- Brain Dump related context 建議

Done Criteria：

- 活躍 Product 至少有一份可讀 summary
- 活躍 task 至少能顯示一條來源脈絡或 fallback why

#### Migration Phase M2：高價值 AI Backfill

目標：

- 只對高價值資料做 AI 補強

優先順序：

1. 近 30 天活躍 Product
2. 近 14 天活躍 task
3. 付費用戶的主要 Product

Done Criteria：

- 付費或高活躍用戶能感受到 task / Product context 顯著變好

#### Migration Phase M3：進階 signals

目標：

- 在資料基礎穩定後，才開始顯示 drift / context gap / conflict

Done Criteria：

- 系統不會在 context 還很薄時過早輸出高風險判斷

### 成本保護原則

遷移不能採用「全量 AI 重算」。

必須遵守：

1. 只處理活躍資料
2. 只在用戶打開、Brain Dump、新寫回、或夜間 batch 時處理
3. 長尾冷資料保持 lazy migration
4. 高成本 analysis 僅對付費或團隊層級開啟

### 使用者感知設計

遷移期間，產品文案應避免讓用戶覺得自己被迫學一個新系統。

應優先使用的語言：

- 「補上背景」
- 「找到相關脈絡」
- 「這件事為什麼存在」
- 「和你之前的決策有關」

不應優先使用的語言：

- ontology migration
- governance backfill
- consensus protocol

### Migration User Stories

#### Story M1：老用戶打開舊 task，系統補上 why

- **情境**：老用戶點開三週前建立的 task
- **預期**：即使當時沒有新欄位，現在也能看到最低限度的來源 Product 與 why_summary

#### Story M2：老用戶不需要重新整理資料也能繼續用

- **情境**：老用戶升級到新版
- **預期**：原本的 Brain Dump、task list、Product view 全都可照舊使用，不會被要求先做 migration wizard

#### Story M3：老用戶第一次感受到「產品變聰明了」

- **情境**：老用戶在新版做 Brain Dump
- **預期**：系統自動帶出 related context，讓他感覺是熟悉產品變強，不是產品被換掉

#### Story M4：只有高價值資料被做重補強

- **情境**：用戶有大量歷史資料
- **預期**：系統優先補強最近活躍與高價值資料，不會因全量重算造成成本失控

## 重新收斂後的對外產品訊息

### 不建議的主訊息

- AI 知識圖譜
- ontology 工作台
- 個人版 ZenOS
- 主動治理平台

這些都太重，也容易讓產品與 ZenOS 願景重疊。

### 建議的主訊息

> **把 AI 工作的背景留住，讓你下一次不用從零開始。**

對團隊版可延伸為：

> **讓你和團隊的 AI，都基於同一套最新背景工作。**

這樣的好處：

- 比 todo list 強
- 比 ontology 容易懂
- 不直接撞 Obsidian 的知識管理心智
- 不會讓現有用戶覺得產品突然變成另一種東西

## 明確不包含

- 不把 Zentropy 重新做成另一套獨立 ontology engine
- 不在 Zentropy 內部複製 ZenOS 的 confirm / authorization runtime
- 不把競品差異化理解成更多 task 欄位、更多看板、更多排程技巧
- 不要求使用者放棄現有 AI 工具，只使用 Zentropy 作為唯一入口
- 不把 Zentropy 對外包裝成 consumer ZenOS 或重量級治理平台
- 不以破壞現有用戶使用習慣的方式推出新架構

## 技術約束（給 Architect 參考）

- Zentropy 的正式協作與驗收邊界需對齊 ZenOS `Task` / `Plan` 契約
- Workspace / visibility / delegated credential 不可由 Zentropy 自行定義平行規則
- App-specific subtask、daily execution step、milestone UX 可留在 Zentropy，但不得與 Core Task 驗收邊界衝突
- Brain Dump 路由若同時生成知識與行動，需保持兩者之間的 linkage 可追溯

## 開放問題

- `Area / Product / Task` 的簡化三層語言，是否需要在產品敘事上完全對齊 ZenOS 的 L1/L2/L3 用語？
- Zentropy 行動層是否長期仍保留自己的 `Milestone` 物件，或最終全面映射為 ZenOS `Plan` 的 app-facing view？
- Librarian 的 drift / conflict / context-gap 三種提醒，第一階段哪一個最值得先做成 aha moment？
- MCP 開放接入應先強化「讀 context」還是「寫回結果」，哪一個對早期用戶更有感？
- 對外 messaging 應該長期停留在「背景不失憶」，還是逐步升級到「AI consensus layer」？
- 現有用戶資料是否需要 migration layer，讓舊 task / product 也能逐步補上來源 context 與 narrative？
