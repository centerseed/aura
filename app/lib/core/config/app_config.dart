import 'package:flutter/foundation.dart';

class AppConfig {
  /// API Base URL
  /// Production: Cloud Run URL
  /// Debug: localhost for development
  static String get apiBaseUrl {
    if (kDebugMode) {
      // 本地開發環境
      return 'http://localhost:3002/api';
    }
    // 生產環境: Cloud Run
    return 'https://zentropy-api-894512935237.asia-east1.run.app/api';
  }

  /// API Timeout in seconds
  static const int apiTimeout = 30;

  /// Is Debug Mode
  static bool get isDebugMode => kDebugMode;
}
