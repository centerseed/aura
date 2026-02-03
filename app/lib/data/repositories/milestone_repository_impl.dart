import 'package:dartz/dartz.dart';

import '../../core/errors/dio_error_handler.dart';
import '../../core/errors/failures.dart';
import '../../domain/entities/milestone.dart';
import '../../domain/repositories/milestone_repository.dart';
import '../datasources/remote/api_client.dart';

/// Milestone Repository 實作
class MilestoneRepositoryImpl implements MilestoneRepository {
  final ApiClient _apiClient;

  MilestoneRepositoryImpl(this._apiClient);

  @override
  Future<Either<Failure, List<Milestone>>> getMilestones() async {
    try {
      final milestoneModels = await _apiClient.getMilestones();
      final milestones =
          milestoneModels.map((model) => model.toEntity()).toList();
      return Right(milestones);
    } catch (e) {
      return Left(handleDioError(e));
    }
  }

  @override
  Future<Either<Failure, List<Milestone>>> getMilestonesByProduct(
    String productId,
  ) async {
    try {
      final milestoneModels = await _apiClient.getMilestones();
      final milestones = milestoneModels
          .where((model) =>
              model.entityType == 'PRODUCT' && model.entityId == productId)
          .map((model) => model.toEntity())
          .toList();
      return Right(milestones);
    } catch (e) {
      return Left(handleDioError(e));
    }
  }

  @override
  Future<Either<Failure, Milestone>> createMilestone({
    required String name,
    required DateTime targetDate,
    required MilestoneEntityType entityType,
    required String entityId,
    int? priority,
    String? description,
    MilestoneStatus? status,
  }) async {
    try {
      final body = <String, dynamic>{
        'name': name,
        'target_date': targetDate.toUtc().toIso8601String(),
        'entity_type': entityType.apiValue,
        'entity_id': entityId,
        if (priority != null) 'priority': priority,
        if (description != null && description.isNotEmpty)
          'description': description,
        if (status != null) 'status': status.apiValue,
      };

      final milestoneModel = await _apiClient.createMilestone(body);
      return Right(milestoneModel.toEntity());
    } catch (e) {
      return Left(handleDioError(e));
    }
  }

  @override
  Future<Either<Failure, Milestone>> updateMilestone({
    required String id,
    String? name,
    DateTime? targetDate,
    MilestoneEntityType? entityType,
    String? entityId,
    int? priority,
    String? description,
    MilestoneStatus? status,
  }) async {
    try {
      final body = <String, dynamic>{
        if (name != null) 'name': name,
        if (targetDate != null)
          'target_date': targetDate.toUtc().toIso8601String(),
        if (entityType != null) 'entity_type': entityType.apiValue,
        if (entityId != null) 'entity_id': entityId,
        if (priority != null) 'priority': priority,
        if (description != null) 'description': description,
        if (status != null) 'status': status.apiValue,
      };

      final milestoneModel = await _apiClient.updateMilestone(id, body);
      return Right(milestoneModel.toEntity());
    } catch (e) {
      return Left(handleDioError(e));
    }
  }

  @override
  Future<Either<Failure, void>> deleteMilestone(String id) async {
    try {
      await _apiClient.deleteMilestone(id);
      return const Right(null);
    } catch (e) {
      return Left(handleDioError(e));
    }
  }
}
