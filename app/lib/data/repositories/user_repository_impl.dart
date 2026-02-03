import 'package:dartz/dartz.dart';
import '../../core/errors/dio_error_handler.dart';
import '../../core/errors/failures.dart';
import '../../domain/entities/user.dart';
import '../../domain/entities/user_statistics.dart';
import '../../domain/entities/user_settings.dart';
import '../../domain/repositories/user_repository.dart';
import '../datasources/remote/api_client.dart';
import '../models/user_statistics_model.dart';

class UserRepositoryImpl implements UserRepository {
  final ApiClient _apiClient;

  UserRepositoryImpl(this._apiClient);

  @override
  Future<Either<Failure, User>> getCurrentUser() async {
    try {
      final response = await _apiClient.getCurrentUser();
      final userData = response['data']['user'] as Map<String, dynamic>;

      // 解析 settings (如果存在)
      Map<String, dynamic>? settings;
      if (userData['settings'] != null) {
        settings = userData['settings'] as Map<String, dynamic>;
      }

      final user = User(
        id: userData['id'] as String,
        email: userData['email'] as String,
        name: userData['name'] as String?,
        authProvider: userData['auth_provider'] as String,
        authProviderId: userData['auth_provider_id'] as String? ?? '',
        settings: settings,
        createdAt: userData['created_at'] != null
            ? DateTime.parse(userData['created_at'] as String)
            : null,
      );

      return Right(user);
    } catch (e) {
      return Left(handleDioError(e));
    }
  }

  @override
  Future<Either<Failure, UserStatistics>> getUserStatistics() async {
    try {
      final response = await _apiClient.getUserStatistics();
      final statsData = response['data']['statistics'] as Map<String, dynamic>;
      final statsModel = UserStatisticsModel.fromJson(statsData);
      return Right(statsModel.toEntity());
    } catch (e) {
      return Left(handleDioError(e));
    }
  }

  @override
  Future<Either<Failure, User>> updateProfile({required String name}) async {
    try {
      final response = await _apiClient.updateCurrentUser({'name': name});
      final userData = response['data']['user'] as Map<String, dynamic>;

      // 解析 settings (如果存在)
      Map<String, dynamic>? settings;
      if (userData['settings'] != null) {
        settings = userData['settings'] as Map<String, dynamic>;
      }

      final user = User(
        id: userData['id'] as String,
        email: userData['email'] as String,
        name: userData['name'] as String?,
        authProvider: userData['auth_provider'] as String,
        authProviderId: userData['auth_provider_id'] as String? ?? '',
        settings: settings,
        createdAt: userData['created_at'] != null
            ? DateTime.parse(userData['created_at'] as String)
            : null,
      );

      return Right(user);
    } catch (e) {
      return Left(handleDioError(e));
    }
  }

  @override
  Future<Either<Failure, User>> updateSettings({
    required UserSettings settings,
  }) async {
    try {
      final response = await _apiClient.updateCurrentUser({
        'settings': settings.toJson(),
      });
      final userData = response['data']['user'] as Map<String, dynamic>;

      // 解析 settings (如果存在)
      Map<String, dynamic>? userSettings;
      if (userData['settings'] != null) {
        userSettings = userData['settings'] as Map<String, dynamic>;
      }

      final user = User(
        id: userData['id'] as String,
        email: userData['email'] as String,
        name: userData['name'] as String?,
        authProvider: userData['auth_provider'] as String,
        authProviderId: userData['auth_provider_id'] as String? ?? '',
        settings: userSettings,
        createdAt: userData['created_at'] != null
            ? DateTime.parse(userData['created_at'] as String)
            : null,
      );

      return Right(user);
    } catch (e) {
      return Left(handleDioError(e));
    }
  }
}
