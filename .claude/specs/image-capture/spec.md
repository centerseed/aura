# Spec: image-capture

## Goal
讓使用者可以從相機拍照或相簿選取圖片，透過 AI 圖片理解自動建立任務及子任務。

## Context
- **後端已完整支援**：`api/src/app/api/brain-dump/route.ts` 已支援 `multipart/form-data` 圖片上傳
- **圖片理解已就緒**：`api/src/lib/image-understanding.ts` 使用 Gemini 2.5 Flash multimodal 從圖片萃取結構化任務
- **App 端完全缺失**：Flutter App 目前無 `image_picker` 套件、無圖片上傳功能
- Dependencies: `image_picker` Flutter 套件、`dio` multipart upload
- Architecture layer: **data** (ApiClient) + **domain** (Repository interface) + **presentation** (CaptureScreen UI)

## Acceptance Criteria

- [ ] AC1: CaptureScreen 輸入列旁新增相機/相簿按鈕，點擊後呼叫系統相機或相簿選取器
- [ ] AC2: 選取圖片後顯示圖片預覽縮圖，使用者可在預覽狀態追加補充文字
- [ ] AC3: 提交圖片時以 `multipart/form-data` 格式上傳至 `/api/brain-dump`，包含 `image` 檔案和可選 `text` 欄位
- [ ] AC4: 圖片上傳中顯示載入狀態（與現有文字提交一致的 processing indicator）
- [ ] AC5: API 回應後正確解析 `create_new_tasks` 或 `append_sub_item` 結果，顯示 brain dump results sheet
- [ ] AC6: 使用者可在提交前移除已選圖片（取消選擇）
- [ ] AC7: 圖片大小限制 10MB，格式限制 JPEG/PNG/WebP，超出時顯示錯誤提示
- [ ] AC8: iOS `Info.plist` 已包含相機和相簿權限描述（`NSCameraUsageDescription`、`NSPhotoLibraryUsageDescription`）
- [ ] AC9: 純圖片（無文字）和圖片+文字兩種模式都能正確提交

## Out of Scope
- 多張圖片同時上傳（本期只支援單張）
- 圖片裁切/編輯功能
- 圖片本地快取或離線佇列
- API 端圖片理解邏輯修改（後端已完整，不需改動）
- Android 端權限設定（後續處理）

## Files Expected to Change

### Flutter App
- `app/pubspec.yaml` — 新增 `image_picker` dependency
- `app/lib/domain/repositories/brain_dump_repository.dart` — Repository interface 新增 `submitWithImage` 方法
- `app/lib/data/repositories/brain_dump_repository_impl.dart` — 實作 `submitWithImage`，使用 Dio multipart upload
- `app/lib/data/datasources/remote/api_client.dart` — 新增 `brainDumpWithImage` 方法（`MultipartFile` 上傳）
- `app/lib/presentation/screens/capture/capture_screen.dart` — UI 新增圖片按鈕、預覽、提交邏輯
- `app/ios/Runner/Info.plist` — 新增 `NSCameraUsageDescription`、`NSPhotoLibraryUsageDescription`

### 不需要修改
- `app/lib/data/models/brain_dump_models.dart` — Response 格式不變，不需改動
- `api/` 下所有檔案 — API 已完整支援 multipart/form-data + 圖片理解

## Files That Must NOT Change
- `api/src/app/api/brain-dump/route.ts` — 後端 brain-dump route 已完整，不可修改
- `api/src/lib/image-understanding.ts` — 圖片理解服務已就緒，不可修改
- `api/src/application/use-cases/brain-dump/*.ts` — 後端 use case 已完整，不可修改

## Technical Notes

### API 期望的 multipart/form-data 格式
```
POST /api/brain-dump
Content-Type: multipart/form-data

Fields:
  - image: File (required for image mode)
  - text: string (optional, supplementary text)
  - input_type: "image" | "image_with_text" (optional, auto-detected)
```

### Dio Multipart Upload 範例
```dart
final formData = FormData.fromMap({
  'image': await MultipartFile.fromFile(
    imagePath,
    contentType: MediaType('image', 'jpeg'),
  ),
  if (text.isNotEmpty) 'text': text,
  'input_type': text.isNotEmpty ? 'image_with_text' : 'image',
});
final response = await _dio.post('/brain-dump', data: formData);
```

### image_picker 使用方式
```dart
final picker = ImagePicker();
// 從相簿
final image = await picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
// 從相機
final image = await picker.pickImage(source: ImageSource.camera, imageQuality: 85);
```

### 圖片驗證規則（與後端一致）
- 最大檔案大小：10MB
- 允許格式：`image/jpeg`, `image/png`, `image/webp`
