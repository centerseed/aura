import 'package:dartz/dartz.dart' hide Task;
import '../../core/errors/dio_error_handler.dart';
import '../../core/errors/failures.dart';
import '../../domain/entities/task.dart';
import '../../domain/repositories/task_repository.dart';
import '../datasources/remote/api_client.dart';
import '../models/task_model.dart';
import 'utils/task_request_builder.dart';

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
      return Left(handleDioError(e));
    }
  }

  @override
  Future<Either<Failure, Task>> createTask(String content, {String? productId}) async {
    try {
      final body = <String, dynamic>{
        'content': content,
        'status': 'INBOX', // Default status
      };
      if (productId != null) {
        body['product_id'] = productId;
      }
      final model = await _apiClient.createTask(body);
      return Right(model.toEntity());
    } catch (e) {
      return Left(handleDioError(e));
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
    String? content,
    TaskStatus? status,
    DateTime? startDate,
    DateTime? dueDate,
    String? productId,
    String? topicId,
    double? timeConfidence,
    List<String>? tags,
  }) async {
    try {
      final requestBody = TaskRequestBuilder.buildUpdateRequestBody(
        content: content,
        status: status,
        startDate: startDate,
        dueDate: dueDate,
        productId: productId,
        topicId: topicId,
        timeConfidence: timeConfidence,
        tags: tags,
      );

      final model = await _apiClient.updateTask(taskId, requestBody);
      return Right(model.toEntity());
    } catch (e) {
      return Left(handleDioError(e));
    }
  }

  @override
  Future<Either<Failure, void>> deleteTask(String taskId) async {
    try {
      await _apiClient.deleteTask(taskId);
      return const Right(null);
    } catch (e) {
      return Left(handleDioError(e));
    }
  }

  @override
  Future<Either<Failure, void>> updateSubItem(
    String taskId,
    String subItemId, {
    bool? completed,
    String? content,
  }) async {
    try {
      final requestBody = <String, dynamic>{};
      if (completed != null) {
        requestBody['completed'] = completed;
      }
      if (content != null) {
        requestBody['content'] = content;
      }

      await _apiClient.updateSubItem(taskId, subItemId, requestBody);
      return const Right(null);
    } catch (e) {
      return Left(handleDioError(e));
    }
  }

  @override
  Future<Either<Failure, void>> addSubItem(
    String taskId,
    String content,
  ) async {
    try {
      await _apiClient.addSubItem(taskId, content);
      return const Right(null);
    } catch (e) {
      return Left(handleDioError(e));
    }
  }

  @override
  Future<Either<Failure, void>> deleteSubItem(
    String taskId,
    String subItemId,
  ) async {
    try {
      await _apiClient.deleteSubItem(taskId, subItemId);
      return const Right(null);
    } catch (e) {
      return Left(handleDioError(e));
    }
  }

  @override
  Future<Either<Failure, Task>> promoteSubItem(
    String taskId,
    String subItemId,
  ) async {
    try {
      final response = await _apiClient.promoteSubItem(taskId, subItemId);
      final newTaskData = response['newTask'] as Map<String, dynamic>;
      return Right(TaskModel.fromJson(newTaskData).toEntity());
    } catch (e) {
      return Left(handleDioError(e));
    }
  }

  @override
  Future<Either<Failure, void>> reorderSubItems(
    String taskId,
    List<String> subItemIds,
  ) async {
    try {
      await _apiClient.reorderSubItems(taskId, subItemIds);
      return const Right(null);
    } catch (e) {
      return Left(handleDioError(e));
    }
  }
}
