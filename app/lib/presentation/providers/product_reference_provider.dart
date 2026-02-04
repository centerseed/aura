import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_dual_cache/flutter_dual_cache.dart';
import '../../core/di/providers.dart' as providers;
import '../../domain/entities/reference.dart';

/// Product References Provider - 使用 Dual Cache 的 reference 列表
///
/// 使用 family 參數接收 productId，每個 product 有獨立的快取實例
///
/// 功能：
/// - 首次載入：立即顯示快取資料（如果有）
/// - 背景更新：同時從 API 獲取最新資料
/// - 自動刷新：資料更新後自動通知 UI
final productReferencesStreamProvider = StreamProvider.autoDispose
    .family<CacheState<List<Reference>>, String>((ref, productId) {
  final repository = ref.watch(providers.referenceCachedRepositoryProvider(productId));
  return repository.stream;
});

/// Unwrapped 版本 - 直接提供 `List<Reference>` 給 UI 使用
///
/// 優點：
/// - 有快取時立即顯示，無需等待
/// - 自動在背景更新資料
/// - 減少「轉圈圈」的等待時間
final productReferencesUnwrappedProvider = StreamProvider.autoDispose
    .family<List<Reference>, String>((ref, productId) async* {
  final repository = ref.watch(providers.referenceCachedRepositoryProvider(productId));

  // 訂閱 repository 的 stream 並轉換為 List<Reference>
  await for (final state in repository.stream) {
    yield state.data ?? [];
  }
});
