# Flutter App - API 端點對照表

本文件列出 Flutter App 與後端 API 的所有端點對照關係。

## 🔗 API Base URL

### Production & Staging
```
https://zentropy-api-894512935237.asia-east1.run.app
```

### Local Development
```
http://localhost:3001
```

配置位置: [app/lib/core/config/app_config.dart](lib/core/config/app_config.dart)

---

## 📋 API 端點清單

### 🔐 Authentication (認證)

| 端點 | HTTP 方法 | Flutter 實作 | 說明 |
|------|-----------|-------------|------|
| `/api/auth/signin` | POST | `ApiClient.signIn()` | 登入並同步用戶資料 |
| `/api/me` | GET | `ApiClient.getCurrentUser()` | 獲取當前用戶資訊 |

Repository: [auth_repository_impl.dart](lib/data/repositories/auth_repository_impl.dart)

---

### 🧠 Brain Dump (AI 任務解析)

| 端點 | HTTP 方法 | Flutter 實作 | 說明 |
|------|-----------|-------------|------|
| `/api/brain-dump` | POST | `ApiClient.brainDump()` | AI 解析自然語言輸入為結構化任務 |

Repository: [brain_dump_repository_impl.dart](lib/data/repositories/brain_dump_repository_impl.dart)

---

### ✅ Tasks (任務管理)

| 端點 | HTTP 方法 | Flutter 實作 | 說明 |
|------|-----------|-------------|------|
| `/api/tasks` | GET | `ApiClient.getTasks()` | 獲取任務列表 (支援篩選) |
| `/api/tasks` | POST | `ApiClient.createTask()` | 創建新任務 |
| `/api/tasks` | PATCH | `ApiClient.updateTask()` | 更新任務 (需包含 taskId) |
| `/api/tasks/{taskId}` | DELETE | `ApiClient.deleteTask()` | 軟刪除任務 |
| `/api/tasks/{taskId}/sub-items/{subItemId}` | PATCH | `ApiClient.updateSubItem()` | 更新子項目狀態 |

**查詢參數支援:**
- `status`: 任務狀態 (INBOX, ACTIVE, MAINTAIN, REFERENCE, ARCHIVE)
- `due_date_from`: 截止日期起始
- `due_date_to`: 截止日期結束
- `completed_today`: 只返回今日完成的任務 (true/false)

Repository: [task_repository_impl.dart](lib/data/repositories/task_repository_impl.dart)

---

### 🗂️ Areas (領域管理)

| 端點 | HTTP 方法 | Flutter 實作 | 說明 |
|------|-----------|-------------|------|
| `/api/areas` | GET | `ApiClient.getAreas()` | 獲取所有領域 |
| `/api/areas` | POST | `ApiClient.createArea()` | 創建新領域 |

Repository: [area_repository_impl.dart](lib/data/repositories/area_repository_impl.dart)

---

### 📦 Products (專案管理)

| 端點 | HTTP 方法 | Flutter 實作 | 說明 |
|------|-----------|-------------|------|
| `/api/products` | GET | `ApiClient.getProducts()` | 獲取所有專案 |
| `/api/products` | POST | `ApiClient.createProduct()` | 創建新專案 |
| `/api/products/{id}/reorganize-topics` | POST | `ApiClient.reorganizeProductTopics()` | AI 重組專案主題 |
| `/api/products/{id}/apply-reorganization` | POST | `ApiClient.applyProductReorganization()` | 套用重組建議 |

Repository: [product_repository_impl.dart](lib/data/repositories/product_repository_impl.dart)

---

### 📚 Library (知識庫)

| 端點 | HTTP 方法 | Flutter 實作 | 說明 |
|------|-----------|-------------|------|
| `/api/library` | GET | `ApiClient.getLibrary()` | 獲取知識庫內容 |

---

## 🔧 API Client 配置

### Dio 設定
位置: [app/lib/core/di/providers.dart](lib/core/di/providers.dart)

- **Base URL**: 根據環境自動切換 (production/staging/development)
- **Timeout**: 30 秒
- **Interceptors**:
  - `AuthInterceptor`: 自動添加 Firebase ID Token
  - `LoggingInterceptor`: 記錄請求/回應日誌

### 認證機制
所有 API 請求會自動透過 `AuthInterceptor` 添加以下 Header:
```
Authorization: Bearer {firebase_id_token}
```

---

## ✅ 測試

### 執行 API 連線測試
```bash
cd app
flutter test test/integration/api_connection_test.dart
```

測試內容:
- ✅ API Base URL 連線測試
- ✅ 各端點存在性驗證
- ✅ 環境配置檢查

---

## 🚀 部署狀態

### 後端 API 服務
- **服務名稱**: `zentropy-api`
- **Region**: `asia-east1` (台灣)
- **URL**: https://zentropy-api-894512935237.asia-east1.run.app
- **狀態**: ✅ 已部署 (2026-01-31)

### 查看後端狀態
```bash
gcloud run services list --project zentropy-4f7a5 --region asia-east1
```

---

## 📝 重要注意事項

1. **API 端點已更新**: 後端已從 Next.js Web 專案拆分為獨立 API 服務
2. **所有端點路徑維持不變**: `/api/*` 路徑結構保持一致
3. **Clean Architecture**: 後端採用 4 層架構 (Domain, Application, Infrastructure, Interface)
4. **統一回應格式**: 所有 API 回應使用 `ApiResponseBuilder` 統一格式

---

## 🔗 相關文件

- [後端 API README](../../api/README.md)
- [部署指南](../../DEPLOYMENT_GUIDE.md)
- [API 重構完成報告](../../COMPLETION_REPORT.md)
