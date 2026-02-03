import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/di/providers.dart';
import '../../core/errors/failures.dart';
import '../../domain/entities/milestone.dart';

/// 根據 Product ID 取得里程碑
///
/// 用法：
/// ```dart
/// final milestonesAsync = ref.watch(productMilestonesProvider(productId));
/// ```
final productMilestonesProvider =
    FutureProvider.autoDispose.family<List<Milestone>, String>(
  (ref, productId) async {
    final repository = ref.watch(milestoneRepositoryProvider);
    final result = await repository.getMilestonesByProduct(productId);

    return result.fold(
      (failure) => throw failure,
      (milestones) {
        // 按目標日期排序，最近的在前
        final sorted = List<Milestone>.from(milestones)
          ..sort((a, b) => a.targetDate.compareTo(b.targetDate));
        return sorted;
      },
    );
  },
);

/// 取得所有里程碑
final allMilestonesProvider =
    FutureProvider.autoDispose<List<Milestone>>((ref) async {
  final repository = ref.watch(milestoneRepositoryProvider);
  final result = await repository.getMilestones();

  return result.fold(
    (failure) => throw failure,
    (milestones) {
      // 按目標日期排序
      final sorted = List<Milestone>.from(milestones)
        ..sort((a, b) => a.targetDate.compareTo(b.targetDate));
      return sorted;
    },
  );
});

/// Milestone 操作狀態
class MilestoneControllerState {
  final bool isLoading;
  final Failure? error;

  const MilestoneControllerState({
    this.isLoading = false,
    this.error,
  });

  MilestoneControllerState copyWith({
    bool? isLoading,
    Failure? error,
  }) {
    return MilestoneControllerState(
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

/// Milestone Controller
///
/// 處理里程碑的 CRUD 操作
class MilestoneController extends StateNotifier<MilestoneControllerState> {
  final Ref _ref;

  MilestoneController(this._ref)
      : super(const MilestoneControllerState());

  /// 建立里程碑
  Future<Milestone?> createMilestone({
    required String name,
    required DateTime targetDate,
    required MilestoneEntityType entityType,
    required String entityId,
    int? priority,
    String? description,
  }) async {
    state = state.copyWith(isLoading: true, error: null);

    final repository = _ref.read(milestoneRepositoryProvider);
    final result = await repository.createMilestone(
      name: name,
      targetDate: targetDate,
      entityType: entityType,
      entityId: entityId,
      priority: priority,
      description: description,
    );

    return result.fold(
      (failure) {
        state = state.copyWith(isLoading: false, error: failure);
        return null;
      },
      (milestone) {
        state = state.copyWith(isLoading: false);
        // 刷新相關的 provider
        _ref.invalidate(allMilestonesProvider);
        _ref.invalidate(productMilestonesProvider(entityId));
        return milestone;
      },
    );
  }

  /// 更新里程碑
  Future<Milestone?> updateMilestone({
    required String id,
    required String entityId, // 用於刷新 provider
    String? name,
    DateTime? targetDate,
    MilestoneStatus? status,
    int? priority,
    String? description,
  }) async {
    state = state.copyWith(isLoading: true, error: null);

    final repository = _ref.read(milestoneRepositoryProvider);
    final result = await repository.updateMilestone(
      id: id,
      name: name,
      targetDate: targetDate,
      status: status,
      priority: priority,
      description: description,
    );

    return result.fold(
      (failure) {
        state = state.copyWith(isLoading: false, error: failure);
        return null;
      },
      (milestone) {
        state = state.copyWith(isLoading: false);
        // 刷新相關的 provider
        _ref.invalidate(allMilestonesProvider);
        _ref.invalidate(productMilestonesProvider(entityId));
        return milestone;
      },
    );
  }

  /// 刪除里程碑
  Future<bool> deleteMilestone({
    required String id,
    required String entityId, // 用於刷新 provider
  }) async {
    state = state.copyWith(isLoading: true, error: null);

    final repository = _ref.read(milestoneRepositoryProvider);
    final result = await repository.deleteMilestone(id);

    return result.fold(
      (failure) {
        state = state.copyWith(isLoading: false, error: failure);
        return false;
      },
      (_) {
        state = state.copyWith(isLoading: false);
        // 刷新相關的 provider
        _ref.invalidate(allMilestonesProvider);
        _ref.invalidate(productMilestonesProvider(entityId));
        return true;
      },
    );
  }

  /// 清除錯誤
  void clearError() {
    state = state.copyWith(error: null);
  }
}

/// Milestone Controller Provider
final milestoneControllerProvider =
    StateNotifierProvider<MilestoneController, MilestoneControllerState>(
  (ref) => MilestoneController(ref),
);
