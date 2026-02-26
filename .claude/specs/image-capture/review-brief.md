# Review Brief: image-capture

## What Was Built
在 Flutter App 的 CaptureScreen 新增圖片輸入功能，讓使用者可透過相機拍照或相簿選取圖片，以 multipart/form-data 上傳至 `/api/brain-dump`，由後端 AI 圖片理解自動建立任務。實作遵循 Clean Architecture（Domain → Data → Presentation），新增了 `image_picker` 套件，擴展了 Repository interface、ApiClient、CaptureScreen UI。

## AC Status
- [x] AC1: CaptureScreen 輸入列旁新增相機/相簿按鈕（圓形 `camera_alt_outlined` 圖示），點擊後彈出 bottom sheet 選擇相機或相簿
- [x] AC2: 選取圖片後在輸入列上方顯示 120px 高度的預覽縮圖，TextField hint 變為「補充說明（可選）...」
- [x] AC3: 提交圖片時以 `multipart/form-data` 格式上傳至 `/brain-dump`，包含 `image` 檔案、可選 `text` 欄位、`input_type` 欄位
- [x] AC4: 圖片上傳中顯示與文字提交一致的 CircularProgressIndicator（send 按鈕內）
- [x] AC5: API 回應後使用既有 `_mapResponse` 解析 `createNewTasks` / `appendSubItem`，顯示 brain dump results sheet
- [x] AC6: 預覽縮圖右上角有 X 按鈕可移除已選圖片
- [x] AC7: 圖片大小限制 10MB、格式限制 jpg/jpeg/png/webp，超出時顯示 SnackBar 錯誤提示
- [x] AC8: iOS `Info.plist` 已包含 `NSCameraUsageDescription` 和 `NSPhotoLibraryUsageDescription`
- [x] AC9: 純圖片（text 為空）和圖片+文字兩種模式都能正確提交（通過 `input_type` 欄位區分）

## Key Decisions
- **Decision 1**: 將 `BrainDumpRepositoryImpl` 的 response mapping 邏輯抽取為 `_mapResponse()` 共用方法，避免 `submit` 和 `submitWithImage` 重複代碼
- **Decision 2**: 圖片選擇使用 bottom sheet（相機/相簿二選一）而非直接放兩個按鈕，保持輸入列簡潔
- **Decision 3**: Dio 的 `DioMediaType.parse(mimeType)` 設定 content-type，由 Repository 層的 `_getMimeType()` 根據副檔名判斷 MIME type
- **Decision 4**: 圖片模式下不套用 `#ProductName` 前綴策略（後端圖片理解會自行分類），文字模式維持原有行為

## Changed Files
- `app/pubspec.yaml` — 新增 `image_picker: ^1.1.2` dependency
- `app/ios/Runner/Info.plist` — 新增 `NSCameraUsageDescription` 和 `NSPhotoLibraryUsageDescription` 權限描述
- `app/lib/domain/repositories/brain_dump_repository.dart` — Repository interface 新增 `submitWithImage({required File, String text})` 方法
- `app/lib/data/datasources/remote/api_client.dart` — 新增 `brainDumpWithImage()` 方法，使用 Dio FormData multipart upload
- `app/lib/data/repositories/brain_dump_repository_impl.dart` — 實作 `submitWithImage`，抽取 `_mapResponse()` 和 `_getMimeType()` 共用方法
- `app/lib/presentation/screens/capture/capture_screen.dart` — 新增圖片相關 UI（選取按鈕、預覽、移除）和提交邏輯

## Known Risks / Reviewer Focus Areas
- **Area 1**: `_getMimeType()` 是純副檔名判斷，若 `image_picker` 回傳的檔案副檔名異常可能導致 MIME type 不正確（fallback 為 `image/jpeg`）
- **Area 2**: 圖片模式下未套用 `#ProductName` 前綴策略，依賴後端 AI 自動分類。如果後端圖片理解不支援 product 指定，可能需要調整
- **Area 3**: `imageQuality: 85` 壓縮品質在 `image_picker` 層面執行，但最終檔案大小仍可能接近 10MB 限制

## Verification Commands Run
```bash
flutter pub get          # result: PASS — image_picker 1.2.1 installed
flutter analyze (changed files)  # result: PASS — 0 errors, 0 warnings, only pre-existing info-level withOpacity deprecations
```

Note: Full iOS build (`flutter build ios`) not run locally — requires Xcode codesigning. Code compiles cleanly via static analysis.

---

## Review Report Fixes (Round 2)

### What Was Fixed
根據 `review-report.md` 審查結果修復 3 個問題。

### Fix Status
- [x] 🟡 Info.plist UIDeviceFamily 限制已還原（移除 iPhone-only 限制，恢復 iPad 支援）
- [x] 🟢 圖片 UI 4 處硬編碼顏色改為 theme colors（`inverseSurface`/`onSurface` + `withValues(alpha:)`）
- [x] 🟢 `submitWithImage` 的 `text` 參數加上 `= ''` 預設值

### Changed Files
- `app/ios/Runner/Info.plist` — 移除不相關的 UIDeviceFamily 限制（4 行刪除）
- `app/lib/presentation/screens/capture/capture_screen.dart` — 4 處顏色改為 theme-aware
- `app/lib/domain/repositories/brain_dump_repository.dart` — `text` 參數加 `= ''`

### Verification
```bash
flutter analyze  # result: 17 info (all pre-existing), 0 errors, 0 warnings
```
