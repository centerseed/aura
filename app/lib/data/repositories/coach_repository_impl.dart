import 'package:dartz/dartz.dart' hide Task;
import 'package:dio/dio.dart';

import '../../core/errors/failures.dart';
import '../../domain/entities/coach_briefing.dart';
import '../../domain/entities/daily_plan.dart';
import '../../domain/repositories/coach_repository.dart';
import '../datasources/remote/api_client.dart';

class CoachRepositoryImpl implements CoachRepository {
  final ApiClient _apiClient;

  CoachRepositoryImpl(this._apiClient);

  @override
  Future<Either<Failure, CoachBriefing?>> getLatestBriefing({
    BriefingType? type,
  }) async {
    try {
      final typeStr = type == BriefingType.morning
          ? 'MORNING'
          : type == BriefingType.evening
              ? 'EVENING'
              : null;
      final json = await _apiClient.getLatestBriefing(type: typeStr);
      if (json == null) return const Right(null);
      return Right(CoachBriefing.fromJson(json));
    } on DioException catch (e) {
      return Left(ServerFailure(
        e.response?.data?['error']?.toString() ?? '載入簡報失敗',
      ));
    }
  }

  @override
  Future<Either<Failure, CoachBriefing>> generateBriefing({
    BriefingType? type,
  }) async {
    try {
      final typeStr = type == BriefingType.morning
          ? 'MORNING'
          : type == BriefingType.evening
              ? 'EVENING'
              : null;
      final json = await _apiClient.generateBriefing(type: typeStr);
      return Right(CoachBriefing.fromJson(json));
    } on DioException catch (e) {
      return Left(ServerFailure(
        e.response?.data?['error']?.toString() ?? '生成簡報失敗',
      ));
    }
  }

  @override
  Future<Either<Failure, DailyPlan?>> getPlan({
    String? date,
    String? timezone,
  }) async {
    try {
      final json = await _apiClient.getPlan(date: date, timezone: timezone);
      if (json == null) return const Right(null);
      return Right(DailyPlan.fromJson(json));
    } on DioException catch (e) {
      return Left(ServerFailure(
        e.response?.data?['error']?.toString() ?? '載入計畫失敗',
      ));
    }
  }

  @override
  Future<Either<Failure, DailyPlan>> generatePlan({
    String? date,
    String? timezone,
  }) async {
    try {
      final json = await _apiClient.generatePlan(date: date, timezone: timezone);
      return Right(DailyPlan.fromJson(json));
    } on DioException catch (e) {
      return Left(ServerFailure(
        e.response?.data?['error']?.toString() ?? '生成計畫失敗',
      ));
    }
  }

  @override
  Future<Either<Failure, void>> updatePlanItem({
    required String itemId,
    bool? completed,
    bool? pinned,
    bool? deferred,
    String? status,
  }) async {
    try {
      final body = <String, dynamic>{};
      if (completed != null) body['completed'] = completed;
      if (pinned != null) body['pinned'] = pinned;
      if (deferred != null) body['deferred'] = deferred;
      if (status != null) body['status'] = status;
      await _apiClient.updatePlanItem(itemId, body);
      return const Right(null);
    } on DioException catch (e) {
      return Left(ServerFailure(
        e.response?.data?['error']?.toString() ?? '更新計畫項目失敗',
      ));
    }
  }
}
