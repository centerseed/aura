---
type: SPEC
id: SPEC-zentropy-dual-graph-architecture
status: Draft
ontology_entity: Zentropy
created: 2026-04-10
updated: 2026-04-11
---

# Feature Spec: Zentropy Dual-Graph Architecture

> 本文件定義 Zentropy 新方向下的資料與知識架構：哪些資料留在 Zentropy 前台圖譜，哪些資料升格到 ZenOS Core，promotion 規則是什麼，以及既有 spec 應如何收斂。

## 1. 背景與問題

Zentropy 的新產品主軸已收斂為：

- 第一層：`讓一切井然有序`
- 第二層：`當一切開始有序，重要的東西自然會浮現`

這代表資料架構不能再沿用「所有東西都直接進任務系統」或「所有東西都直接進 ontology」的思路。

目前的技術風險在於：

1. Brain Dump 現況主要是 `自然語言 -> task`，分類空間太窄
2. Librarian 現況是重治理、重演進、重敘事壓縮，不適合作為 consumer 前台的即時主路徑
3. 若直接把所有前台輸入寫進 ZenOS Core，會造成：
   - mutation 太重
   - 小模型錯分污染 canonical knowledge
   - UX 變慢
   - consumer 噪音污染 Core
4. 若完全不使用 ZenOS Core，則會：
   - 重做一套 graph / governance / access / evolution runtime
   - 長期與 ZenOS 平台層分叉

因此 Zentropy 必須採用雙層圖譜架構，而不是單層圖譜架構。

## 2. 核心原則

### 2.1 第一性原則

知識圖譜不是拿來存所有資料，而是拿來承載：

1. **可壓縮**：能把大量事件壓縮成較少的穩定結構
2. **可持久**：不會因為一天內的操作完成就失效
3. **可推理**：值得成為 AI 長期回饋與治理的基礎

不符合這三項的資料，不應進入圖譜核心。

### 2.2 雙層結論

因此，Zentropy 應採用：

- `Flow Layer`：前台操作層，處理輸入、整理、當前秩序
- `Map Layer`：前台個人意義圖譜，處理長期脈絡、重心、模式
- `ZenOS Core Layer`：平台層穩定知識與治理 runtime

其中：

- Flow Layer 和 Map Layer 屬於 Zentropy application 自己的資料與 view model
- ZenOS Core Layer 只接收高信心、慢變、值得治理的知識

## 3. 邊界表：Zentropy Graph vs ZenOS Core

| 面向 | Zentropy Graph | ZenOS Core |
|---|---|---|
| 角色 | 前台個人圖譜 / 個人意義地圖 | 後台穩定知識層 / 治理層 |
| 主要用途 | 讓輸入立刻有秩序、逐步形成個人地圖、產生貼近使用者的回饋 | 承接值得長期保留與治理的 knowledge / action / access contract |
| 變動頻率 | 高，可重算，可合併，可撤回 | 低，慢變，應盡量穩定 |
| 信心要求 | 可接受低到中信心 | 必須中高到高信心 |
| 容忍模糊度 | 高，可容忍暫態 cluster、未定義主題、模糊關聯 | 低，不應容忍大量未定義與低信心節點 |
| UX 責任 | 立即整理、頭緒、重心、個人回饋 | 不直接承擔 consumer 級即時 UX |
| 治理模式 | silent governance + soft suggestions | formal governance + access / confirm / analyze |
| 主要對象 | 單一 end user 的日常輸入與長期脈絡 | 跨 app、跨 workspace、需正式授權與治理的穩定知識 |
| 典型資料 | note、idea、reference、reflection、temporary theme、wealth overlay、attention map | entity、relationship、entry、document、task、plan、visibility、workspace |
| 資料生命週期 | 可短期、可中期、可觀察後淘汰 | 應長期、可持續、值得維護 |
| 對小模型要求 | routing、linking、light clustering、light summarization | 不應依賴小模型做高風險 mutation 決策 |

## 4. 節點分類：哪些留在 Zentropy，哪些升格到 ZenOS

### 4.1 永遠留在 Zentropy Graph 的資料

以下資料預設不進 ZenOS Core，只在 Zentropy 前台圖譜存在：

- raw capture
- 單次想法
- 單次書摘
- 單次心得
- 單次情緒片段
- 臨時 reference
- 暫態 cluster
- attention / energy / wealth overlays
- 低信心的 pattern hypothesis
- UI 用 current focus / related items / thread state
- subtask / checklist items

原因：

- 壽命短
- 噪音高
- 高度個人化
- 不值得直接治理

### 4.2 預設留在 Zentropy，但可候選 promotion 的資料

以下資料先存在 Zentropy Graph，符合條件後可升格為 ZenOS candidate：

- recurring theme
- 長期 thread
- 穩定 topic cluster
- 持續中的 project / domain
- 高頻出現的 reflection pattern
- 高置信度的 value / wealth mapping 結果
- 高價值 reference bundle
- 長期 narrative summary

### 4.3 直接屬於 ZenOS Core 的資料

以下資料直接屬於 ZenOS Core contract，不應在 Zentropy 另建平行 canonical model：

- workspace / active workspace
- identity link / federation principal
- visibility / authorization
- 正式 entity
- 正式 entries
- document entity
- 正式 task / plan
- confirm / analyze / governance runtime

## 5. Promotion 規則：什麼時候從 Zentropy 升格到 ZenOS

### 5.1 基本原則

promotion 不是「資料有了就升格」，而是「結構成熟了才升格」。

滿足以下條件中的多項，才可候選 promotion：

1. **重複出現**：跨多次輸入、多天、多週出現
2. **跨來源支持**：不只來自單一 capture，也得到 task / note / reference / reflection 等多種輸入支持
3. **語意穩定**：不是一次性波動，不會今天叫 A、明天叫 B
4. **對後續有推理價值**：成為 AI 或治理系統之後仍有用
5. **值得長期保留**：不是完成即失效的短命資訊
6. **信心足夠**：confidence 達到 promotion 門檻

### 5.2 不可 promotion 的資料

以下資料不應 promotion：

- 單次 subtask
- 單次 reminder
- 低信心情緒片段
- 沒有跨時間穩定性的靈感
- 單次 AI 建議
- 只服務當下 UI 的臨時關聯

### 5.3 可 promotion 的典型例子

#### Case A：長期主題升格為 entity

若使用者在數週內反覆記錄與「創作 / 寫作」相關的：

- idea
- reflection
- task
- reference

且語意中心穩定，則可候選升格為 ZenOS entity 或 entry-linked topic。

#### Case B：高價值脈絡升格為 document / entry

若某段長期敘事已被多次 summary、反覆引用、並成為後續行動的重要 context，則可候選：

- 寫成 document
- 或寫成 entry

#### Case C：正式協作工作升格為 task / plan

若某個前台 ongoing thread 已進入：

- 跨人協作
- 需驗收
- 需責任落點
- 需長期保留結果

則應映射到 ZenOS Core 的 task / plan，而非繼續只留在 Zentropy graph。

## 6. 技術設計：雙層圖譜架構

### 6.1 Layer A：Flow Layer

責任：

- 接住所有輸入
- 讓事情立刻比較有頭緒
- 支撐 `讓一切井然有序`

輸入類型：

- task-like
- idea-like
- note-like
- reference-like
- reflection-like

對使用者暴露三個主入口：

- `Task Input`（任務：要做的事）
- `Idea Input`（想法/心得：要記的）
- `Discussion Input`（討論：要想清楚的）

更細的 note / reference / reflection 差異，先由系統在後台做輕量細分，不要求使用者一開始判斷。

技術原則：

- 原文保留
- 最小結構化
- 小模型只做低風險 routing
- 同步路徑只做可逆與低成本操作

Flow Layer 的輸出：

- current focus
- related items
- temporary thread
- suggested next step
- UI 可見整理結果

### 6.1.1 Task Input Flow

任務流的目標是：

- 讓輸入後的事情立刻可執行
- 服務 `讓一切井然有序`

資料流如下：

1. 保留 `raw_input`
2. 最小正規化（typo / 條列 / checklist）
3. 用既有兩段式檢索判斷：
   - append to existing task
   - create new task
4. 掛到 Flow Layer 的 current thread / current focus
5. 回傳使用者可立即消費的結果

任務流預設寫入：

- raw capture store
- task / checklist / current focus store

任務流預設不直接寫入：

- Zentropy Map Layer 穩定節點
- ZenOS Core mutation

只有當任務進入正式協作、驗收、責任落點時，才映射到 ZenOS Task / Plan。

### 6.1.2 Idea Input Flow

想法流的目標是：

- 讓輸入後的內容先被保留
- 讓使用者知道它有被接住
- 逐步形成個人地圖素材

資料流如下：

1. 保留 `raw_input`
2. 產生輕量摘要
3. 產生輕標籤（見下節）
4. 連到：
   - life area
   - temporary theme / thread
   - related ideas / related context
5. 寫入 Map Layer 候選資料

想法流預設寫入：

- raw capture store
- idea / reflection / reference store
- temporary thread / related cluster

想法流預設不直接寫入：

- ZenOS Core
- 正式 ontology entity

想法流的成功標準不是「立刻任務化」，而是：

- 有被接住
- 找得回來
- 開始累積脈絡

### 6.1.3 Discussion Input Flow

討論流的目標是：

- 讓使用者把模糊的念頭想清楚
- 讓 AI 站在使用者的個人地圖脈絡上進行對話
- 讓討論過程產生的知識自動回饋到 Map Layer

資料流如下：

1. 使用者輸入一個問題或模糊念頭
2. 系統從 Map Layer 拉出相關脈絡（相關想法、近期主題、能量訊號）
3. AI 根據問題類型自動選擇思考框架（5W1H / Pre-mortem / 機會成本 / 冰山模型等），用戶不看到框架名
4. 對話過程中，系統即時識別有價值的知識片段：
   - 新想法 → idea store
   - 決定 → 可轉為 task
   - 價值觀釐清 → Map Layer 核心錨點
   - 模式發現 → Map Layer pattern candidate
5. 討論結束時產生摘要，寫入 Map Layer

討論流預設寫入：

- raw conversation store
- 討論摘要 → Map Layer candidate
- 識別出的想法 → idea store
- 識別出的決定 → task store（需用戶確認）

討論流預設不直接寫入：

- ZenOS Core（討論產出需經 Map Layer 成熟後才可 promotion）

討論流的成功標準：

- 模糊的念頭被結構化了
- 地圖因為這次討論長出新區域（用戶打開地圖就看得到）
- 有價值的決定或想法不會隨對話消失

#### 討論流的特殊性

討論是最高品質的輸入來源：

- 普通輸入：一次一個節點
- 完成反思：節點有了能量色彩
- 討論：一次長出一整片區域 + 連結 + 核心錨點

這意味著討論對 Map Layer 的寫入量和複雜度都高於其他兩種流。
背景 job 應在討論結束後觸發一輪 Map Layer 聚合，而不是等常規排程。

### 6.1.4 Idea Flow 的輕標籤規則

想法流需要治理，但只能是輕治理。

這裡的標籤角色要明確重新定義：

> 它不是 canonical taxonomy，而是暫時的語意錨點。

也就是說，第一版標籤的主要功能是：

1. 告訴使用者這則想法沒有消失
2. 讓系統之後能再找到它
3. 先把它掛到某個 area / thread / theme 上

它不負責：

- 一次決定最終 ontology 位置
- 一次做不可逆的人生分類
- 一次產生正式治理結論

第一版 user-facing 輕標籤只包含：

1. `Area`
   - 工作
   - 生活
   - 學習
   - 關係
   - 健康
   - 創作

2. `Type`
   - 想法
   - 心得
   - 觀察
   - reference

3. `Thread / Theme`
   - 當前最相近的暫態主題或 ongoing thread

設計原則：

- 標籤的目的，是讓用戶感受到「這則想法有被保留」
- 標籤不是 canonical ontology 定位
- 標籤必須可變、可重算、可被後續聚合覆蓋
- 標籤應偏向體感回饋，而不是治理語言

更精確地說，想法流的治理應拆成三層：

#### Level 1：即時輕標籤

輸入後立刻產生，幾乎一定要有。

輸出範圍只包含：

- 屬於哪個 `Area`
- 更像哪個 `Type`
- 目前暫時掛在哪個 `Thread / Theme`
- 和哪些既有內容相近

這一層主要是 user-facing，用途是讓使用者感受到：

- 這則輸入有被接住
- 它已經被先掛上某個脈絡

#### Level 2：背景聚合

由背景 job 非同步進行，不要求每次輸入都立刻完整顯示。

可包含：

- similar idea clustering
- recurring theme detection
- related thread suggestion
- preliminary value / wealth mapping

這一層主要服務系統推理與後續整理，不應直接以沉重治理語言暴露給使用者。

#### Level 3：成熟後 promotion

只有當某個想法或 cluster 反覆出現、足夠穩定時，才可升格為：

- stable theme
- enduring pursuit
- stable pattern
- ZenOS candidate

promotion 前提是：

- 有跨時間持續性
- 不只是一次性輸入
- 能被壓縮成較穩定結構
- 值得進一步治理

也就是說，Level 1 的輕標籤不等於 Level 3 的正式節點。

不應第一版就直接套用：

- 人格分類
- 深度價值觀結論
- 不可逆的穩定 graph mutation

### 6.1.5 灰區輸入處理規則

第一版雙入口一定會遇到灰區輸入，因此系統必須明確定義：

- 主分流靠使用者
- 次分流靠系統提示
- 不強迫一次輸入同時進兩條主路徑

#### Case A：同時包含任務與想法

例：

- 「我覺得首頁可以改成三段式，明天先試第一版」
- 「這個方向好像不錯，晚點整理成 proposal」

規則：

- 若使用者選 `Task`
  - 以任務流為主
  - 系統可顯示輕提示：`這則任務背後可能有一個想法值得保留`
- 若使用者選 `Idea`
  - 以想法流為主
  - 系統可顯示輕提示：`這則想法要不要順手建立一個任務？`

第一版不要求自動雙寫，避免：

- duplicate records
- UI 複雜化
- 系統過度自信拆分

#### Case B：純 reference 類輸入

例：

- 書摘
- 文章連結
- 某段引用
- 一張截圖備忘

規則：

- 對用戶仍歸在 `Idea`
- 系統內部細分為 `reference`
- 後續可掛到：
  - 相關 theme
  - 相關 area
  - 相關 idea / reflection

理由：

- 對一般用戶來說，reference 比較接近「想留下來的東西」
- 不值得在第一版單獨暴露第三條主路徑

#### Case C：使用者選錯類型

規則：

- 系統不立即否決
- 先照使用者主意圖處理
- 若置信度很高地判斷另一條路徑更合理，僅顯示輕提示

例如：

- 選了 `Task`，但內容更像心得
  - 顯示：`這看起來也像一則想法，是否一起保留？`
- 選了 `Idea`，但內容明顯有 deadline / action verbs
  - 顯示：`這看起來也像可以直接開始的事，要不要建立任務？`

第一版不要做：

- 自動改寫使用者主分流
- 直接幫用戶重分類且不告知

#### Case D：多段輸入混合

例：

- 前半段是心得
- 後半段是明天要做的事

規則：

- 第一版仍以單一主流處理
- 系統可在後處理時做簡單抽取，生成：
  - `primary record`
  - `suggested extracted item`

但不要求一次輸入自動拆成多個 canonical records。

### 6.1.6 Brain Dump 第一版回饋要求

不論使用者選 `Task` 或 `Idea`，輸入後都必須立即感受到它沒有掉進黑洞。

#### Task Input 最低回饋

- 這件事被加到哪裡
- 它是新任務還是既有任務的補充
- 現在的 next step 是什麼

#### Idea Input 最低回饋

- 這則想法目前被放在哪個 area
- 它更像什麼類型（想法 / 心得 / 觀察 / reference）
- 它和哪些既有內容有關

這個回饋的作用不是正式治理，而是讓使用者感受到：

> 這則輸入有被接住，也有被初步理解。

UI 呈現應接近這種語氣：

- 已加入：創作 / 寫作方向
- 相關：最近 3 則想法
- 這則想法目前被歸到：工作 > 品牌內容
- 可能和「個人品牌」有關

第一版 UI 不應直接顯示：

- L1 / L2 / L3
- ontology node
- confidence 0.xx
- pending governance review

### 6.2 Layer B：Map Layer

責任：

- 從日常輸入中逐步形成個人地圖
- 支撐 `重要的東西自然會浮現`

Map Layer 的核心節點不是 task，而是：

- identity / life areas
- enduring pursuits
- recurring themes
- stable topic clusters
- reflection patterns
- 5 Types of Wealth overlays
- attention / energy distributions

Map Layer 的特徵：

- 可重算
- 可視覺化
- 可容忍中信心
- 主要服務前台 reflection / AI advice

#### Growth Layer（Map Layer 的視覺呈現子層）

Growth Layer 不是獨立的資料層，而是 Flow 和 Map 之間的**視覺化層**——把正在累積但還沒成熟到 insight 的東西，用看得見的方式展現出來。

責任：

- 每次輸入的即時視覺回饋（節點成長、區域變大）
- 反思的能量色彩表現（亮 = 高能量、暗 = 消耗）
- 連結的漸進生長
- 空白區域的視覺呈現

Growth Layer 的資料來源：

- Flow Layer 的每次新輸入 → 觸發區域大小更新
- 反思的能量標記 → 觸發節點色彩更新
- Map Layer 的 clustering 結果 → 觸發連結生長
- Discussion 結束 → 觸發一次性大量成長（討論是加速成長事件）

Growth Layer 不產生新的資料結構，只消費 Flow 和 Map 的現有資料進行視覺化計算。

### 6.3 Layer C：ZenOS Core Layer

責任：

- 承接真正需要長期治理的知識
- 提供 workspace / visibility / auth / confirm / task / plan 等正式 contract

只有 promotion 後的資料才應寫入這層。

## 7. 現有 Zentropy 結構如何放置

### 7.1 Area / Identity 地圖

保留，但角色要重新定義：

- 在 Zentropy 前台，它是 `life area / identity area`
- 在 ZenOS Core，它只升格為值得長期保留與治理的穩定 entity

### 7.2 Project

Project 不應被預設視為圖譜核心知識節點。

規則：

- 短命 project：只存在 Flow / Map Layer
- 長期 project / enduring pursuit：可作為 Map Layer 穩定節點
- 需要正式協作與治理的 project grouping：映射到 ZenOS `Plan`

### 7.3 Task

Task 在 Zentropy 中主要屬於 Flow Layer：

- 它是行動層訊號
- 不是知識圖譜本體

只有當 task 需要：

- 正式責任落點
- 驗收
- 結果回寫
- 跨人協作

才映射到 ZenOS Core Task。

### 7.4 Subtask

Subtask 不應進入知識圖譜核心，也不應 promotion。

它只屬於：

- execution detail
- checklist
- UI-level structure

### 7.5 Milestone

Milestone 屬於階段性管理概念，不是穩定知識節點。

規則：

- 可作為 Flow / Map Layer 的 phase marker
- 若需要正式 grouping / sequencing / ownership / completion boundary，映射到 ZenOS `Plan`

## 8. 小模型能力邊界

### 8.1 小模型適合做的

- 粗分類 routing
- embedding retrieval
- related-item suggestion
- short summary
- multi-label heuristic mapping
- low-risk clustering

### 8.2 小模型不應做的

- 直接決定 canonical ontology 結構
- 直接做高風險 entity merge
- 直接做不可逆 graph mutation
- 在低信心條件下產生穩定人格 / 價值結論
- 直接把前台噪音升格成 Core knowledge

## 9. 與現有 Brain Dump / Librarian 的關係

### 9.1 Brain Dump 的調整

現有 Brain Dump 主要是：

`自然語言 -> Product 篩選 -> 追加 task / 建新 task`

新方向下應改為：

`自然語言 + user-chosen main intent -> 粗分類 routing -> Flow Layer / Map Layer 組織 -> 候選 thread / task / note / reflection`

也就是：

- Brain Dump 不再預設所有輸入都輸出為 task
- 第一版對用戶只先暴露 `任務` 與 `想法` 兩條主路徑
- 它先是 capture router，再視主意圖與後台輕分類決定後續去向
- 灰區輸入先由使用者決定主流，系統只做輕提示與後續建議，不做高風險自動雙寫

### 9.2 Librarian 的調整

現有 Librarian 偏重：

- temporal graph
- correction vector
- recursive narrative

新方向下，Librarian 不應直接站在 consumer 主路徑中央。  
它應改為：

- Flow Layer 背後的整理與聚合引擎
- Map Layer 的 pattern / drift / overlay 計算器
- Promotion candidate 的背景治理器

也就是：

- 對前台：silent / soft
- 對後台：slow / stable / promotive

## 10. Spec 相容性與修改整理

已比對：

- `SPEC-zentropy-v5_1-product-definition`
- `SPEC-zentropy-v5-product-reinforcement`
- `SPEC-zenos-core`
- `SPEC-zenos-external-integration`
- 既有 Zentropy Functional Spec（Brain Dump）
- 既有 Librarian Engine Spec

### 10.1 不需要改動的上位原則

以下原則仍成立：

- ZenOS Core 是平台層，不是 consumer 前台
- 正式 task / plan / workspace / visibility 仍由 ZenOS Core 承擔
- 外部 app 仍應透過 federation / delegated credential 接入

### 10.2 必須修改或 supersede 的 Zentropy spec 內容

#### A. `SPEC-zentropy-v5_1-product-definition`

需要補入：

- 雙層圖譜架構
- Flow Layer / Map Layer 的區分
- `秩序 -> 浮現 -> 回饋` 對應的資料層

#### B. `SPEC-zentropy-v5-product-reinforcement`

需要調整：

- 把過去偏重 `shared context / team consensus / AI workflows` 的敘事下修
- 改為支援個人地圖、日常秩序、個人回饋優先

#### C. 既有 Functional Spec（Brain Dump）

需要修改：

- 不再預設所有輸入最終都是 task
- 補入 note / idea / reflection / reference routing
- 保留兩段式檢索，但 routing 空間要擴大

#### D. 既有 Librarian Engine Spec

需要修改：

- 把 consumer 主路徑與重治理路徑拆開
- 明確定義：
  - 哪些 background jobs 屬於 Flow Layer
  - 哪些 background jobs 屬於 Map Layer
  - 哪些 promotion jobs 才會觸發 ZenOS Core write

### 10.3 建議新增的後續 spec

1. `SPEC-zentropy-flow-layer`
2. `SPEC-zentropy-map-layer`
3. `SPEC-zentropy-promotion-rules`
4. `SPEC-zentropy-self-awareness-frameworks`

## 11. Done Criteria

本架構收斂完成，至少要同時滿足：

1. Zentropy 前台可以在不直接寫 ZenOS Core 的情況下，接住任意日常輸入
2. 使用者能在 Flow Layer 立刻感受到秩序，而不是等治理完成
3. Map Layer 能逐步長出穩定主題、重心與 framework overlays
4. ZenOS Core 只接收高信心、值得治理的 promotion 結果
5. 小模型不需要直接承擔 canonical ontology mutation 的主責

## 12. 一句話結論

> **Zentropy 不應直接把 consumer 前台建在 ZenOS Core 上。**
>
> **它應該先用自己的 Flow / Map 雙層圖譜承接日常，再把成熟的知識沉澱進 ZenOS Core。**
