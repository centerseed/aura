import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/cache/cache_config.dart';
import '../../core/di/providers.dart';
import '../../data/datasources/local/task_local_datasource.dart';
import '../../data/datasources/local/area_local_datasource.dart';
import '../../data/datasources/local/product_local_datasource.dart';
import '../../data/datasources/remote/api_client.dart';
import '../../domain/entities/task.dart';
import '../../domain/entities/area.dart';
import '../../domain/entities/product.dart';

// ==================== Cached State Model ====================

/// 快取狀態封裝
class CachedState<T> {
  final T? data;
  final DateTime? lastUpdated;
  final bool isLoading;
  final bool isFromCache;
  final String? errorMessage;

  const CachedState({
    this.data,
    this.lastUpdated,
    this.isLoading = false,
    this.isFromCache = false,
    this.errorMessage,
  });

  /// 快取是否過期
  bool get isStale {
    if (lastUpdated == null) return true;
    return DateTime.now().difference(lastUpdated!) >
        Duration(minutes: CacheConfig.cacheTtlMinutes);
  }

  /// 是否有資料
  bool get hasData => data != null;

  /// 是否有錯誤
  bool get hasError => errorMessage != null;

  CachedState<T> copyWith({
    T? data,
    DateTime? lastUpdated,
    bool? isLoading,
    bool? isFromCache,
    String? errorMessage,
    bool clearError = false,
  }) {
    return CachedState<T>(
      data: data ?? this.data,
      lastUpdated: lastUpdated ?? this.lastUpdated,
      isLoading: isLoading ?? this.isLoading,
      isFromCache: isFromCache ?? this.isFromCache,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

// ==================== Cached Tasks Provider ====================

/// 快取任務 Provider (StateNotifier)
class CachedTasksNotifier extends StateNotifier<CachedState<List<Task>>> {
  final TaskLocalDataSource _localDataSource;
  final ApiClient _apiClient;

  CachedTasksNotifier(this._localDataSource, this._apiClient)
      : super(const CachedState(isLoading: true)) {
    _initialize();
  }

  /// 初始化：先讀快取，再拉遠端
  Future<void> _initialize() async {
    try {
      // Step 1: 讀取本地快取
      final cachedTasks = await _localDataSource.getCachedTasks();
      final lastSync = _localDataSource.getLastSyncTime();

      if (cachedTasks.isNotEmpty) {
        // 立即顯示快取資料
        state = state.copyWith(
          data: _filterActiveTasks(cachedTasks),
          lastUpdated: lastSync,
          isFromCache: true,
          isLoading: true, // 仍在載入遠端
        );
      }

      // Step 2: 背景獲取遠端資料
      await _fetchRemote(silent: cachedTasks.isNotEmpty);
    } catch (e) {
      debugPrint('CachedTasksNotifier initialization error: $e');
      state = state.copyWith(
        isLoading: false,
        errorMessage: '初始化失敗: $e',
      );
    }
  }

  /// 從遠端獲取資料
  Future<void> _fetchRemote({bool silent = false}) async {
    try {
      if (!silent) {
        state = state.copyWith(isLoading: true, clearError: true);
      }

      final taskModels = await _apiClient.getTasks();
      final tasks = taskModels.map((m) => m.toEntity()).toList();

      // 儲存到本地快取
      await _localDataSource.cacheTasks(taskModels);

      // 更新狀態
      state = state.copyWith(
        data: _filterActiveTasks(tasks),
        lastUpdated: DateTime.now(),
        isLoading: false,
        isFromCache: false,
      );
    } catch (e) {
      debugPrint('CachedTasksNotifier fetch error: $e');
      state = state.copyWith(
        isLoading: false,
        errorMessage: '網路請求失敗: $e',
      );
    }
  }

  /// 強制刷新 (下拉刷新使用)
  Future<void> refresh() async {
    await _fetchRemote(silent: false);
  }

  /// 靜默刷新 (App 回前景使用)
  Future<void> silentRefresh() async {
    if (!state.isLoading) {
      await _fetchRemote(silent: true);
    }
  }

  /// 過濾非歸檔任務
  List<Task> _filterActiveTasks(List<Task> tasks) {
    return tasks.where((t) => t.status != TaskStatus.archive).toList();
  }

  /// 手動使快取失效
  Future<void> invalidateCache() async {
    await _localDataSource.clearCache();
    state = const CachedState(isLoading: true);
    await _initialize();
  }
}

/// Cached Tasks Provider 定義
final cachedActiveTasksProvider =
    StateNotifierProvider<CachedTasksNotifier, CachedState<List<Task>>>((ref) {
  final localDataSource = ref.watch(taskLocalDataSourceProvider);
  final apiClient = ref.watch(apiClientProvider);

  // keepAlive 防止頁面切換時銷毀
  ref.keepAlive();

  return CachedTasksNotifier(localDataSource, apiClient);
});

// ==================== Cached Areas Provider ====================

/// 快取領域 Provider (StateNotifier)
class CachedAreasNotifier extends StateNotifier<CachedState<List<Area>>> {
  final AreaLocalDataSource _localDataSource;
  final ApiClient _apiClient;

  CachedAreasNotifier(this._localDataSource, this._apiClient)
      : super(const CachedState(isLoading: true)) {
    _initialize();
  }

  Future<void> _initialize() async {
    try {
      final cachedAreas = await _localDataSource.getCachedAreas();
      final lastSync = _localDataSource.getLastSyncTime();

      if (cachedAreas.isNotEmpty) {
        state = state.copyWith(
          data: cachedAreas,
          lastUpdated: lastSync,
          isFromCache: true,
          isLoading: true,
        );
      }

      await _fetchRemote(silent: cachedAreas.isNotEmpty);
    } catch (e) {
      debugPrint('CachedAreasNotifier initialization error: $e');
      state = state.copyWith(
        isLoading: false,
        errorMessage: '初始化失敗: $e',
      );
    }
  }

  Future<void> _fetchRemote({bool silent = false}) async {
    try {
      if (!silent) {
        state = state.copyWith(isLoading: true, clearError: true);
      }

      final areaModels = await _apiClient.getAreas();
      final areas = areaModels.map((m) => m.toEntity()).toList();

      await _localDataSource.cacheAreas(areaModels);

      state = state.copyWith(
        data: areas,
        lastUpdated: DateTime.now(),
        isLoading: false,
        isFromCache: false,
      );
    } catch (e) {
      debugPrint('CachedAreasNotifier fetch error: $e');
      state = state.copyWith(
        isLoading: false,
        errorMessage: '網路請求失敗: $e',
      );
    }
  }

  Future<void> refresh() async {
    await _fetchRemote(silent: false);
  }

  Future<void> silentRefresh() async {
    if (!state.isLoading) {
      await _fetchRemote(silent: true);
    }
  }

  Future<void> invalidateCache() async {
    await _localDataSource.clearCache();
    state = const CachedState(isLoading: true);
    await _initialize();
  }
}

/// Cached Areas Provider 定義
final cachedAreasProvider =
    StateNotifierProvider<CachedAreasNotifier, CachedState<List<Area>>>((ref) {
  final localDataSource = ref.watch(areaLocalDataSourceProvider);
  final apiClient = ref.watch(apiClientProvider);

  ref.keepAlive();

  return CachedAreasNotifier(localDataSource, apiClient);
});

// ==================== Cached Products Provider ====================

/// 快取產品 Provider (StateNotifier)
class CachedProductsNotifier extends StateNotifier<CachedState<List<Product>>> {
  final ProductLocalDataSource _localDataSource;
  final ApiClient _apiClient;

  CachedProductsNotifier(this._localDataSource, this._apiClient)
      : super(const CachedState(isLoading: true)) {
    _initialize();
  }

  Future<void> _initialize() async {
    try {
      final cachedProducts = await _localDataSource.getCachedProducts();
      final lastSync = _localDataSource.getLastSyncTime();

      if (cachedProducts.isNotEmpty) {
        state = state.copyWith(
          data: cachedProducts,
          lastUpdated: lastSync,
          isFromCache: true,
          isLoading: true,
        );
      }

      await _fetchRemote(silent: cachedProducts.isNotEmpty);
    } catch (e) {
      debugPrint('CachedProductsNotifier initialization error: $e');
      state = state.copyWith(
        isLoading: false,
        errorMessage: '初始化失敗: $e',
      );
    }
  }

  Future<void> _fetchRemote({bool silent = false}) async {
    try {
      if (!silent) {
        state = state.copyWith(isLoading: true, clearError: true);
      }

      final productModels = await _apiClient.getProducts();
      final products = productModels.map((m) => m.toEntity()).toList();

      await _localDataSource.cacheProducts(productModels);

      state = state.copyWith(
        data: products,
        lastUpdated: DateTime.now(),
        isLoading: false,
        isFromCache: false,
      );
    } catch (e) {
      debugPrint('CachedProductsNotifier fetch error: $e');
      state = state.copyWith(
        isLoading: false,
        errorMessage: '網路請求失敗: $e',
      );
    }
  }

  Future<void> refresh() async {
    await _fetchRemote(silent: false);
  }

  Future<void> silentRefresh() async {
    if (!state.isLoading) {
      await _fetchRemote(silent: true);
    }
  }

  Future<void> invalidateCache() async {
    await _localDataSource.clearCache();
    state = const CachedState(isLoading: true);
    await _initialize();
  }
}

/// Cached Products Provider 定義
final cachedProductsProvider = StateNotifierProvider<CachedProductsNotifier,
    CachedState<List<Product>>>((ref) {
  final localDataSource = ref.watch(productLocalDataSourceProvider);
  final apiClient = ref.watch(apiClientProvider);

  ref.keepAlive();

  return CachedProductsNotifier(localDataSource, apiClient);
});
