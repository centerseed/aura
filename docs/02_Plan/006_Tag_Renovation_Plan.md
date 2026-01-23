
# Tag Renovation Strategy & Workflow

本文件定義了 Naruvia 系統中針對「標籤發散 (Tag Proliferation)」問題的治理機制。這是一個「二階治理 (Meta-Governance)」流程，旨在定期修剪與整併過度生長的 Topic 層級。

## 1. 觸發條件 (Triggers)

系統不應隨時進行重整，以免造成用戶認知負擔。僅在以下條件滿足時觸發：
1.  **數量閾值**: 單一 `Product` 下的 `Topic` 數量超過 15 個。
2.  **語義重疊**: 計算發現有 > 30% 的 Topic 在向量空間中的距離 < 0.15 (極度相似)。
3.  **人工觸發**: 用戶在 Dashboard 主動點擊 "Optimize Library"。

## 2. 重整演算法：向量聚類 (Vector Clustering)

Librarian Service 將執行以下 Batch Job：

1.  **Embedding**: 取出該 `Product` 下所有 Topic 的名稱與描述，轉為向量。
2.  **Clustering**: 使用 `DBSCAN` 或 `K-Means` 演算法進行聚類，找出「語義上的群組」。
3.  **Naming**: 針對每個 Cluster，將其包含的所有 Topics 丟給 LLM，要求：「請為這群標籤取出一個最具代表性的新名字 (MDL 原則)」。

## 3. The Renovation Blueprint (翻修藍圖)

系統會產出一份 JSON 結構的提案，供前端渲染：

```json
{
  "product": "Naruvia_Backend",
  "proposed_merges": [
    {
      "new_topic_name": "Infrastructure",
      "absorbs": ["Server_Setup", "Docker_Config", "Cloud_Run_Deploy"],
      "reason": "High semantic overlap in deployment tasks."
    },
    {
      "new_topic_name": "API_layer",
      "absorbs": ["FastAPI_Routes", "Pydantic_Models"],
      "reason": "Both relate to interface definitions."
    }
  ]
}
```

## 4. 執行流程 (Migration Pipeline)

一旦用戶核准 (Approve)，系統啟動 **Atomic Migration Transaction**：

1.  **Batch Update Firestore**:
    *   `Query`: `WHERE product='Naruvia_Backend' AND topic IN ['Server_Setup', ...]`
    *   `Update`: `SET topic='Infrastructure'`
2.  **Batch Update Vault (Markdown)**:
    *   使用 `File_Management_Server` 批次修改受影響檔案的 Frontmatter。
3.  **Memory Consolidation (關鍵步驟)**:
    *   讀取舊 Topics 的 `Topic Summary`。
    *   LLM 任務：將這些舊 Summary 合併並重寫為新 Topic 的 `Rolling Summary`。
    *   **Archive**: 舊的 Rolling Summary 存入 Archive History 以防回滾，然後刪除。

## 5. Implementation Tasks

- [ ] **Task 4.1**: Implement `TagAuditor` service to calculate density & trigger alerts.
- [ ] **Task 4.2**: Implement `ClusteringEngine` (scikit-learn or simple cosine logic) for proposal generation.
- [ ] **Task 4.3**: Integrate `BlueprintReview` UI in Coach Dashboard.
- [ ] **Task 4.4**: Implement `MigrationExecutor` with rollback capability.
