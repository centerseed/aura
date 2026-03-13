import 'package:flutter/foundation.dart';

/// Explicit local development flag.
///
/// Enable with:
/// `--dart-define=USE_LOCAL_API=true`
const bool kUseLocalApi = bool.fromEnvironment(
  'USE_LOCAL_API',
  defaultValue: false,
);

/// Debug auth bypass is only allowed in explicit local-dev mode.
const bool kDebugAuthBypass = kDebugMode && kUseLocalApi;

/// Debug mode 測試用的 user ID
const String kDebugUserId = 'HXa5Pnojnqe6z2eL80tGwkNZA5I3';
