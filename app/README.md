# Zentropy Flutter App - 快速啟動指南

## 📋 環境要求

- Flutter SDK: ≥ 3.24.0
- Dart SDK: ≥ 3.10.0
- iOS: Xcode 15+, CocoaPods
- Android: Android Studio, JDK 17+

---

## 🚀 首次運行

### 1. 安裝依賴
```bash
cd /Users/wubaizong/Naruvia/app
flutter pub get
```

### 2. 生成代碼 (如果有更改 Models)
```bash
dart run build_runner build --delete-conflicting-outputs
```

### 3. 運行應用

**Web (開發推薦)**:
```bash
flutter run -d chrome
```

**iOS 模擬器**:
```bash
flutter run -d "iPhone 15 Pro"
```

**Android 模擬器**:
```bash
flutter run -d emulator
```

---

## 🔧 開發工具

### 代碼檢查
```bash
flutter analyze
```

### 運行測試
```bash
flutter test
```

### 生成代碼 (監聽模式)
```bash
dart run build_runner watch
```

---

## 📦 專案結構導覽

### 主要目錄說明

```
lib/
├── main.dart                # 應用入口
├── core/                    # 核心層
│   ├── config/             # 配置 (API URL, 環境變數)
│   ├── constants/          # 常量 (API 端點)
│   ├── di/                 # 依賴注入 (GetIt)
│   ├── network/            # 網路層 (Dio 攔截器)
│   └── errors/             # 錯誤定義
├── domain/                  # 領域層 (業務邏輯)
│   ├── entities/           # 實體 (純 Dart 類別)
│   ├── repositories/       # Repository 介面
│   └── usecases/           # 使用案例
├── data/                    # 資料層
│   ├── models/             # Freezed Models (API 響應)
│   ├── datasources/        # 數據源
│   │   ├── remote/         # API Client
│   │   └── local/          # Hive 本地存儲
│   └── repositories/       # Repository 實現
└── presentation/            # 表現層 (UI)
    ├── routes/             # GoRouter 路由
    ├── providers/          # Riverpod Providers
    ├── screens/            # 頁面
    └── widgets/            # 共用組件
```

---

**查看 SPRINT_1_COMPLETION_REPORT.md 了解詳細完成狀態**

**Happy Coding! 🚀**
