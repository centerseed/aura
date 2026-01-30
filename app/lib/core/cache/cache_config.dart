/// 快取相關配置常數
class CacheConfig {
  CacheConfig._();

  /// 快取過期時間 (分鐘)
  static const int cacheTtlMinutes = 5;

  /// 背景刷新節流時間 (秒)
  static const int backgroundRefreshThrottleSeconds = 30;

  /// Hive Box 內部 Metadata Keys
  static const String lastSyncKey = '_metadata_last_sync';
}
