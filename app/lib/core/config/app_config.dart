import 'package:flutter/foundation.dart';

class AppConfig {
  /// API Base URL
  /// Production: Cloud Run URL
  /// Debug: localhost for development
  static String get apiBaseUrl {
    if (kDebugMode) {
      return 'http://localhost:3002/api';
    }
    return 'https://zentropy-api-894512935237.asia-east1.run.app/api';
  }

  /// API Timeout in seconds
  static const int apiTimeout = 30;

  /// Is Debug Mode
  static bool get isDebugMode => kDebugMode;
}
