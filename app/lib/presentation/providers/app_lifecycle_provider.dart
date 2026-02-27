import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_timezone/flutter_timezone.dart';

import 'package:flutter/material.dart' show DateUtils;

import '../../core/di/providers.dart';
import '../../data/repositories/unified/unified_repositories.dart';
import '../providers/coach_provider.dart';
import '../providers/task_provider.dart';

/// App 生命週期狀態
class AppLifecycleData {
  final DateTime? lastResumeTime;
  final DateTime? lastRefreshTime;
  final String? lastKnownTimezone;
  final DateTime? lastActiveDate;

  const AppLifecycleData({
    this.lastResumeTime,
    this.lastRefreshTime,
    this.lastKnownTimezone,
    this.lastActiveDate,
  });

  /// 是否應該刷新 (節流檢查 - 30秒)
  bool get shouldRefresh {
    if (lastRefreshTime == null) return true;
    return DateTime.now().difference(lastRefreshTime!) >
        const Duration(seconds: 30);
  }

  AppLifecycleData copyWith({
    DateTime? lastResumeTime,
    DateTime? lastRefreshTime,
    String? lastKnownTimezone,
    DateTime? lastActiveDate,
  }) {
    return AppLifecycleData(
      lastResumeTime: lastResumeTime ?? this.lastResumeTime,
      lastRefreshTime: lastRefreshTime ?? this.lastRefreshTime,
      lastKnownTimezone: lastKnownTimezone ?? this.lastKnownTimezone,
      lastActiveDate: lastActiveDate ?? this.lastActiveDate,
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

    // 檢查時區變更
    _checkTimezoneChange();

    final today = DateUtils.dateOnly(DateTime.now());
    final isNewDay = state.lastActiveDate == null || state.lastActiveDate != today;

    if (isNewDay) {
      debugPrint('[AppLifecycle] 🌅 New day detected, full refresh');
      _onDayChanged();
      state = state.copyWith(lastActiveDate: today);
    } else if (state.shouldRefresh) {
      _triggerSilentRefresh();
    }
  }

  /// 跨日偵測後的全面刷新
  void _onDayChanged() {
    _triggerSilentRefresh(forceRefresh: true);
    // invalidate 跨日失效的 providers
    _ref.invalidate(completedTodayTasksProvider);
  }

  /// 檢查時區是否變更,若變更則重新排程所有提醒
  Future<void> _checkTimezoneChange() async {
    try {
      final currentTimezone = await FlutterTimezone.getLocalTimezone();

      // 首次運行,儲存當前時區
      if (state.lastKnownTimezone == null) {
        state = state.copyWith(lastKnownTimezone: currentTimezone);
        debugPrint('[AppLifecycle] 初始時區: $currentTimezone');
        return;
      }

      // 檢查時區是否變更
      if (currentTimezone != state.lastKnownTimezone) {
        debugPrint('[AppLifecycle] 🌍 時區變更偵測: ${state.lastKnownTimezone} → $currentTimezone');

        // 執行重新排程所有提醒
        final rescheduleUseCase = _ref.read(rescheduleAllRemindersUseCaseProvider);
        await rescheduleUseCase();

        // 更新儲存的時區
        state = state.copyWith(lastKnownTimezone: currentTimezone);

        debugPrint('[AppLifecycle] ✅ 所有提醒已根據新時區重新排程');
      }
    } catch (e) {
      debugPrint('[AppLifecycle] ⚠️ 時區變更檢查失敗: $e');
    }
  }

  void _triggerSilentRefresh({bool forceRefresh = false}) {
    debugPrint('[AppLifecycle] Triggering silent refresh... forceRefresh=$forceRefresh');

    // 使用統一 Repository 觸發靜默刷新
    ((_ref.read(taskRepositoryProvider) as TaskUnifiedRepository))
        .silentRefresh();
    ((_ref.read(areaRepositoryProvider) as AreaUnifiedRepository))
        .silentRefresh();
    ((_ref.read(productRepositoryProvider) as ProductUnifiedRepository))
        .silentRefresh();

    // 刷新晨報/今日計劃（若今日尚未有資料則自動生成）
    _ref.read(coachBriefingProvider.notifier).loadLatest(forceRefresh: forceRefresh);

    // 確保 completedToday 也重新查詢
    _ref.invalidate(completedTodayTasksProvider);

    state = state.copyWith(lastRefreshTime: DateTime.now());
  }

  /// 手動觸發刷新 (用於特殊場景)
  void forceRefresh() {
    _triggerSilentRefresh(forceRefresh: true);
  }
}

/// App 生命週期 Provider
final appLifecycleProvider =
    StateNotifierProvider<AppLifecycleNotifier, AppLifecycleData>((ref) {
  ref.keepAlive();
  return AppLifecycleNotifier(ref);
});
