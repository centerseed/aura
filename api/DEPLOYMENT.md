# API 部署指南

## 🚀 部署前檢查流程

本專案提供自動化的部署前檢查腳本，確保只有通過所有測試和品質檢查的代碼才能部署。

### 快速開始

```bash
cd api
npm run deploy
```

## 📋 檢查流程說明

部署腳本會依序執行以下檢查：

### 1. 環境變數檢查

檢查必要的環境變數是否已設置：
- ✅ `GOOGLE_GENERATIVE_AI_API_KEY` - **必須**（Gemini API）
- ⚠️ `DATABASE_URL` - 生產環境需要（開發環境使用 `.env` 或 `.env.test`）

### 2. 依賴檢查

確認 `node_modules` 已安裝，若未安裝則自動執行 `npm ci`。

### 3. Linter 檢查

運行 ESLint 檢查程式碼風格：
```bash
npm run lint
```

**如果失敗**：修復 Linter 錯誤後重新運行部署腳本。

### 4. 單元測試

運行所有單元測試（不需要資料庫或外部服務）：
```bash
npm run test:unit
```

**測試範圍**：
- `tests/unit/lib/` - 工具函數測試（100% 覆蓋）
- `tests/unit/application/use-cases/` - 業務邏輯測試（90%+ 覆蓋）
- `tests/unit/domain/` - 領域層測試

### 5. 整合測試

自動啟動測試資料庫並運行整合測試：
```bash
npm run test:db:setup
SKIP_EMBEDDING_TESTS=true npm run test:integration
npm run test:db:stop
```

**注意**：
- ✅ 自動跳過 Embedding API 測試（避免耗盡 Gemini API 配額）
- ✅ 測試完成後自動停止測試資料庫
- ⚠️ 需要 Docker 運行（用於 PostgreSQL 測試資料庫）

**測試範圍**：
- `tests/integration/api-routes/` - API 端點測試
- `tests/integration/repositories/` - Repository 層測試（16 個測試，100% 通過）

### 6. 測試覆蓋率檢查

生成完整的測試覆蓋率報告並檢查是否達標：
```bash
npm run test:coverage
```

**當前覆蓋率門檻**（`vitest.config.ts`）：
- Lines: 70%
- Functions: 76%
- Branches: 53%
- Statements: 70%

**如果失敗**：
1. 查看覆蓋率報告：`open coverage/index.html`
2. 補充測試以提升覆蓋率
3. 或調整 `vitest.config.ts` 中的門檻（不推薦）

### 7. 建置專案

執行 Next.js 建置：
```bash
npm run build
```

生成生產環境最佳化的程式碼，輸出到 `.next/` 目錄。

---

## ✅ 部署成功後

當所有檢查通過後，腳本會顯示：

```
========================================
   ✅ 所有檢查通過！
========================================

📦 建置產物位置: .next/
🚀 可以開始部署了！
```

### 下一步部署選項

#### 本地生產模式測試
```bash
npm start
```

訪問 http://localhost:3002 驗證建置是否正確。

#### 部署到 Vercel
```bash
vercel --prod
```

#### 部署到其他平台
請參考平台的部署文件（如 Docker, AWS, GCP 等）。

---

## 🐛 常見問題

### Q: Docker daemon 未運行

**錯誤訊息**：
```
❌ 測試資料庫啟動失敗
   請檢查 Docker 是否運行
```

**解決方案**：啟動 Docker Desktop 後重新運行部署腳本。

### Q: Linter 檢查失敗

**錯誤訊息**：
```
❌ Linter 檢查失敗
   請修復程式碼風格問題後再部署
```

**解決方案**：
```bash
npm run lint  # 查看錯誤詳情
npm run lint --fix  # 自動修復（如果支持）
```

### Q: 覆蓋率未達標

**錯誤訊息**：
```
❌ 測試覆蓋率未達標
```

**解決方案**：
1. 查看覆蓋率報告：
   ```bash
   npm run test:coverage:ui
   ```
2. 識別未覆蓋的代碼
3. 補充測試

### Q: 整合測試失敗

**解決方案**：
1. 單獨運行失敗的測試檔案：
   ```bash
   npx vitest run tests/integration/path/to/test.ts
   ```
2. 檢查測試資料庫狀態：
   ```bash
   npm run test:db:setup
   docker ps | grep naruvia-test-db
   ```

---

## 📊 測試覆蓋率現況

**總體覆蓋率**: 70.81%（目標 85%+）

### 核心檔案覆蓋率

| 檔案 | 覆蓋率 | 狀態 |
|------|--------|------|
| `lib/date-utils.ts` | 100% | ✅ 完成 |
| `lib/reorganize-prompt.ts` | 100% | ✅ 完成 |
| `lib/embedding.ts` | 45.45% | ✅ 單元測試完成 |
| `infrastructure/repositories/prisma-task-repository.ts` | - | ✅ 整合測試完成（16 個測試）|
| `application/use-cases` | 90%+ | ✅ 健全 |

詳細的測試覆蓋率指南請參考 [tests/TESTING.md](tests/TESTING.md)。

---

## 🔄 持續改進

### 漸進式覆蓋率提升計畫

當前門檻設定為現有覆蓋率水平（70%），隨著測試補充逐步提升：

- ✅ **Phase 1** (已完成): 基礎工具測試 → 70% 門檻
- ✅ **Phase 2** (已完成): Embedding 整合測試 → 目標 75% 門檻
- ✅ **Phase 3** (已完成): Repository 測試 → 目標 80% 門檻
- ⏳ **Phase 4** (規劃中): 其他 Repository 與 API routes 測試 → 目標 85% 門檻

---

## 📚 相關文件

- [測試覆蓋率指南](tests/TESTING.md)
- [Transaction Rollback 遷移指南](tests/integration/MIGRATION_GUIDE.md)
- [軟體工程標準](../docs/06_Standards/002_Software_Engineering_Standards.md)

---

## ⏰ Cloud Scheduler 備註

### LINE 晨報推播 Cron

`POST /api/line/cron/morning-briefing`

用途：
- 在台灣時間 `05:00-11:00` 每小時觸發一次
- 只為命中 `settings.briefingSchedule.morning.windowStart` 的 LINE 綁定用戶推播晨報

必要條件：
- Header 必須帶 `Authorization: Bearer ${CRON_SECRET}`
- `CRON_SECRET` 必須與 API 環境變數一致

建議排程：
- 時區：`Asia/Taipei`
- 時間：`0 5-11 * * *`

注意：
- route 內已做同日 delivery 去重，不需要在 scheduler 層重複實作
- 本版服務範圍以台灣與泛華語 UTC+8 為主，不做全球時區掃描

---

**最後更新**: 2026-02-06
**維護者**: Zentropy Team
