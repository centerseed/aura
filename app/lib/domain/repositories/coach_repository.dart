import 'package:dartz/dartz.dart' hide Task;

import '../../core/errors/failures.dart';
import '../entities/coach_briefing.dart';
import '../entities/daily_plan.dart';

abstract class CoachRepository {
  Future<Either<Failure, CoachBriefing?>> getLatestBriefing({
    BriefingType? type,
  });

  Future<Either<Failure, CoachBriefing>> generateBriefing({
    BriefingType? type,
  });

  Future<Either<Failure, DailyPlan?>> getPlan({
    String? date,
    String? timezone,
  });

  Future<Either<Failure, DailyPlan>> generatePlan({
    String? date,
    String? timezone,
  });

  Future<Either<Failure, void>> updatePlanItem({
    required String itemId,
    bool? completed,
    bool? pinned,
    bool? deferred,
    String? status,
  });
}
