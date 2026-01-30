import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/cache/cache_config.dart';
import 'cached_data_provider.dart';

/// App 生命週期狀態
class AppLifecycleData {
  final DateTime? lastResumeTime;
  final DateTime? lastRefreshTime;

  const AppLifecycleData({
    this.lastResumeTime,
    this.lastRefreshTime,
  });

  /// 是否應該刷新 (節流檢查)
  bool get shouldRefresh {
    if (lastRefreshTime == null) return true;
    return DateTime.now().difference(lastRefreshTime!) >
        Duration(seconds: CacheConfig.backgroundRefreshThrottleSeconds);
  }

  AppLifecycleData copyWith({
    DateTime? lastResumeTime,
    DateTime? lastRefreshTime,
  }) {
    return AppLifecycleData(
      lastResumeTime: lastResumeTime ?? this.lastResumeTime,
      lastRefreshTime: lastRefreshTime ?? this.lastRefreshTime,
    );
  }
}

/// 生命週期管理 Notifier
class AppLifecycleNotifier extends StateNotifier<AppLifecycleData>
    with WidgetsBindingObserver {
  final Ref _ref;

  AppLifecycleNotifier(this._ref) : super(const AppLifecycleData()) {
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _onAppResumed();
    }
  }

  void _onAppResumed() {
    state = state.copyWith(lastResumeTime: DateTime.now());

    if (state.shouldRefresh) {
      _triggerSilentRefresh();
    }
  }

  void _triggerSilentRefresh() {
    debugPrint('[AppLifecycle] Triggering silent refresh...');

    // 刷新所有快取 Provider
    _ref.read(cachedActiveTasksProvider.notifier).silentRefresh();
    _ref.read(cachedAreasProvider.notifier).silentRefresh();
    _ref.read(cachedProductsProvider.notifier).silentRefresh();

    state = state.copyWith(lastRefreshTime: DateTime.now());
  }

  /// 手動觸發刷新 (用於特殊場景)
  void forceRefresh() {
    _triggerSilentRefresh();
  }
}

/// App 生命週期 Provider
final appLifecycleProvider =
    StateNotifierProvider<AppLifecycleNotifier, AppLifecycleData>((ref) {
  ref.keepAlive();
  return AppLifecycleNotifier(ref);
});
