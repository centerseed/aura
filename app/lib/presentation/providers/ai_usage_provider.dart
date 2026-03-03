import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/di/providers.dart' show apiClientProvider;

/// AI 每日用量 Provider
///
/// keepAlive 避免每次進入 Profile 頁面都重新 fetch
final aiUsageProvider =
    FutureProvider<({int used, int limit})>((ref) async {
  ref.keepAlive();
  final client = ref.watch(apiClientProvider);
  final res = await client.getAiUsage();
  // 使用 num.toInt() 避免 JSON decoder 回傳 double 導致 CastError
  return (
    used: (res['used'] as num).toInt(),
    limit: (res['limit'] as num).toInt(),
  );
});
