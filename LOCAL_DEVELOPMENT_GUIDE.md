# 本地開發指南

## 🏗️ 當前架構狀態

目前專案有 **兩個並存的後端**：

```
Naruvia/
├── api/              ✅ 新的獨立 API 專案（端口 3001）
│   ├── src/app/api/  → 27 個 API routes
│   └── package.json  → "dev": "next dev -p 3001"
│
└── web/              ✅ 原本的前後端一體專案（端口 3000）
    ├── app/api/      → 原本的 API routes（尚未移除）
    ├── app/...       → 前端頁面
    └── package.json  → "dev": "next dev"
```

---

## 🚀 三種運行方式

### 方式 1️⃣：單體運行（推薦用於快速開發）

**只運行 Web 專案**，前後端都在一起：

```bash
cd web
npm run dev
```

- **前端**: http://localhost:3000
- **API**: http://localhost:3000/api/*
- **優點**: 簡單、快速、不需要配置
- **缺點**: API 變更需要重啟 Web 專案

---

### 方式 2️⃣：分離運行（用於獨立開發 API）

**同時運行兩個專案**：

**終端 1 - 啟動 API**:
```bash
cd api
npm run dev
# 運行於 http://localhost:3001
```

**終端 2 - 啟動 Web**:
```bash
cd web
npm run dev
# 運行於 http://localhost:3000
```

**問題**: Web 的前端目前會調用 `http://localhost:3000/api/*`（本地 API），而不是 `http://localhost:3001/api/*`（獨立 API）

**需要額外配置**（見下方）

---

### 方式 3️⃣：使用統一腳本（最方便）

我們已經有 `scripts/local-run.sh`，但它目前設定為同時運行兩個專案。

```bash
./scripts/local-run.sh
```

這會：
- 在背景啟動 API（端口 3001）
- 在前景啟動 Web（端口 3000）

---

## ⚙️ 配置 Web 連接到獨立 API

如果您想讓 **Web 前端** 調用 **獨立的 API（端口 3001）**，需要：

### 步驟 1：設定環境變數

編輯 `web/.env.local`，加入：

```env
# 本地開發時連接到獨立 API
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 步驟 2：更新前端 API 調用

**目前狀況**: Web 前端直接調用 `/api/*`（相對路徑）

**需要改為**: 使用環境變數

```typescript
// 範例：web/lib/api-client.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || ''

// 調用 API
fetch(`${API_BASE_URL}/api/me`, {
  headers: { Authorization: `Bearer ${token}` }
})
```

---

## 🎯 推薦的開發工作流程

### 情況 A：只開發前端

```bash
cd web
npm run dev
```

使用 Web 專案內建的 API routes。

---

### 情況 B：只開發 API

```bash
cd api
npm run dev
```

使用 Postman/curl 測試 API：
```bash
curl http://localhost:3001/api/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 情況 C：同時開發前後端

**選項 1 - 在 Web 專案開發**（推薦）:
```bash
cd web
npm run dev
```

在 `web/app/api/` 修改 API，前端立即看到變化。

**選項 2 - 使用獨立 API**:
1. 配置環境變數（如上）
2. 修改前端調用邏輯
3. 同時運行兩個專案

---

## 🔄 遷移計劃

**當前**: Web 專案包含完整的 API routes

**未來**: 完全移除 Web 專案的 API routes，強制使用獨立 API

### 遷移步驟

1. ✅ **已完成**: 分離出 `api/` 專案
2. ⏳ **待完成**: 建立 Web 的 API 客戶端層
3. ⏳ **待完成**: 移除 `web/app/api/` 目錄
4. ⏳ **待完成**: 更新所有前端調用

---

## 📝 當前建議

**短期**（現在）:
```bash
# 在 Web 專案開發（前後端一起）
cd web
npm run dev
```

**中期**（API 穩定後）:
- 建立 Web 的 API 客戶端
- 配置環境變數
- 測試分離運行

**長期**（生產環境）:
- API 部署到 Cloud Run: `https://zentropy-api-xxx.run.app`
- Web 部署到 Firebase Hosting: `https://zentropy.web.app`
- Web 通過環境變數連接到 Cloud Run API

---

## ❓ 常見問題

### Q1: 我應該用哪種方式開發？

**A**: 目前推薦在 `web/` 專案開發（方式 1），因為：
- API routes 仍在 web/ 中
- 前端尚未配置連接獨立 API
- 開發體驗更流暢

### Q2: api/ 專案的用途是什麼？

**A**:
- ✅ 獨立部署到 Cloud Run
- ✅ 供 Flutter App 調用
- ✅ 供未來的 Web 前端調用
- ✅ 測試和 CI/CD

### Q3: 何時移除 web/app/api/?

**A**: 當完成以下工作後：
1. 建立 Web 的 API 客戶端層
2. 更新所有前端調用
3. 確保測試通過
4. 逐步遷移，不要一次性刪除

---

## 🛠️ 快速測試

### 測試獨立 API

```bash
cd api
npm run dev

# 另一個終端
curl http://localhost:3001/api/areas \
  -H "Authorization: Bearer test-token"
```

### 測試 Web 專案

```bash
cd web
npm run dev

# 瀏覽器訪問
open http://localhost:3000
```

### 測試分離運行

```bash
# 終端 1
cd api && npm run dev

# 終端 2
cd web && npm run dev

# Web 仍會調用 localhost:3000/api/*
# 需要配置環境變數才會調用 localhost:3001/api/*
```
