import 'package:dartz/dartz.dart';
import '../../core/errors/failures.dart';
import '../entities/user.dart';
import '../entities/user_statistics.dart';
import '../entities/user_settings.dart';

abstract class UserRepository {
  /// 獲取當前用戶資料 (從後端)
  Future<Either<Failure, User>> getCurrentUser();

  /// 獲取用戶統計數據
  Future<Either<Failure, UserStatistics>> getUserStatistics();

  /// 更新用戶資料 (name)
  Future<Either<Failure, User>> updateProfile({
    required String name,
  });

  /// 更新用戶設定
  Future<Either<Failure, User>> updateSettings({
    required UserSettings settings,
  });
}
