import 'package:flutter/foundation.dart';

/// 應用配置類
/// 處理環境變數與 API 端點配置
class AppConfig {
  // 私有構造函數
  AppConfig._();

  /// 環境類型 (根據編譯模式自動判斷)
  static Environment get environment {
    if (kDebugMode) {
      return Environment.development;
    } else if (kReleaseMode) {
      return Environment.production;
    } else {
      // kProfileMode
      return Environment.staging;
    }
  }

  /// API Base URL (後端已拆分為獨立 API 服務)
  static String get apiBaseUrl {
    switch (environment) {
      case Environment.development:
        return 'http://localhost:3001'; // 本地開發環境
      case Environment.staging:
        return 'https://zentropy-api-894512935237.asia-east1.run.app';
      case Environment.production:
        return 'https://zentropy-api-894512935237.asia-east1.run.app';
    }
  }

  /// Firebase 專案 ID
  static const String firebaseProjectId = 'zentropy-4f7a5';

  /// App 名稱
  static const String appName = 'Zentropy';

  /// App 版本
  static const String appVersion = '1.0.0';

  /// 是否啟用 Debug 模式
  static bool get isDebugMode => environment == Environment.development;

  /// API 超時時間（秒）
  static const int apiTimeout = 30;

  /// 本地數據同步間隔（分鐘）
  static const int syncIntervalMinutes = 15;
}

/// 環境枚舉
enum Environment { development, staging, production }
