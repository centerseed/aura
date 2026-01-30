import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../core/di/providers.dart' as providers;

// 從統一的 providers 中導出 authRepositoryProvider
final authRepositoryProvider = providers.authRepositoryProvider;

final authStateProvider = StreamProvider<User?>((ref) {
  return ref.watch(authRepositoryProvider).authStateChanges;
});

final currentUserProvider = Provider<User?>((ref) {
  return ref.watch(authStateProvider).valueOrNull;
});

final isAuthenticatedProvider = Provider<bool>((ref) {
  // 這裡我們需要小心，只有當 authState 確實有值且不為空時才算已授權
  // 如果是 loading 狀態，應該不算已授權（或者保持上一個狀態）
  // 但對於路由來說，我們通常使用 StreamProvider 的狀態來決定
  final authState = ref.watch(authStateProvider);
  return authState.valueOrNull != null;
});
