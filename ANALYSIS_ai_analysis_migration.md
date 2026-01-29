# ai_analysis 拆分可行性分析

## 📊 方案 A：部分拆分（推薦）

### 新增資料表設計

```prisma
// 新增 TaskAIMetadata 表（僅存重組時批次更新的欄位）
model TaskAIMetadata {
  id                       String    @id @default(uuid()) @db.Uuid
  task_id                  String    @unique @db.Uuid  // 一對一關聯

  // 時間推斷相關（重組時批次更新）
  time_inference_reasoning String?   @db.Text
  urgency_level            String?   @db.VarChar(20)    // critical/high/medium/low
  reorganized_at           DateTime? @db.Timestamp(6)

  // 索引
  created_at               DateTime  @default(now()) @db.Timestamp(6)
  updated_at               DateTime  @updatedAt @db.Timestamp(6)

  // 關聯
  task                     Task      @relation(fields: [task_id], references: [id], onDelete: Cascade)

  @@index([urgency_level])  // 可按緊急度查詢
  @@index([reorganized_at]) // 可查詢最近重組的 tasks
  @@map("task_ai_metadata")
}

// Task 表保留 ai_analysis JSON（存其他低頻欄位）
model Task {
  // ... 原有欄位
  ai_analysis    Json?              @db.Json  // 保留：narrative, manual_adjustment 等
  ai_metadata    TaskAIMetadata?    // 新增：一對一關聯
}
```

### 優化效果

**Before（當前）**：
```typescript
// 20 個 tasks = 20 個 UPDATE（逐一 merge JSON）
for (const inference of proposal.time_inferences) {
  const task = await tx.task.findUnique({ where: { id } });
  await tx.task.update({
    where: { id },
    data: {
      ai_analysis: {
        ...task.ai_analysis,  // 保留舊資料
        time_inference_reasoning: inference.reasoning,
        urgency_level: inference.urgency_level,
      }
    }
  });
}
```

**After（拆分後）**：
```typescript
// 20 個 tasks = 1 個 UPSERT（批次操作）
await tx.taskAIMetadata.createMany({
  data: proposal.time_inferences.map(inf => ({
    task_id: inf.task_id,
    time_inference_reasoning: inf.reasoning,
    urgency_level: inf.urgency_level,
    reorganized_at: new Date(),
  })),
  skipDuplicates: true,  // 如果已存在則更新
});

// 或使用原生 SQL (更快)
await tx.$executeRaw`
  INSERT INTO task_ai_metadata (task_id, time_inference_reasoning, urgency_level, reorganized_at)
  VALUES ${Prisma.join(values)}
  ON CONFLICT (task_id) DO UPDATE SET
    time_inference_reasoning = EXCLUDED.time_inference_reasoning,
    urgency_level = EXCLUDED.urgency_level,
    reorganized_at = EXCLUDED.reorganized_at
`;
```

### 性能提升估算

| 階段 | Before | After | 改善 |
|------|--------|-------|------|
| 查詢階段 | 1 SELECT (已優化) | 1 SELECT | 0% |
| 更新階段 | 20 UPDATEs | 1 UPSERT | **-95%** |
| **總計** | 21 queries | 2 queries | **-90%** |

**20 個 tasks 預估**：從 5-12 秒 → **2-4 秒**

---

## 🚧 方案 B：完全拆分（不推薦）

將所有 ai_analysis 欄位都拆分成獨立欄位。

### 風險評估

| 風險項目 | 方案 A | 方案 B |
|---------|--------|--------|
| Migration 複雜度 | ⚠️ 中等 | ❌ 極高 |
| 向後相容性 | ✅ 高（保留 JSON） | ❌ 低（需改所有代碼） |
| 查詢性能 | ✅ 優化重組 | ⚠️ JOIN 開銷增加 |
| 開發成本 | ✅ 低（只改重組邏輯） | ❌ 高（改所有讀寫） |
| 回滾難度 | ✅ 簡單 | ❌ 困難 |

**結論**：方案 B 收益不明顯，風險過高。

---

## 📋 方案 A 實施計劃

### Phase 1: 準備與驗證（無風險）

1. **建立 Migration 腳本**
   ```bash
   npx prisma migrate dev --name add_task_ai_metadata --create-only
   ```

2. **資料遷移腳本**（將現有 JSON 資料複製到新表）
   ```typescript
   // scripts/migrate-ai-metadata.ts
   const tasks = await prisma.task.findMany({
     where: { ai_analysis: { not: Prisma.JsonNull } }
   });

   for (const task of tasks) {
     const analysis = task.ai_analysis as any;
     if (analysis?.urgency_level) {
       await prisma.taskAIMetadata.upsert({
         where: { task_id: task.id },
         create: {
           task_id: task.id,
           time_inference_reasoning: analysis.time_inference_reasoning,
           urgency_level: analysis.urgency_level,
           reorganized_at: analysis.reorganized_at
             ? new Date(analysis.reorganized_at)
             : null,
         },
         update: { /* same as create */ }
       });
     }
   }
   ```

3. **驗證資料完整性**
   ```sql
   -- 檢查是否有資料遺失
   SELECT COUNT(*) FROM tasks WHERE ai_analysis->>'urgency_level' IS NOT NULL;
   SELECT COUNT(*) FROM task_ai_metadata;
   ```

### Phase 2: 灰度切換（可回滾）

4. **修改重組邏輯** - 雙寫模式
   ```typescript
   // 同時寫入 JSON 和新表（確保向後相容）
   await tx.task.update({
     where: { id },
     data: {
       ai_analysis: { ...currentAnalysis, urgency_level: inference.urgency_level },
       ai_metadata: {
         upsert: {
           create: { urgency_level: inference.urgency_level, ... },
           update: { urgency_level: inference.urgency_level, ... },
         }
       }
     }
   });
   ```

5. **監控效能**（對比 Phase 1 baseline）

### Phase 3: 完全切換（需觀察 1-2 週）

6. **切換為只寫新表**
   ```typescript
   // 停止寫入 JSON，只寫新表
   await tx.taskAIMetadata.upsert({
     where: { task_id: inference.task_id },
     create: { ... },
     update: { ... },
   });
   ```

7. **最終清理**（可選，不急）
   - 從 ai_analysis JSON 移除已拆分的欄位
   - 保留 JSON 作為未來擴展用

---

## ⚠️ 需要注意的事項

### 1. Migration 必須是可回滾的

```sql
-- Up migration
CREATE TABLE task_ai_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
  time_inference_reasoning TEXT,
  urgency_level VARCHAR(20),
  reorganized_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_task_ai_metadata_urgency ON task_ai_metadata(urgency_level);
CREATE INDEX idx_task_ai_metadata_reorganized ON task_ai_metadata(reorganized_at);

-- Down migration (回滾用)
DROP TABLE task_ai_metadata;
```

### 2. Supabase 特別注意

- Supabase 使用 PostgreSQL，完全支援此方案
- Migration 會在 `web/prisma/migrations/` 產生 SQL 檔案
- 部署時需執行 `npx prisma migrate deploy`

### 3. 資料一致性

Phase 2 的雙寫模式確保：
- 新代碼可讀取新表
- 舊代碼（如有）仍可讀取 JSON
- 沒有資料遺失風險

---

## 💰 成本效益分析

### 開發成本
- **Migration 腳本**：2 小時
- **資料遷移腳本**：2 小時
- **修改重組邏輯**：3 小時
- **測試與驗證**：3 小時
- **總計**：約 1 個工作天

### 預期收益（以 50 tasks 為例）
- **重組時間**：30-60 秒 → **8-15 秒**（-70%）
- **Database load**：200 queries → 50 queries（-75%）
- **用戶體驗**：顯著改善，不再需要「30 秒 loading」

### ROI 評估
- 如果每天重組 5 次，節省 5 × 45 秒 = 225 秒/天
- 如果專案使用 1 年，累積節省 1370 分鐘（23 小時）
- **投資回報期**：約 1 週

---

## ✅ 推薦行動

1. **立即執行**：Phase 1（準備 migration 腳本）
2. **觀察當前性能**：記錄 baseline（重組 20 tasks 需時）
3. **小規模測試**：在 development 環境執行完整流程
4. **Production 部署**：確認無誤後部署（可在低流量時段）
5. **監控 1 週**：確認穩定性與性能提升

## 🔄 回滾策略

如果 Phase 2/3 出現問題：
1. 切換回只讀/寫 JSON（代碼層面，秒級回滾）
2. 保留 task_ai_metadata 表（資料不丟失）
3. 修復 bug 後重新嘗試

---

**結論**：方案 A 風險低、收益高，建議實施。
