import 'package:dartz/dartz.dart' hide Task;
import '../../core/errors/failures.dart';
import '../../domain/entities/task.dart';
import '../../domain/repositories/task_repository.dart';
import '../datasources/remote/api_client.dart';

class TaskRepositoryImpl implements TaskRepository {
  final ApiClient _apiClient;

  TaskRepositoryImpl(this._apiClient);

  @override
  Future<Either<Failure, List<Task>>> getTasks({
    String? status,
    DateTime? from,
    DateTime? to,
    bool? completedToday,
  }) async {
    try {
      final taskModels = await _apiClient.getTasks(
        status: status,
        dueDateFrom: from?.toIso8601String(),
        dueDateTo: to?.toIso8601String(),
        completedToday: completedToday,
      );
      final tasks = taskModels.map((model) => model.toEntity()).toList();
      return Right(tasks);
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Task>> createTask(String content) async {
    try {
      final model = await _apiClient.createTask({
        'content': content,
        'status': 'INBOX', // Default status
      });
      return Right(model.toEntity());
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Task>> updateTask(Task task) async {
    // 向後兼容:調用新的 updateTaskDetails 方法
    return updateTaskDetails(
      taskId: task.id,
      status: task.status,
      dueDate: task.dueDate,
      productId: task.productId,
      tags: task.tags,
    );
  }

  @override
  Future<Either<Failure, Task>> updateTaskDetails({
    required String taskId,
    TaskStatus? status,
    DateTime? dueDate,
    String? productId,
    List<String>? tags,
  }) async {
    try {
      // 構建請求體,只包含非 null 的欄位
      final requestBody = <String, dynamic>{};

      if (status != null) {
        requestBody['status'] = status.name.toUpperCase();
      }
      if (dueDate != null) {
        requestBody['due_date'] = dueDate.toUtc().toIso8601String();
      }
      if (productId != null) {
        requestBody['product_id'] = productId;
      }
      if (tags != null) {
        requestBody['tags'] = tags;
      }

      final model = await _apiClient.updateTask(taskId, requestBody);
      return Right(model.toEntity());
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, void>> deleteTask(String taskId) async {
    try {
      await _apiClient.deleteTask(taskId);
      return const Right(null);
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, void>> updateSubItem(
    String taskId,
    String subItemId,
    bool completed,
  ) async {
    try {
      await _apiClient.updateSubItem(taskId, subItemId, {
        'completed': completed,
      });
      return const Right(null);
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }
}
