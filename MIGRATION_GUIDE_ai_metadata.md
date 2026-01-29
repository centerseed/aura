# AI Metadata Migration 執行指南

## 📋 Phase 1 完成項目

✅ **已完成**:
1. Prisma Schema 更新 (新增 TaskAIMetadata model)
2. Migration SQL 腳本 (`20260126231402_add_task_ai_metadata`)
3. 資料遷移腳本 (`scripts/migrate-ai-metadata.ts`)
4. 驗證腳本 (`scripts/verify-ai-metadata.ts`)

## 🚀 執行步驟

### Step 1: 重新生成 Prisma Client

首先需要重新生成 Prisma Client 以包含新的 TaskAIMetadata model:

```bash
cd /Users/wubaizong/Naruvia/web
npx prisma generate
```

**預期輸出**:
```
✔ Generated Prisma Client
```

### Step 2: 執行 Database Migration (Development)

在 development 環境執行 migration:

```bash
cd /Users/wubaizong/Naruvia/web
npx prisma migrate dev --name add_task_ai_metadata
```

**這個命令會**:
- 偵測到新的 migration 檔案 (`20260126231402_add_task_ai_metadata`)
- 將 SQL 腳本套用到 development database
- 自動執行 `prisma generate` 更新 client

**預期輸出**:
```
Applying migration `20260126231402_add_task_ai_metadata`

The following migration(s) have been applied:

migrations/
  └─ 20260126231402_add_task_ai_metadata/
    └─ migration.sql

✔ Generated Prisma Client
```

**如果出現錯誤**:
- 檢查 DATABASE_URL 是否正確 (應該指向 development database)
- 確認有足夠的權限建立資料表和索引

### Step 3: 執行資料遷移腳本

遷移現有的 ai_analysis JSON 資料到新表:

```bash
cd /Users/wubaizong/Naruvia/web
tsx scripts/migrate-ai-metadata.ts
```

**預期輸出**:
```
🚀 開始遷移 AI metadata 到獨立資料表...

📊 找到 25 個 tasks 有 ai_analysis 資料

✅ 需要遷移的 tasks: 8 個
⚪ 不需要遷移的 tasks: 17 個

📝 開始批次寫入 task_ai_metadata...

✅ 成功遷移: 8 個 tasks

📊 遷移統計:

緊急程度分布:
  - high: 3 個 tasks
  - medium: 4 個 tasks
  - low: 1 個 tasks

總計: 8 個 tasks 有 AI metadata

🎉 遷移完成！
```

**注意事項**:
- 此腳本是 idempotent，可以安全地重複執行
- 不會修改或刪除原本的 ai_analysis JSON
- 如果沒有任何 tasks 有重組資料，會顯示「沒有需要遷移的資料」

### Step 4: 驗證資料完整性

執行驗證腳本確認遷移成功:

```bash
cd /Users/wubaizong/Naruvia/web
tsx scripts/verify-ai-metadata.ts
```

**預期輸出**:
```
🔍 開始驗證 AI metadata 遷移...

📋 Step 1: 檢查資料表結構

✅ task_ai_metadata 表已存在

📋 Step 2: 檢查索引

已建立的索引:
  - task_ai_metadata_pkey
  - task_ai_metadata_task_id_key
  - task_ai_metadata_urgency_level_idx
  - task_ai_metadata_reorganized_at_idx

✅ 所有索引都已正確建立

📋 Step 3: 比對資料一致性

找到 25 個 tasks 有 ai_analysis

資料一致性統計:
  ✅ 一致: 8 個 tasks

📋 Step 4: 統計資訊

總 tasks 數: 25
有 AI metadata 的 tasks: 8 (32.0%)

緊急程度分布:
  - high: 3 (37.5%)
  - medium: 4 (50.0%)
  - low: 1 (12.5%)

最近 7 天重組的 tasks: 8

📋 驗證總結

✅ 驗證通過！資料遷移完整且正確。
```

**如果出現警告或錯誤**:
- 仔細閱讀輸出的錯誤訊息
- 檢查是否有資料不一致
- 可以重新執行 Step 3 的遷移腳本

### Step 5: 檢查 Database (Optional)

直接查詢 database 確認資料:

```bash
cd /Users/wubaizong/Naruvia/web
npx prisma studio
```

在 Prisma Studio 中:
1. 開啟 `TaskAIMetadata` 表
2. 檢查是否有資料
3. 確認 `task_id` 外鍵正確關聯到 `Task`

或使用 SQL:

```sql
-- 檢查遷移的資料筆數
SELECT COUNT(*) FROM task_ai_metadata;

-- 查看前 5 筆資料
SELECT * FROM task_ai_metadata LIMIT 5;

-- 檢查與 tasks 的關聯
SELECT t.id, t.content, m.urgency_level, m.reorganized_at
FROM tasks t
LEFT JOIN task_ai_metadata m ON t.id = m.task_id
WHERE m.urgency_level IS NOT NULL
LIMIT 5;
```

## ✅ 驗證清單

Phase 1 完成後，請確認以下項目:

- [ ] Prisma Client 已重新生成
- [ ] Migration 已成功套用到 database
- [ ] `task_ai_metadata` 資料表已建立
- [ ] 4 個索引都已建立 (pkey, task_id unique, urgency_level, reorganized_at)
- [ ] 資料遷移腳本執行成功
- [ ] 驗證腳本顯示「驗證通過」
- [ ] Prisma Studio 可以看到 TaskAIMetadata 資料

## 🔄 回滾方式 (如果需要)

如果需要回滾 migration:

```bash
# 1. 回滾 database migration
cd /Users/wubaizong/Naruvia/web
npx prisma migrate resolve --rolled-back 20260126231402_add_task_ai_metadata

# 2. 刪除 migration 檔案
rm -rf prisma/migrations/20260126231402_add_task_ai_metadata

# 3. 還原 schema.prisma
git checkout prisma/schema.prisma

# 4. 重新生成 Prisma Client
npx prisma generate
```

## 📊 預期影響

### 正面影響
- ✅ 資料表新增，**不影響現有功能**
- ✅ ai_analysis JSON 完整保留，**向後相容**
- ✅ 為 Phase 2 批次更新優化做好準備

### 無影響項目
- ✅ 現有 API 完全不受影響
- ✅ 前端代碼不需修改
- ✅ 重組功能繼續使用 JSON 欄位

### Database 變化
- 新增資料表: `task_ai_metadata` (~1KB per task with metadata)
- 新增索引: 3 個 (task_id unique, urgency_level, reorganized_at)
- 預估儲存增加: 若有 100 個重組過的 tasks，約 100KB

## 🚀 下一步: Phase 2 (灰度切換)

Phase 1 完成並驗證無誤後，可以考慮進入 Phase 2:
- 修改重組邏輯使用雙寫模式 (同時寫 JSON + 新表)
- 監控性能提升
- 觀察 1-2 週確認穩定性

詳見 [ANALYSIS_ai_analysis_migration.md](ANALYSIS_ai_analysis_migration.md) Phase 2 章節。

## ❓ 常見問題

### Q: 執行 migration 會影響 production 嗎?
A: 不會。`npx prisma migrate dev` 只會套用到 development database (由 DATABASE_URL 環境變數決定)。

### Q: 如果沒有任何 tasks 有重組資料怎麼辦?
A: 沒關係，資料遷移腳本會顯示「沒有需要遷移的資料」，這是正常的。資料表仍然會建立，供未來使用。

### Q: Phase 1 完成後重組功能會變快嗎?
A: 不會。Phase 1 只是建立基礎設施，性能優化要等到 Phase 2/3 修改代碼後才會生效。

### Q: 可以跳過資料遷移直接進 Phase 2 嗎?
A: 可以，但不建議。資料遷移確保新舊資料一致性，有助於 Phase 2 的測試和驗證。

---

**Status**: Phase 1 準備完成，等待執行和驗證 ✅
