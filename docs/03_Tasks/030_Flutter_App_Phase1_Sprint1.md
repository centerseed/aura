# Task 030: Flutter App - Phase 1 Sprint 1 (專案初始化)

**目標**: 建立 Flutter 專案骨架與開發環境  
**預計時間**: Week 1 (5 個工作日)  
**依賴**: 後端 API 已就緒、Firebase 專案已建立

---

## 任務清單

### T030-1: 初始化 Flutter 專案 ✅
**預計時間**: 30 分鐘  
**執行者**: AI Agent

```bash
cd /Users/wubaizong/Naruvia
flutter create app --org com.zentropy --platforms ios,android
cd app
```

**交付物**:
- [ ] Flutter 專案創建成功
- [ ] 可以執行 `flutter run`
- [ ] iOS/Android 配置正確

---

### T030-2: 安裝核心依賴
**預計時間**: 20 分鐘

**依賴清單** (pubspec.yaml):
```yaml
dependencies:
  flutter:
    sdk: flutter
  
  # 狀態管理
  riverpod: ^2.6.1
  flutter_riverpod: ^2.6.1
  
  # 路由
  go_router: ^14.0.0
  
  # 網路請求
  dio: ^5.7.0
  retrofit: ^4.4.0
  
  # 本地存儲
  hive: ^2.2.3
  hive_flutter: ^1.1.0
  
  # Firebase
  firebase_core: ^3.8.1
  firebase_auth: ^5.3.3
  
  # UI
  flutter_svg: ^2.0.10
  cached_network_image: ^3.4.1
  shimmer: ^3.0.0
  
  # 工具
  freezed_annotation: ^2.4.4
  json_annotation: ^4.9.0
  get_it: ^8.0.2
  dartz: ^0.10.1

dev_dependencies:
  flutter_test:
    sdk: flutter
  
  # 代碼生成
  build_runner: ^2.4.13
  freezed: ^2.5.7
  json_serializable: ^6.8.0
  retrofit_generator: ^9.1.4
  
  # 代碼品質
  flutter_lints: ^5.0.0
  mockito: ^5.4.4
```

**交付物**:
- [ ] 所有依賴安裝成功
- [ ] `flutter pub get` 無錯誤

---

### T030-3: 建立 Clean Architecture 目錄結構
**預計時間**: 15 分鐘

**目錄結構**:
```
lib/
├── main.dart
├── app.dart
├── core/
│   ├── config/
│   ├── constants/
│   ├── di/
│   ├── errors/
│   └── utils/
├── domain/
│   ├── entities/
│   ├── repositories/
│   └── usecases/
├── data/
│   ├── models/
│   ├── datasources/
│   │   ├── remote/
│   │   └── local/
│   └── repositories/
└── presentation/
    ├── routes/
    ├── providers/
    ├── screens/
    └── widgets/
```

**交付物**:
- [ ] 所有目錄創建完成
- [ ] 每個目錄有 `.gitkeep` 文件

---

### T030-4: 配置 Firebase
**預計時間**: 30 分鐘

**步驟**:
1. 安裝 FlutterFire CLI
2. 執行 `flutterfire configure`
3. 下載配置文件到正確位置

**交付物**:
- [ ] `android/app/google-services.json`
- [ ] `ios/Runner/GoogleService-Info.plist`
- [ ] `lib/firebase_options.dart`
- [ ] Firebase 初始化代碼完成

---

### T030-5: 建立基礎配置文件
**預計時間**: 30 分鐘

**文件清單**:
- [ ] `lib/core/config/app_config.dart` - 環境配置
- [ ] `lib/core/constants/api_endpoints.dart` - API 端點
- [ ] `lib/core/errors/failures.dart` - 錯誤類型
- [ ] `lib/core/di/injection.dart` - 依賴注入

**交付物**:
- [ ] 所有配置文件創建完成
- [ ] API URL 可在開發/生產環境切換

---

### T030-6: 建立基礎 Entity 與 Model
**預計時間**: 1 小時

**實體清單**:
- [ ] `domain/entities/user.dart`
- [ ] `domain/entities/task.dart`
- [ ] `domain/entities/area.dart`
- [ ] `domain/entities/product.dart`

**模型清單**:
- [ ] `data/models/user_model.dart`
- [ ] `data/models/task_model.dart`
- [ ] `data/models/area_model.dart`
- [ ] `data/models/product_model.dart`

**交付物**:
- [ ] 使用 Freezed 定義所有 Models
- [ ] 代碼生成成功 (`build_runner`)

---

### T030-7: 建立 API Client
**預計時間**: 1 小時

**文件**:
- [ ] `data/datasources/remote/api_client.dart`
- [ ] `core/network/auth_interceptor.dart`

**功能**:
- [ ] Retrofit API Client 定義
- [ ] Dio 攔截器（自動添加 Firebase Token）
- [ ] 錯誤處理攔截器

**交付物**:
- [ ] API Client 可編譯
- [ ] 攔截器邏輯正確

---

### T030-8: 驗證編譯與運行
**預計時間**: 20 分鐘

**檢查項目**:
```bash
# 分析代碼
flutter analyze

# 運行測試
flutter test

# iOS 編譯
flutter build ios --debug --no-codesign

# Android 編譯
flutter build apk --debug
```

**交付物**:
- [ ] `flutter analyze` 無警告
- [ ] `flutter test` 通過
- [ ] iOS/Android 編譯成功

---

## 驗收標準

- ✅ Flutter 專案可以運行
- ✅ Firebase 配置完成
- ✅ Clean Architecture 目錄結構建立
- ✅ 基礎 Models 與 API Client 定義完成
- ✅ 無編譯錯誤和警告

---

## 下一步

完成後進入 **Sprint 2: 認證流程實現**
