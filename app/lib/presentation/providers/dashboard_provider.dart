import 'package:dartz/dartz.dart' hide Task;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/di/providers.dart';
import '../../core/errors/failures.dart';
import '../../domain/entities/area.dart';
import '../../domain/entities/product.dart';
import '../../domain/entities/task.dart';
import '../../domain/repositories/dashboard_repository.dart';

// ==================== Dashboard Data State ====================

/// Dashboard 資料狀態
class DashboardDataState {
  final List<Area>? areas;
  final List<Product>? products;
  final List<Task>? tasks;
  final List<Task>? completedToday;
  final bool isLoading;
  final String? error;

  const DashboardDataState({
    this.areas,
    this.products,
    this.tasks,
    this.completedToday,
    this.isLoading = false,
    this.error,
  });

  const DashboardDataState.loading()
      : areas = null,
        products = null,
        tasks = null,
        completedToday = null,
        isLoading = true,
        error = null;

  const DashboardDataState.error(String message)
      : areas = null,
        products = null,
        tasks = null,
        completedToday = null,
        isLoading = false,
        error = message;

  bool get hasData =>
      (areas != null && areas!.isNotEmpty) ||
      (products != null && products!.isNotEmpty);

  DashboardDataState copyWith({
    List<Area>? areas,
    List<Product>? products,
    List<Task>? tasks,
    List<Task>? completedToday,
    bool? isLoading,
    String? error,
  }) {
    return DashboardDataState(
      areas: areas ?? this.areas,
      products: products ?? this.products,
      tasks: tasks ?? this.tasks,
      completedToday: completedToday ?? this.completedToday,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

// ==================== Dashboard Provider ====================

/// Dashboard 資料 Provider
///
/// 使用統一的 Dashboard API，一次載入 Areas + Products
/// 解決 Cloud Run HTTP/1.1 請求序列化問題
///
/// 快取策略：使用 keepAlive 保持資料，切換 Tab 時不會重新載入
/// 手動刷新：使用 ref.invalidate(dashboardProvider) 強制重新載入
final dashboardProvider =
    FutureProvider.autoDispose<Either<Failure, DashboardData>>((ref) async {
  // 保持快取 5 分鐘，避免頻繁切換 Tab 時重複載入
  final link = ref.keepAlive();
  ref.onDispose(() {
    // Provider 被 dispose 時清理計時器
  });
  Future.delayed(const Duration(minutes: 5), link.close);

  final repository = ref.watch(dashboardRepositoryProvider);
  return await repository.getDashboard(
    include: 'areas,products',
  );
});

/// Dashboard Unwrapped Provider（便捷版本）
///
/// 直接返回 DashboardDataState，處理錯誤
final dashboardUnwrappedProvider =
    FutureProvider.autoDispose<DashboardDataState>((ref) async {
  final result = await ref.watch(dashboardProvider.future);
  return result.fold(
    (failure) => DashboardDataState.error(failure.message),
    (data) => DashboardDataState(
      areas: data.areas,
      products: data.products,
      tasks: data.tasks,
      completedToday: data.completedToday,
    ),
  );
});

/// Dashboard Areas Provider（從 Dashboard 取 Areas）
final dashboardAreasProvider =
    FutureProvider.autoDispose<Either<Failure, List<Area>>>((ref) async {
  final result = await ref.watch(dashboardProvider.future);
  return result.fold(
    (failure) => Left(failure),
    (data) => Right(data.areas ?? []),
  );
});

/// Dashboard Products Provider（從 Dashboard 取 Products）
final dashboardProductsProvider =
    FutureProvider.autoDispose<Either<Failure, List<Product>>>((ref) async {
  final result = await ref.watch(dashboardProvider.future);
  return result.fold(
    (failure) => Left(failure),
    (data) => Right(data.products ?? []),
  );
});
