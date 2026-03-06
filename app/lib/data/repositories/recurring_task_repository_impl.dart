import 'package:dartz/dartz.dart';
import '../../core/errors/dio_error_handler.dart';
import '../../core/errors/failures.dart';
import '../../domain/entities/recurring_task.dart';
import '../datasources/remote/api_client.dart';

class RecurringTaskRepositoryImpl {
  final ApiClient _apiClient;

  RecurringTaskRepositoryImpl(this._apiClient);

  Future<Either<Failure, List<RecurringTask>>> getRecurringTasks() async {
    try {
      final models = await _apiClient.getRecurringTasks();
      return Right(models.map((m) => m.toEntity()).toList());
    } catch (e) {
      return Left(handleDioError(e));
    }
  }

  Future<Either<Failure, RecurringTask>> createRecurringTask({
    required String title,
    required Map<String, dynamic> recurrenceRule,
    int leadDays = 1,
    String? productId,
    String? topicId,
    double? estimatedDurationHours,
  }) async {
    try {
      final body = <String, dynamic>{
        'title': title,
        'recurrence_rule': recurrenceRule,
        'lead_days': leadDays,
        if (productId != null) 'product_id': productId,
        if (topicId != null) 'topic_id': topicId,
        if (estimatedDurationHours != null)
          'estimated_duration_hours': estimatedDurationHours,
      };
      final model = await _apiClient.createRecurringTask(body);
      return Right(model.toEntity());
    } catch (e) {
      return Left(handleDioError(e));
    }
  }

  Future<Either<Failure, RecurringTask>> updateRecurringTask(
    String id, {
    String? title,
    String? status,
    Map<String, dynamic>? recurrenceRule,
    int? leadDays,
    String? productId,
    double? estimatedDurationHours,
  }) async {
    try {
      final body = <String, dynamic>{
        if (title != null) 'title': title,
        if (status != null) 'status': status,
        if (recurrenceRule != null) 'recurrence_rule': recurrenceRule,
        if (leadDays != null) 'lead_days': leadDays,
        if (productId != null) 'product_id': productId,
        if (estimatedDurationHours != null)
          'estimated_duration_hours': estimatedDurationHours,
      };
      final model = await _apiClient.updateRecurringTask(id, body);
      return Right(model.toEntity());
    } catch (e) {
      return Left(handleDioError(e));
    }
  }

  Future<Either<Failure, Unit>> deleteRecurringTask(String id) async {
    try {
      await _apiClient.deleteRecurringTask(id);
      return const Right(unit);
    } catch (e) {
      return Left(handleDioError(e));
    }
  }

  /// App 啟動時呼叫，生成到期的週期任務實例
  Future<Either<Failure, Map<String, dynamic>>> generateInstances(
    String localDate,
  ) async {
    try {
      final result = await _apiClient.generateRecurringTaskInstances(localDate);
      return Right(result);
    } catch (e) {
      return Left(handleDioError(e));
    }
  }
}
