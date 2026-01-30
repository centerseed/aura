# POC 計畫：Zentropy Memory 驗證 (Librarian Insight Engine)
> **目標**: 驗證「神經符號記憶蒸餾 (Neuro-Symbolic Memory Distillation)」架構 (即 Librarian Insight Engine) 是否能有效隨時間提升個人化分類的準確度。

**狀態**: 草案 (Draft)
**版本**: 1.0
**預計時程**: 1 週

## 1. 目標 (Objective)
透過實證數據證明：
1.  **記憶蒸餾有效**: 系統能成功從用戶的修正行為中萃取出明確的規則。
2.  **準確度提升**: AI 在應用蒸餾後的規則後，分類準確度顯著提升。
3.  **延遲可接受**: RAG 檢索帶來的額外開銷在即時應用可接受的範圍內。

---

## 2. POC 範圍 (Scope)
我們將建立一個 **獨立的、輕量化的測試平台 (Testbed)** (暫時不整合進主 App)，以模擬用戶的反饋循環。

### 2.1 測試平台 (Scripts)
一組 Node.js 腳本，模擬完整的流程管道：
1.  `simulate_user_correction.ts`: 生成合成的修正數據 (Synthetic correction data)。
2.  `distill_rules.ts`: 執行向量分群與 LLM 規則歸納。
3.  `evaluate_accuracy.ts`: 評估 AI 在有無規則輔助下的表現差異。

### 2.2 數據模擬 (Data Simulation)
我們將模擬 **2 個截然不同的人物誌 (Persona)** 來驗證個人化能力：
-   **Persona A (創業者/老闆)**:
    -   *行為特徵*: 將「買螢幕」、「SaaS 訂閱」歸類為 **「公司資產 (Company Assets)」**。
-   **Persona B (電玩愛好者)**:
    -   *行為特徵*: 將「買螢幕」、「SaaS 訂閱」歸類為 **「個人娛樂 (Personal Entertainment)」**。

---

## 3. 驗證方法 (實驗設計)

我們將進行一個分為 3 階段的控制實驗：

### Phase 1: 基準線 (Zero-Shot) - Day 1
**目標**: 測量 AI 在沒有記憶輔助下的「預設」準確度。
1.  輸入 20 個測試任務 (例如：「買 4090 顯卡」、「續訂 Netflix」、「繳 AWS 帳單」) 給標準的 `Brain Dump` prompt。
2.  **測量指標**:
    -   準確度 % (分別對照 Persona A 與 B 的預期答案)。
    -   *預測*: AI 可能無法區分 Persona (例如：可能通通把「顯卡」歸類為娛樂)。

### Phase 2: 修正與蒸餾 (Correction & Distillation) - Day 2
**目標**: 透過修正來教導系統。
1.  **輸入修正**: 針對每個人物誌輸入 10 筆修正數據。
    -   *Persona A*: "買 4090" -> 公司資產。
    -   *Persona B*: "買 4090" -> 個人娛樂。
2.  **執行蒸餾**:
    -   執行 `distill_rules.ts`。
    -   **驗證輸出**: 檢查 `user_governance_rules` 資料表是否包含正確規則 (例如：「金額 > $500 的硬體屬於公司資產」)。

### Phase 3: 增強推論 (Enhanced Inference) - Day 3
**目標**: 測量改進幅度。
1.  輸入 **一組全新** 但相似的 20 個任務 (例如：「買 Wacom 繪圖板」、「續訂 Vercel」)。
2.  **測量指標**:
    -   準確度 % ("Librarian's Reflex" 的效果)。
    -   與 Phase 1 的基準線進行比較。

---

## 4. 技術實作步驟

### Step 1: 設定 Supabase (Vector)
-   建立一個新的專案或 POC 專用的 schema。
-   啟用 `pgvector`。
-   建立 `poc_corrections` 與 `poc_rules` 資料表。

### Step 2: 開發模擬腳本
-   **Script A (Generator)**: 使用 `Gemini Flash` 根據 Persona Prompt 生成逼真的任務與「正確答案」。
-   **Script B (Distiller)**:
    -   撈取修正數據。
    -   計算 Embedding (使用 `text-embedding-004`)。
    -   執行簡單分群 (例如：餘弦距離 < 0.2)。
    -   呼叫 `Gemini Pro` 歸納規則。
-   **Script C (Evaluator)**:
    -   執行帶有 RAG (規則檢索) 的分類任務。
    -   計算準確度分數。

### Step 3: 報告產出
-   產生一份 Markdown 報告，比較：
    -   **基準準確度** vs. **記憶增強後準確度**。
    -   **規則品質**: 歸納出的規則是否合乎人類邏輯？

---

## 5. 成功標準 (Success Criteria)
| 指標 (Metric) | 目標 (Target) |
| :--- | :--- |
| **基準準確度** | ~60-70% (通用分類) |
| **增強後準確度** | **> 90%** (個人化分類) |
| **規則有效性** | 100% 的歸納規則對人類來說是合理的。 |
| **RAG 延遲** | 每次請求額外開銷 < 500ms。 |

## 6. 所需資源
-   **LLM 選擇**:
    -   模擬/評估: `Gemini 1.5 Pro` (聰明)
    -   蒸餾: `Gemini 1.5 Pro` (System 2 思考)
    -   推論: `Gemini 1.5 Flash` (System 1 直覺 - 用以證明成本效益)
-   **資料庫**: Supabase Free Tier 綽綽有餘。
