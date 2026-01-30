import 'package:dartz/dartz.dart' hide Task;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/di/providers.dart';
import '../../core/errors/failures.dart';
import '../../domain/entities/task.dart';
import '../../application/use_cases/update_sub_item_use_case.dart';

/// 活躍任務 Provider (使用 Use Case)
final activeTasksProvider =
    FutureProvider.autoDispose<Either<Failure, List<Task>>>((ref) async {
  final useCase = ref.watch(getActiveTasksUseCaseProvider);
  return await useCase.call();
});

/// 今日完成的任務 Provider (使用 Use Case)
final completedTodayTasksProvider =
    FutureProvider.autoDispose<Either<Failure, List<Task>>>((ref) async {
  final useCase = ref.watch(getCompletedTodayTasksUseCaseProvider);
  return await useCase.call();
});

/// Daily Progress 數據類
class DailyProgress {
  final int completed;
  final int total;
  DailyProgress({required this.completed, required this.total});
}

/// 每日進度 Provider
final dailyProgressProvider = Provider.autoDispose<DailyProgress>((ref) {
  final completedAsync = ref.watch(completedTodayTasksProvider);
  final activeAsync = ref.watch(activeTasksProvider);

  final completed = completedAsync.valueOrNull
          ?.fold((l) => 0, (tasks) => tasks.length) ??
      0;

  // Active Today includes ONLY Due Today (to match Web logic, excluding Overdue)
  int activeToday = 0;
  if (activeAsync.hasValue) {
    activeAsync.value?.fold(
      (l) => 0,
      (tasks) => activeToday = tasks.where((t) => t.isToday).length,
    );
  }

  return DailyProgress(completed: completed, total: completed + activeToday);
});

/// 今日完成數量 Provider (derived)
final completedTodayCountProvider = Provider.autoDispose<int>((ref) {
  final tasksAsync = ref.watch(completedTodayTasksProvider);
  return tasksAsync.maybeWhen(
    data: (either) => either.fold((l) => 0, (tasks) => tasks.length),
    orElse: () => 0,
  );
});

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
        // Refresh the list to reflect changes
        // ignore: unused_result
        _ref.refresh(activeTasksProvider);
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
