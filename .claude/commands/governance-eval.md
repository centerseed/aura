# /governance-eval — Flywheel 治理狀況評估

**Usage:** `/governance-eval`

**Example:** `/governance-eval`

---

## What This Command Does

從資料庫讀取 Brain Dump traces、Librarian corrections/rules、Episodic Memory 估時偏差，
依照「traces as source of truth」框架評估目前 Flywheel + Episodic Memory 治理健康度，
輸出結構化診斷報告。

> **兩套學習機制：**
>
> **Flywheel（Librarian）**：Tag 修正 → 蒸餾 → rules → 更好的分類建議
> - `poc_librarian.corrections` 是唯一燃料；達到 10 筆觸發蒸餾
>
> **Episodic Memory（Coach）**：任務完成 → 記錄估時偏差 → 校準下次估時
> - L1：`daily_plan_items`（estimated_minutes vs actual_minutes，report_done 驅動）
> - L2：`tasks`（estimated_duration_hours vs actual_duration_hours，ARCHIVE 自動計算）
> - 最終持久化目標：`coaching_memory` 表（embedding 語意存儲）

---

## Steps

### 1. 確認 Cloud SQL Proxy 是否在執行

```bash
lsof -i :5433 | grep -q LISTEN && echo "Proxy running" || echo "NOT running"
```

如果沒在跑，提示用戶先執行：
```bash
cloud-sql-proxy zentropy-4f7a5:asia-east1:zentropy-db --port=5433 &
```

等確認 proxy 在線後繼續。

### 2. 執行資料抓取腳本

```bash
./scripts/governance-eval.sh
```

完整讀取輸出（共 10 個 Section）。如果有 SQL 錯誤或 poc_librarian 不可用，記錄下來但繼續。

### 3. 分析並輸出治理報告

依照下方框架分析數據，輸出報告（**直接輸出 Markdown，不寫檔案**）。

---

## 評估框架

### A. Flywheel（Librarian）整體健康分級

根據以下條件評分：

| 分級 | 條件 |
|------|------|
| 🚀 FLYWHEEL | ≥1 用戶：corrections≥10，rules>0，avg_confidence>0.7，applied>20 |
| 🟢 ACTIVE | ≥1 用戶：corrections≥10，rules>0 |
| 🟡 BUILDING | corrections 最高的用戶在 5-9 之間 |
| 🔴 COLD START | 所有用戶 corrections < 5 |

### B. Episodic Memory（Coach）健康分級

根據 Section 7 & 8 的資料評分：

| 分級 | 條件 |
|------|------|
| 📊 CALIBRATED | ≥1 用戶：L1 samples≥20，avg_ratio 介於 0.8-1.2（準確） |
| 🟢 LEARNING | ≥1 用戶：L1 samples≥10，偏差已測量（有數字） |
| 🟡 ACCUMULATING | ≥1 用戶：L1 samples 3-9（樣本累積中） |
| 🔴 COLD START | 所有用戶 samples < 3 |

### C. Brain Dump 使用健康度

分析兩個維度（**不含 edit rate**，那是另一個機制）：

**Volume（量）**
- 近 7 天 total > 20 → healthy
- 近 7 天 total 5-20 → moderate
- 近 7 天 total < 5 → low engagement

**Recency（最近活躍度）**
- 最近一筆在 3 天內 → active
- 最近一筆在 7 天內 → recent
- 超過 7 天 → 可能流失

### D. Flywheel 動能分析

檢查學習迴圈的每個環節是否健康：

```
Brain Dump (traces)
    ↓ 用戶調整 Tag（category）→ 記錄到 poc_librarian.corrections
Librarian Corrections（corrected_field = 'category'）
    ↓ 達到 10 筆 → 觸發蒸餾
Librarian Rules (distilled knowledge)
    ↓ 應用到下一次 Brain Dump context
Better Tag Suggestions → 用戶需要調整的比例下降
```

指標：
- corrections 進度（距離門檻 10 還有多遠）
- rules avg_confidence（品質）
- applied_count vs correct_count（規則有效率）

### E. Episodic Memory 動能分析

檢查估時學習迴圈的每個環節：

```
任務建立（estimated_duration_hours 或 sub_items 的 estimated_minutes）
    ↓ 完成任務 → report_done / status=ARCHIVE
DailyPlanItem.actual_minutes（L1）+ Task.actual_duration_hours（L2）
    ↓ CoachCalibration 計算 avg_ratio by area
校準係數注入 generate-plan prompt
    ↓ 下次 AI 估時更準確
偏差縮小 → avg_ratio 趨近 1.0
```

指標：
- L1 完成樣本數（Section 7）
- L2 任務有 actual_duration_hours 比率（Section 8）
- avg_ratio by area（偏差方向）
- coaching_memory 是否開始積累（Section 9）

### F. Tag 修正模式分析（Section 6 資料）

讀取最近 15 筆 `poc_librarian.corrections`（tag 修正），識別：
- AI 預測了什麼 category → 用戶改成什麼？
- 有無重複的錯誤方向？（同一類型的 AI 誤判）
- 哪些任務類型 AI 最容易判錯？
- 有沒有明顯可以被 Librarian 規則捕捉的 pattern？

---

## 報告格式

```markdown
# Flywheel + Episodic Memory 治理報告 — YYYY-MM-DD

## 整體健康
- Flywheel（Librarian）：[🚀 FLYWHEEL / 🟢 ACTIVE / 🟡 BUILDING / 🔴 COLD START]
- Episodic Memory（Coach）：[📊 CALIBRATED / 🟢 LEARNING / 🟡 ACCUMULATING / 🔴 COLD START]

## Brain Dump 使用狀況
- 總量：X 筆（近 7 天：X，近 30 天：X）
- 活躍用戶：X 人
- 最近活躍：YYYY-MM-DD

## Per-User 狀況
| 用戶 | Dumps | Corrections | 蒸餾狀態 | L1 樣本 | 偏差方向 | 最近活躍 |
|------|-------|-------------|----------|---------|----------|----------|
| ... | ... | ... | ... | ... | ... | ... |

## Flywheel 動能（Librarian）
- Corrections 最高：X 筆（門檻 10，[已達到/還差 N 筆]）
- Librarian Rules：X 條活躍，avg confidence X（[良好/偏低/無資料]）
- 規則應用：X 次，X 次正確（有效率 X%）

## Episodic Memory 動能（Coach）
- L1 完成樣本：X 筆（daily_plan_items 有 actual_minutes）
- L1 整體偏差：avg_ratio = X（[低估/高估/準確]）
- L2 任務追蹤：X 筆有 actual_duration_hours
- coaching_memory 積累：X 筆（[空/建立中]）
- 偏差最嚴重 Area：X（avg_ratio = X，N 筆樣本）

## Tag 修正模式觀察
（分析最近 15 筆 tag corrections，找出 AI 判錯的規律）
- 模式 1：AI 預測「X」→ 用戶改為「Y」（N 次）
- 模式 2：...

## 診斷 & 行動建議
### 最高優先
- [ ] ...

### 中期改善
- [ ] ...

## 與上次對比
（如果有歷史脈絡，比較趨勢）
```

---

## CRITICAL BOUNDARIES

- **只讀，不寫**：不修改任何程式碼或資料庫
- **直接輸出報告**：不寫 `.md` 檔案，直接在對話中呈現
- 如果 poc_librarian 資料不可用，在報告中標注「Librarian 資料暫不可用」
- 如果 coaching_memory 為空，標注「Episodic Memory 持久化層尚未啟用」

---

## 前置需求

- Cloud SQL Proxy 在 port 5433 執行
- `api/.env` 有 `DATABASE_URL` 或 `CLOUDSQL_DATABASE_URL`
- `psql` 已安裝（`brew install libpq`）
