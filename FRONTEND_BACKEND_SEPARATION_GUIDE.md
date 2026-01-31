# 前後端分離遷移指南

## 🎯 目標

將 Web 前端從單體架構遷移為真正的前後端分離：

```
❌ 舊架構（單體）:
web/
├── app/api/      → 後端 API routes
└── app/...       → 前端頁面（調用同專案的 API）

✅ 新架構（分離）:
web/              → 純前端（調用獨立 API）
api/              → 純後端（供 Web 和 Flutter 使用）
```

---

## 📋 已完成

### 1. ✅ API 客戶端層

已更新 `web/lib/api-client.ts`：

```typescript
// 自動根據環境變數決定 API URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

// 統一的 API 調用
import { API } from '@/lib/api-client';

// 使用範例
const areas = await API.areas.list();
const user = await API.users.me();
```

### 2. ✅ 環境變數配置

已更新 `web/.env.local`：

```env
# 本地開發
NEXT_PUBLIC_API_URL=http://localhost:3001

# 生產環境（部署後更新）
# NEXT_PUBLIC_API_URL=https://zentropy-api-xxx.run.app
```

---

## 🚀 啟動方式

### 本地開發（前後端分離）

**終端 1 - 啟動後端**:
```bash
cd api
npm run dev
# → http://localhost:3001
```

**終端 2 - 啟動前端**:
```bash
cd web
npm run dev
# → http://localhost:3000
# → 調用 http://localhost:3001/api/*
```

### 或使用統一腳本

```bash
./scripts/local-run.sh
```

---

## 📝 前端頁面遷移

### 舊方式（直接調用 API routes）

```typescript
// ❌ 舊方式 - 直接 fetch
const response = await fetch('/api/areas');
const data = await response.json();
```

### 新方式（使用 API 客戶端）

```typescript
// ✅ 新方式 - 使用 API 客戶端
import { API } from '@/lib/api-client';

const areas = await API.areas.list();
```

---

## 🔄 遷移步驟

### 階段 1：逐步遷移前端頁面 ✅ 當前階段

1. ✅ 建立 API 客戶端層
2. ✅ 配置環境變數
3. ⏳ 更新前端頁面使用 API 客戶端
4. ⏳ 測試前後端分離運行

**範例更新**:

```typescript
// 檔案: web/app/dashboard/page.tsx

// ❌ 舊方式
async function loadData() {
  const res = await fetch('/api/areas');
  const areas = await res.json();
}

// ✅ 新方式
import { API } from '@/lib/api-client';

async function loadData() {
  const areas = await API.areas.list();
}
```

### 階段 2：移除舊的 API routes ⏳ 等待完成

1. 確認所有前端頁面已遷移
2. 備份 `web/app/api/` 目錄
3. 刪除 `web/app/api/` 目錄
4. 測試前端功能

**命令**:
```bash
# 1. 備份
mv web/app/api web/app/api.backup

# 2. 測試前端
cd web && npm run dev

# 3. 確認無誤後刪除備份
rm -rf web/app/api.backup
```

---

## 🧪 測試清單

### 本地測試

- [ ] 後端獨立運行：`cd api && npm run dev`
- [ ] 前端獨立運行：`cd web && npm run dev`
- [ ] 前端能連接後端 API
- [ ] 登入功能正常
- [ ] Dashboard 載入資料正常
- [ ] 建立/編輯/刪除功能正常

### 部署測試

- [ ] 後端部署到 Cloud Run
- [ ] 取得 Cloud Run URL
- [ ] 更新 `web/.env.production`
- [ ] 前端建置 `npm run build`
- [ ] 前端部署到 Firebase Hosting
- [ ] 生產環境功能測試

---

## 📦 環境變數總覽

### 本地開發 (`web/.env.local`)

```env
# API Backend
NEXT_PUBLIC_API_URL=http://localhost:3001

# Firebase（保持不變）
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
# ...其他 Firebase 設定
```

### 生產環境 (`web/.env.production`)

```env
# API Backend (部署後更新)
NEXT_PUBLIC_API_URL=https://zentropy-api-xxx.run.app

# Firebase（保持不變）
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
# ...其他 Firebase 設定
```

---

## 🛠️ API 客戶端使用範例

### 基本 CRUD

```typescript
import { API } from '@/lib/api-client';

// GET - 列表
const areas = await API.areas.list();

// POST - 創建
const newArea = await API.areas.create({
  name: 'Work',
  scope: 'work'
});

// PUT - 更新
const updated = await API.areas.update('area-id', {
  name: 'Personal'
});

// DELETE - 刪除
await API.areas.delete('area-id');
```

### 錯誤處理

```typescript
import { API, ApiError } from '@/lib/api-client';

try {
  const data = await API.users.me();
} catch (error) {
  if (error instanceof ApiError) {
    console.error('API 錯誤:', error.message);
    console.error('錯誤代碼:', error.code);
    console.error('HTTP 狀態:', error.status);
  } else {
    console.error('網路錯誤:', error);
  }
}
```

### 使用低階方法

```typescript
import { getAPI, postAPI, putAPI, deleteAPI } from '@/lib/api-client';

// 自訂端點
const custom = await getAPI('/api/custom-endpoint');
const result = await postAPI('/api/custom', { data: '...' });
```

---

## 🎯 下一步

### 立即執行

1. **測試分離運行**:
   ```bash
   # 終端 1
   cd api && npm run dev

   # 終端 2
   cd web && npm run dev
   ```

2. **檢查前端是否調用獨立 API**:
   - 打開瀏覽器開發者工具
   - 查看 Network 標籤
   - 確認 API 請求指向 `http://localhost:3001/api/*`

3. **遷移第一個頁面**:
   - 從簡單頁面開始（如 Dashboard）
   - 更新為使用 `API` 客戶端
   - 測試功能

### 逐步遷移

```bash
# 建議順序
1. Dashboard (最簡單)
2. Areas 管理頁面
3. Products 管理頁面
4. Tasks 管理頁面
5. 複雜頁面（AI 功能等）
```

---

## ❓ 常見問題

### Q1: 前端還是調用 localhost:3000/api/*?

**A**: 檢查：
1. `web/.env.local` 是否有 `NEXT_PUBLIC_API_URL=http://localhost:3001`
2. 重啟 Web 專案（環境變數需要重啟才生效）
3. 前端代碼是否使用 `API` 客戶端（不是直接 `fetch`）

### Q2: CORS 錯誤?

**A**: 目前不會有 CORS 問題，因為：
- Next.js API routes 自動處理 CORS
- 本地開發在同一機器
- 生產環境會配置 CORS headers

### Q3: 何時移除 web/app/api/?

**A**: 當完成：
1. ✅ 所有前端頁面改用 API 客戶端
2. ✅ 測試通過
3. ✅ 確認無遺漏的調用

**不要著急**，可以先保留一段時間作為備份。

### Q4: Flutter App 也能用同一個 API?

**A**: 是的！
```dart
// app/lib/core/config/app_config.dart
const apiBaseUrl = 'https://zentropy-api-xxx.run.app';
```

Flutter 直接調用 Cloud Run 的 API，與 Web 前端共用同一個後端。

---

## 📚 相關文檔

- [LOCAL_DEVELOPMENT_GUIDE.md](LOCAL_DEVELOPMENT_GUIDE.md) - 本地開發指南
- [api/README.md](api/README.md) - API 專案說明
- [web/lib/api-client.ts](web/lib/api-client.ts) - API 客戶端原始碼
