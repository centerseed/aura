# API 測試說明

## 測試框架

使用 **Vitest** 作為測試框架。

## 運行測試

```bash
# 運行所有測試
npm test

# 監聽模式（開發時使用）
npm run test:watch

# 測試 UI 介面
npm run test:ui

# 產生覆蓋率報告
npm run test:coverage
```

## 測試結構

```
tests/
├── setup.ts                  # 測試環境設定
├── unit/                     # 單元測試
│   └── use-cases/
│       ├── areas/
│       └── products/
└── integration/              # 整合測試
    └── api-response.test.ts
```

## 當前測試狀態

### ✅ 通過的測試 (16/22)

**API Response 整合測試**:
- ApiResponseBuilder 成功回應 ✓
- ApiResponseBuilder 錯誤回應 ✓
- ValidationException 測試 ✓
- ConflictException 測試 ✓
- catchDomainException 錯誤處理 ✓

**Use Case 驗證測試**:
- CreateAreaUseCase 基本驗證 ✓ (2/7)
- CreateProductUseCase 基本驗證 ✓ (4/5)

### ❌ 需要調整的測試 (6/22)

以下測試失敗是因為需要根據實際實作調整：

1. **NotFoundException 訊息格式** - 實際會加上 " not found" 後綴
2. **CreateAreaUseCase Mock** - 需要補充完整的 Prisma mock
3. **CreateProductUseCase Mock** - 缺少 findFirst mock

## 測試覆蓋範圍

目前已建立：
- ✅ 2 個 Use Case 的單元測試
- ✅ API Response 的整合測試
- ✅ Domain Exceptions 測試

未來可擴展：
- [ ] Tasks Use Cases 測試
- [ ] Milestones Use Cases 測試
- [ ] Auth Use Cases 測試
- [ ] E2E API 測試

## 注意事項

- 測試使用 Mock Prisma，不需要真實資料庫連接
- 環境變數在 `tests/setup.ts` 中設定
- 使用 `vi.mock()` 來模擬外部依賴
