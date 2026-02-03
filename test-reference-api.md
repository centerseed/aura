# Product References API 測試指南

## 修改總結

### 🔧 已修改的檔案

1. **API 後端** - `api/src/app/api/products/[id]/references/route.ts`
   - 統一使用 `ApiResponseBuilder` 回應格式
   - 所有端點使用 `catchDomainException` 統一錯誤處理
   - 使用 `NotFoundException` 取代手動錯誤回應

2. **Web 前端** - `web/components/product-detail-modal.tsx`
   - 更新第 241 行：`data.references` → `data.data?.references`

3. **Flutter 前端** - `app/lib/data/datasources/remote/api_client.dart`
   - ✅ 已正確實作，無需修改

## 🎯 新的 API 回應格式

### GET /api/products/[id]/references

**修改前（舊格式）：**
```json
{
  "success": true,
  "productId": "xxx",
  "productName": "Product Name",
  "references": [...],
  "total": 5
}
```

**修改後（新格式）：**
```json
{
  "success": true,
  "data": {
    "productId": "xxx",
    "productName": "Product Name",
    "references": [
      {
        "id": "ref-1",
        "type": "url",
        "content": "https://example.com",
        "title": "Example",
        "created_at": "2024-01-01T00:00:00.000Z",
        "source": "product",
        "taskId": null,
        "taskContent": null
      }
    ]
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "total": 5
  }
}
```

### POST /api/products/[id]/references

**修改前：**
```json
{
  "success": true,
  "reference": {...},
  "total": 6
}
```

**修改後：**
```json
{
  "success": true,
  "data": {
    "reference": {
      "id": "new-ref",
      "type": "note",
      "content": "Some note",
      "title": "My Note",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "total": 6
  }
}
```

### PATCH /api/products/[id]/references

**修改前：**
```json
{
  "success": true
}
```

**修改後：**
```json
{
  "success": true,
  "data": {
    "message": "Reference updated successfully"
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

### DELETE /api/products/[id]/references

**修改前：**
```json
{
  "success": true
}
```

**修改後：**
```json
{
  "success": true,
  "data": {
    "message": "Reference deleted successfully"
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

## ✅ 測試步驟

### 1. 啟動 API 服務器

```bash
cd api
npm run dev
```

### 2. 測試 Web 前端

```bash
cd web
npm run dev
```

訪問 http://localhost:3000/dashboard，測試以下功能：
- [ ] 開啟任一 Product 的「相關資料」頁籤
- [ ] 確認 references 列表正常顯示
- [ ] 新增一個 URL 類型的 reference
- [ ] 新增一個 Note 類型的 reference
- [ ] 編輯一個 reference
- [ ] 刪除一個 reference
- [ ] 檢查瀏覽器 Console 沒有錯誤

### 3. 測試 Flutter App

```bash
cd app
flutter run
```

測試以下功能：
- [ ] 進入任一 Project 詳情頁
- [ ] 點擊「相關資料」按鈕
- [ ] 確認 references 列表正常顯示（包含來自 product 和 task 的 references）
- [ ] 新增一個 reference
- [ ] 刪除一個 reference
- [ ] 檢查 App 沒有 crash 或錯誤提示

## 🐛 預期結果

### ✅ 成功指標

1. **Web 前端**：
   - 所有 reference 操作（載入、新增、編輯、刪除）正常運作
   - Console 沒有「type 'Null' is not a subtype」相關錯誤
   - UI 正常顯示 reference 數量和內容

2. **Flutter App**：
   - References 列表正常載入並顯示
   - 新增和刪除操作成功
   - 沒有「Exception: type 'Null' is not a subtype of type List<dynamic>」錯誤

3. **API 後端**：
   - 所有回應符合統一的 `ApiResponseBuilder` 格式
   - 錯誤處理統一使用 `catchDomainException`
   - 回應包含 `success`, `data`, `meta` 欄位

## 🔍 除錯提示

如果遇到問題：

1. **檢查 API 回應格式**：
   ```bash
   # 在瀏覽器 Network tab 檢查 API 回應
   # 應該看到 { success: true, data: {...}, meta: {...} }
   ```

2. **檢查前端解析邏輯**：
   ```js
   // Web: 確認使用 data.data?.references
   // Flutter: 確認使用 response.data['data']['references']
   ```

3. **查看錯誤訊息**：
   - Web: 瀏覽器 Console
   - Flutter: Android Logcat 或 iOS Console
   - API: 終端機 server logs
