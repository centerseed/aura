import 'package:flutter/foundation.dart';
import '../debug/debug_config.dart';

class AppConfig {
  /// API Base URL
  /// Default: Cloud Run URL
  /// Local development: opt-in via `--dart-define=USE_LOCAL_API=true`
  static String get apiBaseUrl {
    if (kDebugMode && kUseLocalApi) {
      return 'http://localhost:3002/api';
    }
    return 'https://zentropy-api-894512935237.asia-east1.run.app/api';
  }

  /// API Timeout in seconds
  static const int apiTimeout = 30;

  /// Is Debug Mode
  static bool get isDebugMode => kDebugMode;
}
