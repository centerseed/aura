import 'package:flutter_dual_cache/flutter_dual_cache.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/di/providers.dart';
import '../../core/errors/failures.dart';
import '../../domain/entities/task.dart';
import '../../application/use_cases/update_sub_item_use_case.dart';
import 'dashboard_provider.dart';

// ==================== Cache-Based Task Providers ====================
// 這些 Providers 直接從 dual cache 獲取資料，支援：
// 1. 秒顯快取資料 (source=cache)
// 2. 背景網路刷新 (source=network)
// 3. 顯示刷新中狀態 (isLoading)

/// 任務快取狀態 Provider
///
/// 暴露完整的 CacheState，讓 UI 可以：
/// - 判斷資料來源 (isFromCache / isFromNetwork)
/// - 顯示刷新中指示器 (isLoading)
/// - 顯示上次更新時間 (lastUpdated)
final taskCacheStateProvider = Provider<AsyncValue<CacheState<List<Task>>>>((ref) {
  return ref.watch(cachedTasksStreamProvider);
});

/// 活躍任務 Provider (基於快取 Stream)
///
/// 只要快取有資料就立即返回，不會顯示 loading spinner
/// 過濾掉已歸檔的任務
final activeTasksProvider = Provider<TaskDataState>((ref) {
  final cacheAsync = ref.watch(cachedTasksStreamProvider);

  return cacheAsync.when(
    data: (cacheState) {
      if (cacheState.hasData) {
        final activeTasks = cacheState.data!
            .where((t) => t.status != TaskStatus.archive)
            .toList();
        return TaskDataState(
          tasks: activeTasks,
          isRefreshing: cacheState.isLoading,
          isFromCache: cacheState.isFromCache,
          lastUpdated: cacheState.lastUpdated,
          error: cacheState.hasError ? cacheState.errorMessage : null,
        );
      }
      // 無資料但正在載入
      if (cacheState.isLoading) {
        return const TaskDataState.loading();
      }
      // 無資料且有錯誤
      if (cacheState.hasError) {
        return TaskDataState.error(cacheState.errorMessage ?? '載入失敗');
      }
      // 初始狀態
      return const TaskDataState.loading();
    },
    loading: () => const TaskDataState.loading(),
    error: (e, _) => TaskDataState.error(e.toString()),
  );
});

/// 今日完成的任務 Provider (從 API 獲取)
///
/// 注意：由於 Task Entity 沒有 completedAt 屬性，
/// 無法從快取過濾今日完成的任務，需要從 API 查詢。
/// 這不影響首次載入體驗，因為主要內容由 activeTasksProvider 提供。
final completedTodayTasksProvider =
    FutureProvider.autoDispose<TaskDataState>((ref) async {
  final useCase = ref.watch(getCompletedTodayTasksUseCaseProvider);
  final result = await useCase.call();

  return result.fold(
    (failure) => TaskDataState.error(failure.message),
    (tasks) => TaskDataState(tasks: tasks),
  );
});

/// Daily Progress 數據類
class DailyProgress {
  final int completed;
  final int total;
  final bool isRefreshing;

  const DailyProgress({
    required this.completed,
    required this.total,
    this.isRefreshing = false,
  });

  double get percentage => total > 0 ? completed / total : 0.0;
}

/// 每日進度 Provider
final dailyProgressProvider = Provider<DailyProgress>((ref) {
  final activeState = ref.watch(activeTasksProvider);
  final completedAsync = ref.watch(completedTodayTasksProvider);

  // 從 FutureProvider 解包 completedToday
  final completed = completedAsync.maybeWhen(
    data: (state) => state.tasks?.length ?? 0,
    orElse: () => 0,
  );

  // Active Today includes ONLY Due Today (to match Web logic, excluding Overdue)
  int activeToday = 0;
  if (activeState.hasData) {
    activeToday = activeState.tasks!.where((t) => t.isToday).length;
  }

  return DailyProgress(
    completed: completed,
    total: completed + activeToday,
    isRefreshing: activeState.isRefreshing,
  );
});

/// 今日完成數量 Provider (derived)
final completedTodayCountProvider = Provider<int>((ref) {
  final completedAsync = ref.watch(completedTodayTasksProvider);
  return completedAsync.maybeWhen(
    data: (state) => state.tasks?.length ?? 0,
    orElse: () => 0,
  );
});

// ==================== Task Data State ====================

/// 任務資料狀態
///
/// 封裝任務列表的狀態，包含：
/// - tasks: 任務列表 (有資料時)
/// - isLoading: 是否初次載入中
/// - isRefreshing: 是否背景刷新中
/// - isFromCache: 資料是否來自快取
/// - lastUpdated: 上次更新時間
/// - error: 錯誤訊息
class TaskDataState {
  final List<Task>? tasks;
  final bool isLoading;
  final bool isRefreshing;
  final bool isFromCache;
  final DateTime? lastUpdated;
  final String? error;

  const TaskDataState({
    this.tasks,
    this.isLoading = false,
    this.isRefreshing = false,
    this.isFromCache = false,
    this.lastUpdated,
    this.error,
  });

  const TaskDataState.loading()
      : tasks = null,
        isLoading = true,
        isRefreshing = false,
        isFromCache = false,
        lastUpdated = null,
        error = null;

  TaskDataState.error(String message)
      : tasks = null,
        isLoading = false,
        isRefreshing = false,
        isFromCache = false,
        lastUpdated = null,
        error = message;

  /// 是否有資料
  bool get hasData => tasks != null;

  /// 是否有錯誤
  bool get hasError => error != null;

  /// 是否顯示 loading (初次載入且無快取)
  bool get showLoading => isLoading && !hasData;

  /// 是否顯示內容 (有資料)
  bool get showContent => hasData;

  /// 是否顯示刷新指示器 (有資料且正在刷新)
  bool get showRefreshIndicator => hasData && isRefreshing;
}

// ==================== Task Controller ====================

/// Task Controller 狀態
class TaskControllerState {
  final bool isLoading;
  final Failure? error;

  const TaskControllerState({
    this.isLoading = false,
    this.error,
  });

  TaskControllerState copyWith({
    bool? isLoading,
    Failure? error,
  }) {
    return TaskControllerState(
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

/// Task Controller (使用 Use Cases)
class TaskController extends StateNotifier<TaskControllerState> {
  final UpdateSubItemUseCase _updateSubItemUseCase;
  final Ref _ref;

  TaskController(this._updateSubItemUseCase, this._ref)
      : super(const TaskControllerState());

  /// 刷新任務快取
  Future<void> refresh() async {
    final repo = _ref.read(taskUnifiedRepositoryProvider);
    await repo.refresh();
  }

  /// 靜默刷新 (背景刷新，不顯示 loading)
  Future<void> silentRefresh() async {
    final repo = _ref.read(taskUnifiedRepositoryProvider);
    await repo.silentRefresh();
  }

  Future<void> updateSubItemStatus(
    Task task,
    String subItemId,
    bool completed,
  ) async {
    state = state.copyWith(isLoading: true, error: null);

    final result = await _updateSubItemUseCase.call(
      UpdateSubItemParams(
        taskId: task.id,
        subItemId: subItemId,
        completed: completed,
      ),
    );

    result.fold(
      (failure) {
        state = state.copyWith(isLoading: false, error: failure);
      },
      (success) {
        state = const TaskControllerState(isLoading: false);
        // 變更後觸發靜默刷新
        silentRefresh();
      },
    );
  }
}

/// Task Controller Provider
final taskControllerProvider =
    StateNotifierProvider<TaskController, TaskControllerState>((ref) {
  final updateSubItemUseCase = ref.watch(updateSubItemUseCaseProvider);
  return TaskController(updateSubItemUseCase, ref);
});

// ==================== Refresh Helpers ====================

/// 刷新任務快取的便捷方法
///
/// 用於 RefreshIndicator.onRefresh
/// 同時刷新 Task Cache 和 Dashboard，確保今日焦點和全視圖都顯示最新資料
Future<void> refreshTasks(WidgetRef ref) async {
  final repo = ref.read(taskUnifiedRepositoryProvider);
  await repo.refresh();
  // 同時刷新 Dashboard（用於 OverviewTab）
  ref.invalidate(dashboardProvider);
}

/// 靜默刷新任務快取
///
/// 用於變更操作後的背景刷新
/// 同時刷新 Task Cache 和 Dashboard，確保今日焦點和全視圖都顯示最新資料
Future<void> silentRefreshTasks(WidgetRef ref) async {
  final repo = ref.read(taskUnifiedRepositoryProvider);
  await repo.silentRefresh();
  // 同時刷新 Dashboard（用於 OverviewTab）
  ref.invalidate(dashboardProvider);
}
