
# Prompt Quality Assurance & Evaluation Plan

本計畫定義了 Zentropy 系統中 LLM Prompt（特別是記憶壓縮與治理邏輯）的品質追蹤、評估與迭代機制。目標是建立一套 **"LLM-Ops"** 閉環，確保隨著時間推移與資料量增長，AI 的治理能力依然精確可靠。

> **架構參考**: 詳見 [025_POC_Architecture_Upgrade_Plan.md](./025_POC_Architecture_Upgrade_Plan.md) 中的 AI 使用追蹤系統設計

---

## 1. 評估哲學：AI-Assisted Evaluation

鑑於人工審查的高成本，我們採用 **"Judge Agent" (裁判代理)** 模式。
使用一個獨立的、高能力模型（如 Gemini 2.0 Flash with Temperature 0），針對 Librarian 產出的摘要與分類結果進行評分。

## 2. 追蹤層級

### 2.1 即時追蹤（每次 AI 調用）

所有 AI 操作都會記錄到 `ai_usage_logs` 表：

| 欄位 | 說明 |
|------|------|
| `operation_type` | brain_dump / adjust_tags / suggest_product / reorganize / time_inference |
| `input_text` | 用戶原始輸入 |
| `input_token_count` | 輸入 Token 數 |
| `output_json` | AI 輸出結果 |
| `output_token_count` | 輸出 Token 數 |
| `latency_ms` | 處理時間 (毫秒) |
| `user_feedback` | accepted / modified / rejected |
| `user_modifications` | 用戶修改的內容 |

### 2.2 品質評估（每日抽樣）

Judge Agent 對抽樣結果進行評分，記錄到 `ai_quality_evaluations` 表：

| 指標 (Metric) | 定義 (Definition) | 理想範圍 | 評估方式 |
| :--- | :--- | :--- | :--- |
| **Recall Rate (關鍵回憶率)** | 摘要是否保留了 Input 中的關鍵實體 (Entity) 與決策 (Decision) | > 95% | Judge Agent 比對 Input 與 Summary 中的 Named Entities 集合重疊率。 |
| **Logic Consistency (邏輯一致性)** | 摘要中的因果關係是否與 Input 矛盾 | 100% | Judge Agent 檢查 `[UPDATE]` 與 `[DEPRECATE]` 標記是否在 Input 中有證據支持。 |
| **Compression Ratio (壓縮比)** | `Token(Input) / Token(Summary)` | 5x ~ 20x | 程式自動計算。過低浪費 Token，過高導致失真。 |
| **Hallucination Rate (幻覺率)** | 摘要中出現了 Input 未提及的 "新資訊" | 0% | Judge Agent 掃描 Summary 中無法溯源的專有名詞。 |
| **Acceptance Rate (接受率)** | 用戶直接接受 AI 結果的比例 | > 80% | 從 user_feedback 統計計算。 |

## 3. 實作計畫 (Implementation Strategy)

### 3.1 建立 "Evaluation Dataset" (Golden Set)
*   **來源**：從真實使用的 User Input 中，挑選具代表性的 50 筆案例（包含矛盾需求、技術變更、模糊描述）。
*   **標註**：人工撰寫這些案例的「標準摘要 (Ground Truth)」。
*   **用途**：每次 Prompt 修改後，必須先跑過這 50 筆 Golden Set，確保分數未退步 (Regression Test)。

### 3.2 開發 "Daily Health Check" (每日健檢)

使用 Supabase Edge Function 或 Cloud Scheduler 實現：

```typescript
// Daily Health Check Cron Job
async function dailyHealthCheck() {
  // 1. 隨機抽取 5% 的昨日處理結果
  const samples = await supabase
    .from('ai_usage_logs')
    .select('*')
    .gte('created_at', yesterday)
    .lt('created_at', today)
    .limit(100);
  
  const sampleSize = Math.ceil(samples.data.length * 0.05);
  const randomSamples = shuffle(samples.data).slice(0, sampleSize);
  
  // 2. 請 Judge Agent 評估
  for (const sample of randomSamples) {
    const evaluation = await judgeAgent.evaluate(sample);
    
    await supabase.from('ai_quality_evaluations').insert({
      usage_log_id: sample.id,
      recall_score: evaluation.recall,
      consistency_score: evaluation.consistency,
      compression_ratio: evaluation.compression,
      hallucination_detected: evaluation.hasHallucination,
      judge_reasoning: evaluation.reasoning,
      needs_review: evaluation.score < 0.8,
    });
    
    // 3. 若評分過低，發送 Alert
    if (evaluation.score < 0.7) {
      await sendAlert({
        type: 'low_quality_ai_output',
        log_id: sample.id,
        score: evaluation.score,
      });
    }
  }
}
```

### 3.3 Dashboard 可視化

在 Coach Dashboard 的後台，增加 "System Health" 頁面：

```typescript
// API: GET /api/admin/ai-health
interface AIHealthDashboard {
  period: string;
  metrics: {
    total_operations: number;
    operations_by_type: Record<string, number>;
    avg_acceptance_rate: number;
    avg_latency_ms: number;
    total_tokens_used: number;
    
    // 品質指標
    avg_recall_score: number;
    avg_consistency_score: number;
    hallucination_count: number;
    needs_review_count: number;
  };
  trends: {
    date: string;
    operations: number;
    acceptance_rate: number;
    avg_latency: number;
  }[];
  flagged_issues: {
    log_id: string;
    operation_type: string;
    issue: string;
    created_at: string;
  }[];
}
```

## 4. 迭代週期 (Iteration Loop)

1.  **Collect**: 收集 Daily Health Check 中的 "Bad Cases" 與低 Acceptance Rate 案例。
2.  **Analyze**: 分析是 Prompt 指令不清，還是 Context Window 不足。
3.  **Refine**: 修改 System Prompt (例如增強對該類 Bad Case 的防禦)。
4.  **Verify**: 用 Golden Set 進行回歸測試。
5.  **Deploy**: 更新 API 服務。

## 5. 具體 Task List

### Phase 1: 追蹤基礎建設
- [ ] **Task 5.1**: 建立 `ai_usage_logs` 與 `ai_quality_evaluations` 表 (Supabase)
- [ ] **Task 5.2**: 實作 `AITrackingService` (TypeScript)
- [ ] **Task 5.3**: 整合追蹤到所有 AI API 端點

### Phase 2: 用戶反饋
- [ ] **Task 5.4**: 實作前端反饋 UI (接受/修改/拒絕)
- [ ] **Task 5.5**: 實作反饋回報 API

### Phase 3: 品質評估
- [ ] **Task 5.6**: 建立 Golden Set 測試資料集
- [ ] **Task 5.7**: 開發 `JudgeAgent` 評估服務
- [ ] **Task 5.8**: 實作 Daily Health Check Cron Job

### Phase 4: 監控 Dashboard
- [ ] **Task 5.9**: 建立 AI Health Dashboard API
- [ ] **Task 5.10**: 實作 Dashboard UI
- [ ] **Task 5.11**: 設定 Alert 通知機制

---

*此計畫與 [025_POC_Architecture_Upgrade_Plan.md](./025_POC_Architecture_Upgrade_Plan.md) 緊密整合，確保 AI 品質追蹤作為系統核心能力。*
