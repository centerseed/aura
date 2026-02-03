import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/di/providers.dart' as providers;
import '../../domain/entities/user.dart';
import '../../domain/entities/user_statistics.dart';
import '../../domain/entities/user_settings.dart';

// ==================== Repository Provider ====================

/// 從統一的 providers 中導出 userRepositoryProvider
final userRepositoryProvider = providers.userRepositoryProvider;

// ==================== User Statistics Provider ====================

/// 用戶統計數據 Provider
final userStatisticsProvider = FutureProvider<UserStatistics>((ref) async {
  final userRepo = ref.watch(userRepositoryProvider);
  final result = await userRepo.getUserStatistics();

  return result.fold(
    (failure) => throw Exception(failure.message),
    (statistics) => statistics,
  );
});

// ==================== Current User Data Provider ====================

/// 當前用戶資料 Provider (從後端獲取完整資料)
final currentUserDataProvider = FutureProvider<User>((ref) async {
  final userRepo = ref.watch(userRepositoryProvider);
  final result = await userRepo.getCurrentUser();

  return result.fold(
    (failure) => throw Exception(failure.message),
    (user) => user,
  );
});

// ==================== User Settings Provider ====================

/// 用戶設定 Provider
final userSettingsProvider = Provider<UserSettings?>((ref) {
  final userData = ref.watch(currentUserDataProvider);
  final user = userData.valueOrNull;

  if (user == null || user.settings == null) {
    return null;
  }

  try {
    return UserSettings.fromJson(user.settings!);
  } catch (e) {
    // 如果解析失敗，返回默認設定
    return null;
  }
});
