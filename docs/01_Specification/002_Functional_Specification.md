# Aura Functional Specification (功能規格與系統邏輯)

本文件詳述了 Aura 系統的運行邏輯、核心管理模型以及虛擬幕僚 (Agents) 的協作流程。

## 1. 核心管理模型：雙軸維度 (Dual-Axis Matrix)

系統背後的資料架構不再是傳統資料夾，而是以下兩個維度的交叉：

### 1.1 橫軸：狀態抽屜 (Status Drawers) - 「資訊的能量流動」

系統依據資訊的「動能 (Kinetic Energy)」將其分流至不同抽屜。

| 抽屜 (Drawer) | 能量屬性 | 定義 (Definition) | 系統行為 (System Behavior) |
| :--- | :--- | :--- | :--- |
| **00_Inbox** | **Unstable (極不穩定)** | 剛進入系統，尚未被 AI 消化或分類的碎料。 | **Must Process**: 停留超過 24hr 會觸發焦慮警報。系統優先處理此區。 |
| **10_Active** | **High Kinetic (高動能)** | 當前正在推進的專案 (Product) 或待辦事項。 | **Always Visible**: 常駐於 Dashboard。Librarian 每日監測變更並更新 Summary。 |
| **20_Maintain** | **Cyclic (週期性)** | 已進入穩定期，需定期維護的資產 (如健康、伺服器)。 | **Conditional**: 平時隱藏。僅在「檢查日」或「異常觸發」時浮現。 |
| **30_Reference** | **Potential (位能)** | 已完成的專案或純知識筆記。不需執行，但具備參考價值。 | **Invisible (On-demand)**: 僅透過 Vector Search 在需要時被「喚醒」作為 Context。 |
| **40_Archive** | **Inert (無動能)** | 已過時或作廢的資訊。保留僅為歷史紀錄。 | **Deep Storage**: 排除於一般搜索之外，僅供特殊審計使用。 |

### 1.2 縱軸：實體標籤 (Entity) - 「關於什麼？」
由 AI 自動識別，如：`Area (領域)`, `Product (主體)`, `Topic (細項)`。

---
## 2. 核心功能規格 (Core Functional Specs)

### 2.0 系統本體論定義 (The System Ontology)

為了確保 AI 自動分類的結果符合用戶直覺，本系統採用嚴格的三層式標籤架構。此架構不僅是資料庫欄位，更是對用戶「人生資產」的定義。

| 層級 (Level) | 定義 (Definition) | 用戶期待 (User Expectation) | AI 治理邊界 (Governance Rule) | 範例 (Examples) |
| :--- | :--- | :--- | :--- | :--- |
| **L1: Area (領域)** | **The Workspace**: 人生的不同舞台或協作空間。對應不同的 Context 與參與人員。 | 「這是我的辦公室/客廳。」<br>我可以邀請合夥人進入特定的 Area 共同工作。 | **Extensible (可擴充)**。<br>預設提供四大象限，但允許新增 Custom Area (如 `05_NewStartup`) 作為獨立協作空間。 | `02_Work`, `05_Startup_X`<br>(Shared) |
| **L2: Product (主體)** | **The Shareable Asset**: 具備產出價值的實體資產。可單獨授權給外部協作者。 | 「這是我的專案資料夾。」<br>我可以只把這個專案分享給外包人員，而不暴露整個 Area。 | **Proposable (需核准)**。<br>AI 可識別新實體並提議，但建立新 Product 通常需 User/Coach 確認。 | `Backend_System` (Shared),<br>`Personal_Blog` |
| **L3: Topic (細項)** | **The Nature**: 在該主體下執行的工作性質或子模組。 | 「這是我的工作性質。」<br>用於分析時間分配與工作類型。 | **Flexible (自動化)**。<br>AI 依據內容自動聚類，但受 MDL (最小描述長度) 限制。 | `Feature`, `Deisgn`,<br>`Meeting` |

### 2.0.1 AI 分類判斷法則 (Taxonomy Heuristics)
為了提升分類的準確性，Librarian Agent 必須依據以下法則進行判斷：

1.  **L1 Area (Identity & Context)**:
    *   **核心問題**: "我現在戴著哪頂身分帽子 (Who am I right now)？"
    *   **定義**: 一個長期持續的狀態，代表特定的責任邊界與協作圈。
    *   **邊界測試**:
        *   **受雇者身分 (Employee)**: 為特定公司工作、領薪水、對老闆負責 -> `02_Career_CompanyA`.
        *   **創辦人身分 (Founder)**: 經營自己的事業、承擔成敗、對市場負責 -> `05_Startup_X`.
        *   **個人生活 (Self)**: 父親/母親/朋友、健康與休閒 -> `01_Life`.
        *   **專業品牌 (Expert)**: 寫作、演講、累積個人聲譽 -> `03_Personal_Brand`.

2.  **L2 Product (The What - Asset)**:
    *   **核心問題**: "這件事是在累積哪個『長期資產』的價值？"
    *   **邊界測試**:
        *   它是一個可交付的專案 (e.g., `App_v1`) 或持續維護的系統 (e.g., `Server_Infra`, `My_Body`) 嗎？ -> **Yes, it is a Product.**
        *   它只是一個動作 (e.g., `Meeting`) 或狀態 (e.g., `Urgent`) 嗎？ -> **No.**

3.  **L3 Topic (The How - Nature)**:
    *   **核心問題**: "我具體在執行什麼性質的動作？"
    *   **邊界測試**:
        *   它是動詞名詞化 (e.g., `Coding`, `Planning`, `Research`) 嗎？ -> **Yes, it is a Topic.**
        *   它在描述工作的階段或類型嗎？ -> **Yes.**

### 2.1 Agent 角色定義 (Agent Personas)

系統由三名具備專業職責的 Agent 構成，實現全自動化管理：

### 2.1 守門人 (The Gatekeeper) - NLU 閘道器
*   **輸入處理**: 接收文字、語音、照片。
*   **穩定化處理**: 識別屬性 (Action/Note)、掛載 Entity、判定初步風險 (🟢/🟡/🔴)。
*   **輸出**: 結構化 JSON 數據。

### 2.2 圖書管理員 (The Librarian) - 檔案專家
*   **歸檔邏輯**: 根據 Entity 與 Naming Convention 自動存入 `Aura_Vault/`。
*   **上下文鏈接**: 在使用者處理任務時，自動檢索並彈出相關 Reference 備忘。

### 2.3 營運教練 (The Coach) - 全局監控與問答
*   **衝突偵測**: 掃描 WBS 與日曆，提前預警任務重疊。
*   **心理閉環**: 晚報與晨報的對話主持，確保使用者達成「晚睡前心理卸載」。

---

## 3. 核心功能行為 (Feature Behaviors)

### 3.1 晨間簡報 (Morning Briefing)
*   **時間**: 每日 08:30。
*   **內容**: 衝突預警、今日最佳關注事項。

### 3.2 晚報與心理閉環 (Evening Commit)
*   **時間**: 每日 21:00。
*   **對話流程**: [升級檢查] -> [主動拋棄] -> [最終焦慮確認]。

### 3.3 儀表板三層視角 (Three-Layer View)
*   **雷達圖**: 看未來進度。
*   **健康燈**: 看營運區狀況。
*   **上下文欄**: 看相關 Reference。

### 3.4 知識治理與動態重構協議 (Knowledge Governance & Refactoring)

本系統的核心價值在於其「熵減」能力。系統不應僅是資料堆疊，而必須具備「自我修剪」的能力，以應對語義模糊、標籤發散與認知過載。

#### 3.4.1 語義感測層 (Semantic Sensing: 系統如何看見全局)
Librarian Agent 不以單一筆記為判斷基礎，而是維護一個**語義拓撲地圖 (Semantic Topology)**：
*   **向量空間掃描 (Embedding Space Scan)**：持續追蹤實體 (Entity) 內部所有筆記的向量分佈。當出現明顯的趨勢群聚（Clusters）或邊界模糊（Ambiguity）時，標記為「待審計狀態」。
*   **重心漂移偵測 (Centroid Drift)**：監控標籤的語義中心。若 `Coding` 標籤的重心從 `Algorithm` 偏移至 `AI Tooling`，系統需重新評估標籤的宏觀定義。

#### 3.4.2 重構觸發條件 (Governance Prerequisites: 何時啟動整理)
重構並非隨機發生，必須同時滿足下列「硬指標」與「軟指標」：

| 條件類別 | 指標 (Metrics) | 達成閾值與意圖 |
| :--- | :--- | :--- |
| **群聚成熟度** | 子群聚密度 (Sub-cluster Density) | 當子群聚內部關聯度比主標籤高出 2.5 倍，且資料量 > 8 筆時，觸發 **「分形演化 (Fractal Split)」**。 |
| **語義模糊度** | 跨標籤重疊率 (Tag Overlap) | 當兩個不同標籤（如：`AI` 與 `Automation`）的資訊向量相似度 > 85% 時，觸發 **「語義歸一 (Normalization)」**。 |
| **視覺熵值** | 碎片化指數 (Fragmentation Index) | 當無結構的「碎料筆記」在單一主題佔比超過 60% 時，觸發 **「原子坍縮 (Collapse)」**。 |

#### 3.4.2.1 關聯度量化定義 (Metrics for Associativity)
「內部關聯度」係指透過以下複合指標計算之結果，用以判定知識群聚的「重力」：
1.  **語義緊密度 (Semantic Cohesion)**: 基於 **餘弦相似度 (Cosine Similarity)**矩陣。若子群聚內筆記兩兩相似度的平均值顯著高於主標籤全域平均值（標度化後 > 2.5 倍標方差），則判定為強語義連結。
2.  **關鍵實體共現 (Entity Co-occurrence)**: 統計子群聚內特有實體（Unique Entities）的覆蓋率。若群聚內 >70% 的筆記共享某些主標籤中低頻出現的關鍵實體，則視為具備獨立重心的信號。
3.  **引用鏈接密度 (Linkage Density)**: 計算筆記間的 `[[Internal Links]]` 與共同 Reference 的重疊度。高密度的邏輯鏈接網絡是觸發「分形進化」或「原子坍縮」的決定性條件。
4.  **跨語言向量對齊 (Cross-lingual Semantic Alignment)**: 系統必須採用原生支援多語系（Multilingual）之 Embedding 模型。重構判定中，語義相似度計算需超越語言障礙（如：中文與英文相關內容應具備高度相似性）。此外，關鍵實體共現之計算應基於權威實體 ID（如 Wikidata ID）而非單純字串匹配，以確保多國語系環境下的知識拓撲一致性。

#### 3.4.3 知識治理工作流 (Governance Pipeline)
系統執行治理時，遵循「聚合優先、定位隨後」的邏輯，以極大化「熵減」效益：

1.  **第一階段：語義感測與引力判定 (Sensing & Gravity)**
    *   **感測**：持續掃描受入碎料與既有筆記的向量距離。
    *   **判定**：將碎料視為「無重力塵埃」。系統尋找具備大質量的「既有敘事事件（引力源）」。若碎料與某事件語義關聯度 > 0.75，則判定為該事件的演化分支。

2.  **第二階段：語義聚合與敘事演化 (Synthesis & Evolution)**
    *   **行動**：執行「敘事吞噬」。將判定關聯的碎料內容，透過 LLM 編織進主事件的 Narrative 敘述中。
    *   **價值**：主事件隨時間自發生長，碎料在產生標籤噪音前即被合併，達成「化整為零」。
    *   **雜訊處理**：無法被任何引力源吸附的孤立碎片，執行「原子坍縮」聚合為一則新產生的 Master Note。

3.  **第三階段：雙軸矩陣定位 (Matrix Alignment)**
    *   **邏輯**：定位是在內容「成型」後才執行的後設描述。
    *   **行動**：針對聚合/演化後的完整新內容，重新評估其：
        *   **狀態抽屜 (Drawer)**：依據內容最新的成熟度分配（如：開發完成轉為 Maintain）。
        *   **實體標籤 (Tag)**：依據演化後的語義重心，自動補全或修正層級標籤。

#### 3.4.4 知識治理的第一性原理 (First Principles of Governance)
本系統採用基於 **資訊熵 (Information Entropy)** 與 **語義拓撲 (Semantic Topology)** 的治理架構，參考了 OpenReview (2024) 關於 LLM 知識熵衰減的研究成果：

1.  **熵衰減與可塑性平衡 (Entropy Decay & Plasticity)**:
    *   **理論基礎**：隨著系統成熟，知識熵自然衰減（集中化）。過度熵減會導致「固化」，過度高熵會導致「混亂」。
    *   **治理策略**：
        *   **成熟區 (Product/Work)**：執行強制的 **熵減 (Entropy Reduction)**。利用 EM-INF (Inference-time Entropy Minimization) 原則，迫使碎料併入既有強向量（Master Note），減少檢索路徑的分歧。
        *   **探索區 (Life/Idea)**：保留 **高熵狀態 (High Entropy Preservation)**。允許碎片在一定時間內維持獨立，防止新興的微弱訊號被舊有的強勢敘事過早吞噬（Over-fitting）。

2.  **語義引力與敘事守恆 (Semantic Gravity & Continuity)**:
    *   **核心**：既有事件是「引力源」。碎料應被視為衛星。
    *   **行動**：聚合不應只是條列，而必須是碎屑能量轉化為行星大氣（敘事演化）。只有當碎料能增強主敘事的連貫性時，才執行吞噬。

3.  **狀態作為能量變動率 (Status as Kinetic Flux)**:
    *   **核心**：狀態（抽屜）反映資訊的「做功速率」。
    *   **行動**：只要該項目的資訊仍處於高頻變動（無論是 Feature 還是 Bug fix），其狀態即為 **Active (高動能)**。只有當變動率趨於零，才向靜態抽屜遷移。

#### 3.4.4.1 Prompt 決策鏈：新標籤的產出協議 (Trigger Protocols)
基於 EM-INF (推理期熵最小化) 原則，新實體標籤 (Topic) 的產出必須通過以下「重重過濾」：

1.  **語義損失補償 (Semantic Loss Compensation)**: 若碎料與既有標籤的語義重疊度 < 80%（即語義損失 > 20%），且無法被既有引力中心「吞噬」時，始得提議建立新標籤。
2.  **胚胎發育原則 (Embryonic Emergence)**: 針對 `Discovery` 或 `Life` 區域，當出現全新維度、且具備「潛在引力」的孤立訊號時，系統建立「臨時標籤」，並給予高熵容忍度。
3.  **分形演化觸發 (Fractal Split)**: 當某一標籤內部的「子群聚密度」比主標籤高出 2.5 倍時，系統執行標籤分裂。新產出的標籤必須具備 **MDL (最小描述長度)**，即能用最短的詞彙區分兩個不同的語義領域。

#### 3.5 記憶體系與上下文管理 (Memory & Context Strategy)
本系統摒棄複雜的外部向量資料庫 (Vector DB) 依賴，轉而採用 **「分區滾動壓縮 (Area-based Rolling Compression)」** 機制。此設計基於一個核心假設：**在有效的熵減治理下，高階用戶的知識邊界是有限且可控的（約 20 Areas / 100 Projects）。**

1.  **分區摘要快照 (Area-based Snapshots)**:
    *   **架構**：系統為每個 `Area`（如 Work, Life）維護一份動態的 `rolling_summary`。
    *   **內容**：包含該領域的核心目標、活躍專案列表 (Active Projects) 及其 `project_abstract`（專案極簡摘要）。
    *   **更新機制**：每次 Librarian 執行治理並產出新敘事後，順便觸發一次「遞歸摘要」，將最新的變動壓縮回 `rolling_summary` 中。

2.  **治理時的上下文構建 (Context Construction)**:
    *   **情境**：當 Librarian 準備整理屬於 `04_Product` 的碎料時。
    *   **載入**：僅載入 `04_Product/rolling_summary` + 該領域下所有 `Active` 專案的 `abstract`。
    *   **效益**：這組 Context 通常僅佔 3k~5k tokens，既能提供 LLM 足夠的全局觀以進行精準聚合，又避免了讀取海量歷史資料的成本。

3.  **正向循環 (The Virtuous Cycle)**:
    *   因為系統持續執行「熵減（聚合與歸檔）」，活躍專案的數量被嚴格控制。
    *   活躍專案少 -> Context 就短 -> LLM 讀取得快且準 -> 治理效果好 -> 系統更乾淨。
