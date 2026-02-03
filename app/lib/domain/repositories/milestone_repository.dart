import 'package:dartz/dartz.dart';

import '../../core/errors/failures.dart';
import '../entities/milestone.dart';

/// Milestone Repository 介面
abstract class MilestoneRepository {
  /// 取得所有里程碑
  Future<Either<Failure, List<Milestone>>> getMilestones();

  /// 根據 Product ID 取得里程碑
  Future<Either<Failure, List<Milestone>>> getMilestonesByProduct(
    String productId,
  );

  /// 建立里程碑
  Future<Either<Failure, Milestone>> createMilestone({
    required String name,
    required DateTime targetDate,
    required MilestoneEntityType entityType,
    required String entityId,
    int? priority,
    String? description,
    MilestoneStatus? status,
  });

  /// 更新里程碑
  Future<Either<Failure, Milestone>> updateMilestone({
    required String id,
    String? name,
    DateTime? targetDate,
    MilestoneEntityType? entityType,
    String? entityId,
    int? priority,
    String? description,
    MilestoneStatus? status,
  });

  /// 刪除里程碑
  Future<Either<Failure, void>> deleteMilestone(String id);
}
