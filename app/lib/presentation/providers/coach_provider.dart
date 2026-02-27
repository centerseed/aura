import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/di/providers.dart';
import '../../data/repositories/coach_repository_impl.dart';
import '../../domain/entities/coach_briefing.dart';
import '../../domain/entities/daily_plan.dart';
import '../../domain/repositories/coach_repository.dart';

// ==================== Repository Provider ====================

final coachRepositoryProvider = Provider<CoachRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return CoachRepositoryImpl(apiClient);
});

// ==================== State Classes ====================

class CoachBriefingState {
  final CoachBriefing? briefing;
  final DailyPlan? plan;
  final bool isLoading;
  final bool isGenerating;
  final bool isStale; // plan 是昨日的快取
  final bool isAutoGenerating; // 背景自動生成中
  final String? error;

  const CoachBriefingState({
    this.briefing,
    this.plan,
    this.isLoading = false,
    this.isGenerating = false,
    this.isStale = false,
    this.isAutoGenerating = false,
    this.error,
  });

  CoachBriefingState copyWith({
    CoachBriefing? briefing,
    DailyPlan? plan,
    bool? isLoading,
    bool? isGenerating,
    bool? isStale,
    bool? isAutoGenerating,
    String? error,
    bool clearError = false,
    bool clearBriefing = false,
    bool clearPlan = false,
  }) {
    return CoachBriefingState(
      briefing: clearBriefing ? null : (briefing ?? this.briefing),
      plan: clearPlan ? null : (plan ?? this.plan),
      isLoading: isLoading ?? this.isLoading,
      isGenerating: isGenerating ?? this.isGenerating,
      isStale: isStale ?? this.isStale,
      isAutoGenerating: isAutoGenerating ?? this.isAutoGenerating,
      error: clearError ? null : (error ?? this.error),
    );
  }

  bool get hasData => briefing != null || plan != null;
}

// ==================== Notifier ====================

class CoachBriefingNotifier extends StateNotifier<CoachBriefingState> {
  final CoachRepository _repository;
  final Ref _ref;

  CoachBriefingNotifier(this._repository, this._ref) : super(const CoachBriefingState());

  /// Generation counter：forceRefresh 時遞增，讓舊的 _autoGeneratePlan 知道結果已過時
  int _generation = 0;

  /// 根據時間自動判斷應該顯示晨報還是晚報
  BriefingType get currentBriefingType {
    final hour = DateTime.now().hour;
    return (hour >= 21) ? BriefingType.evening : BriefingType.morning;
  }

  /// 載入最新的 briefing + plan（三階段：今日 → 昨日快取 → 骨架屏+自動生成）
  Future<void> loadLatest({bool forceRefresh = false}) async {
    if (state.isLoading) return;
    if (state.isAutoGenerating && !forceRefresh) return;
    // 強制刷新時重置所有 stale 狀態（如跨日後恢復 app）
    // 遞增 generation，讓舊的 _autoGeneratePlan future 知道結果已過時
    if (state.isAutoGenerating && forceRefresh) {
      _generation++;
      state = const CoachBriefingState();
    }

    state = state.copyWith(isLoading: true, clearError: true);

    final type = currentBriefingType;

    // 並行載入 briefing 和今日 plan
    final results = await Future.wait([
      _repository.getLatestBriefing(type: type),
      _repository.getPlan(),
    ]);

    final briefingResult = results[0];
    final planResult = results[1];

    CoachBriefing? briefing;
    DailyPlan? plan;
    String? error;

    briefingResult.fold(
      (f) => error = f.message,
      (b) => briefing = b as CoachBriefing?,
    );

    planResult.fold(
      (f) => error ??= f.message,
      (p) => plan = p as DailyPlan?,
    );

    // 階段 1：今日有 plan → 直接用
    if (plan != null && plan!.items.isNotEmpty) {
      state = CoachBriefingState(
        briefing: briefing,
        plan: plan,
        error: error,
      );
      return;
    }

    // 階段 2：今日沒 plan → 查昨日
    final yesterday = DateTime.now().subtract(const Duration(days: 1));
    final yesterdayStr =
        '${yesterday.year}-${yesterday.month.toString().padLeft(2, '0')}-${yesterday.day.toString().padLeft(2, '0')}';
    final yesterdayResult = await _repository.getPlan(date: yesterdayStr);

    DailyPlan? yesterdayPlan;
    yesterdayResult.fold(
      (_) {},
      (p) => yesterdayPlan = p,
    );

    if (yesterdayPlan != null && yesterdayPlan!.items.isNotEmpty) {
      // 顯示昨日 plan 作為快取，同時背景自動生成今日 plan
      state = CoachBriefingState(
        briefing: briefing,
        plan: yesterdayPlan,
        isStale: true,
        isAutoGenerating: true,
        error: error,
      );
      _autoGeneratePlan(briefing);
      return;
    }

    // 階段 3：昨日也沒有 → 顯示骨架屏 + 自動生成
    state = CoachBriefingState(
      briefing: briefing,
      isAutoGenerating: true,
      error: error,
    );
    _autoGeneratePlan(briefing);
  }

  /// 背景自動生成 plan，完成後更新 state
  Future<void> _autoGeneratePlan(CoachBriefing? briefing) async {
    final myGeneration = _generation;
    final result = await _repository.generatePlan();

    // 若 forceRefresh 已重置 generation，丟棄過時的結果
    if (_generation != myGeneration) return;

    result.fold(
      (f) {
        state = state.copyWith(
          isAutoGenerating: false,
          isStale: false,
          error: f.message,
        );
      },
      (plan) => _finalizePlanGeneration(plan, myGeneration),
    );
  }

  /// plan 生成完成後，確保 briefing 與當前時段一致（防止保留舊的 evening briefing）
  Future<void> _finalizePlanGeneration(DailyPlan plan, int myGeneration) async {
    final currentType = currentBriefingType;
    CoachBriefing? freshBriefing;

    // 若 state.briefing 的 type 與當前時段相符，直接沿用（避免多餘 API 呼叫）
    if (state.briefing != null && state.briefing!.type == currentType) {
      freshBriefing = state.briefing;
    } else {
      // type 不符（e.g., 昨晚 evening → 今早 morning），重新 fetch 正確的 briefing
      final result = await _repository.getLatestBriefing(type: currentType);

      // 再次確認 generation，避免 getLatestBriefing 等待期間 forceRefresh 又介入
      if (_generation != myGeneration) return;

      result.fold((_) {}, (b) => freshBriefing = b);
    }

    state = CoachBriefingState(
      briefing: freshBriefing,
      plan: plan,
      isStale: false,
      isAutoGenerating: false,
    );
  }

  /// 手動生成新的 briefing
  Future<void> regenerateBriefing() async {
    if (state.isGenerating) return;
    state = state.copyWith(isGenerating: true, clearError: true);

    final type = currentBriefingType;
    final result = await _repository.generateBriefing(type: type);

    result.fold(
      (f) => state = state.copyWith(isGenerating: false, error: f.message),
      (briefing) => state = state.copyWith(
        briefing: briefing,
        isGenerating: false,
      ),
    );
  }

  /// 手動生成新的 plan
  Future<void> regeneratePlan() async {
    if (state.isGenerating) return;
    state = state.copyWith(isGenerating: true, clearError: true);

    final result = await _repository.generatePlan();

    result.fold(
      (f) => state = state.copyWith(isGenerating: false, error: f.message),
      (plan) => state = state.copyWith(
        plan: plan,
        isGenerating: false,
      ),
    );
  }

  /// 更新 plan item（標記完成/pin/defer）
  Future<void> updatePlanItem({
    required String itemId,
    bool? completed,
    bool? pinned,
    bool? deferred,
    String? status,
  }) async {
    final result = await _repository.updatePlanItem(
      itemId: itemId,
      completed: completed,
      pinned: pinned,
      deferred: deferred,
      status: status,
    );

    result.fold(
      (_) {},
      (_) {
        // 成功後重新載入 plan
        _repository.getPlan().then((r) {
          r.fold((_) {}, (plan) {
            if (plan != null) {
              state = state.copyWith(plan: plan);
            }
          });
        });
        // 觸發 task cache 刷新（plan item 完成會同步完成 task）
        final repo = _ref.read(taskUnifiedRepositoryProvider);
        repo.silentRefresh();
      },
    );
  }
}

// ==================== Providers ====================

final coachBriefingProvider =
    StateNotifierProvider<CoachBriefingNotifier, CoachBriefingState>((ref) {
  final repository = ref.watch(coachRepositoryProvider);
  return CoachBriefingNotifier(repository, ref);
});

/// 當前應顯示的 briefing 類型
final currentBriefingTypeProvider = Provider<BriefingType>((ref) {
  final hour = DateTime.now().hour;
  return (hour >= 21) ? BriefingType.evening : BriefingType.morning;
});
