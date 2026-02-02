import 'package:dartz/dartz.dart' hide Task;
import 'package:flutter_dual_cache/flutter_dual_cache.dart';

import '../../../core/errors/dio_error_handler.dart';
import '../../../core/errors/failures.dart';
import '../../../domain/entities/task.dart';
import '../../../domain/repositories/task_repository.dart';
import '../../datasources/remote/api_client.dart';
import '../../models/task_model.dart';

/// Unified Task Repository combining caching and Either-based error handling.
///
/// This repository implements the hybrid pattern:
///
/// ## Query Operations (Stream-based)
/// Uses [CachedRepository] to provide `Stream<CacheState<List<Task>>>` for
/// reactive UI updates with automatic cache management.
///
/// ```dart
/// StreamBuilder<CacheState<List<Task>>>(
///   stream: taskRepo.stream,
///   builder: (context, snapshot) {
///     final state = snapshot.data;
///     if (state == null || state.isLoading) return LoadingWidget();
///     if (state.error != null) return ErrorWidget(state.error);
///     return TaskList(tasks: state.data);
///   },
/// )
/// ```
///
/// ## Mutation Operations (Either-based)
/// Uses `Either<Failure, T>` for explicit error handling in use cases,
/// with automatic cache refresh after successful mutations.
///
/// ```dart
/// final result = await taskRepo.createTask(content, productId: productId);
/// result.fold(
///   (failure) => showError(failure.message),
///   (task) => showSuccess('Task created'),
/// );
/// ```
class TaskUnifiedRepository extends CachedRepository<Task, String>
    implements TaskRepository {
  final ApiClient _apiClient;

  TaskUnifiedRepository(this._apiClient)
      : super(
          boxName: 'tasks_unified_v1',
          config: const CacheConfig(
            ttlMinutes: 5,
            backgroundRefreshThrottleSeconds: 30,
          ),
        );

  // ==================== CachedRepository Implementation ====================

  @override
  Future<List<Task>> fetchFromRemote() async {
    final taskModels = await _apiClient.getTasks();
    return taskModels.map((model) => model.toEntity()).toList();
  }

  @override
  Map<String, dynamic> toJson(Task item) {
    return {
      'id': item.id,
      'user_id': '',
      'product_id': item.productId,
      'topic_id': item.topicId,
      'content': item.content,
      'status': item.status.name.toUpperCase(),
      'due_date': item.dueDate?.toIso8601String(),
      'start_date': item.startDate?.toIso8601String(),
      'time_confidence': item.timeConfidence,
      'sub_items': item.subItems?.map(_subItemToJson).toList(),
      'tag': {
        'area': item.areaName,
        'product': item.productName,
        'topic': item.topicName,
      },
      'tags': item.tags,
      'created_at': item.createdAt?.toIso8601String(),
      'updated_at': item.updatedAt?.toIso8601String(),
      'deleted_at': item.deletedAt?.toIso8601String(),
    };
  }

  Map<String, dynamic> _subItemToJson(SubItem subItem) {
    return {
      'id': subItem.id,
      'content': subItem.content,
      'completed': subItem.completed,
      'completed_at': subItem.completedAt?.toIso8601String(),
    };
  }

  @override
  Task fromJson(Map<String, dynamic> json) {
    return TaskModel.fromJson(json).toEntity();
  }

  @override
  String getId(Task item) => item.id;

  @override
  List<Task> transformForDisplay(List<Task> data) {
    return data.where((task) => task.status != TaskStatus.archive).toList();
  }

  // ==================== TaskRepository Interface ====================

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
  Future<Either<Failure, Task>> createTask(
    String content, {
    String? productId,
  }) async {
    try {
      final body = <String, dynamic>{
        'content': content,
        'status': 'INBOX',
      };
      if (productId != null) {
        body['product_id'] = productId;
      }

      final model = await _apiClient.createTask(body);
      final task = model.toEntity();

      await silentRefresh();

      return Right(task);
    } catch (e) {
      return Left(handleDioError(e));
    }
  }

  @override
  Future<Either<Failure, Task>> updateTask(Task task) async {
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
      final requestBody = _buildUpdateRequestBody(
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
      final task = model.toEntity();

      await silentRefresh();

      return Right(task);
    } catch (e) {
      return Left(handleDioError(e));
    }
  }

  Map<String, dynamic> _buildUpdateRequestBody({
    String? content,
    TaskStatus? status,
    DateTime? startDate,
    DateTime? dueDate,
    String? productId,
    String? topicId,
    double? timeConfidence,
    List<String>? tags,
  }) {
    final body = <String, dynamic>{};
    if (content != null) {
      body['content'] = content;
    }
    if (status != null) {
      body['status'] = status.name.toUpperCase();
    }
    if (startDate != null) {
      body['start_date'] = startDate.toUtc().toIso8601String();
    }
    if (dueDate != null) {
      body['due_date'] = dueDate.toUtc().toIso8601String();
    }
    if (productId != null) {
      body['product_id'] = productId;
    }
    if (topicId != null) {
      body['topic_id'] = topicId;
    }
    if (timeConfidence != null) {
      body['time_confidence'] = timeConfidence;
    }
    if (tags != null) {
      body['tags'] = tags;
    }
    return body;
  }

  @override
  Future<Either<Failure, void>> deleteTask(String taskId) async {
    try {
      await _apiClient.deleteTask(taskId);
      await silentRefresh();
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
      await silentRefresh();
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
      await silentRefresh();
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
      await silentRefresh();
      return const Right(null);
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
      await silentRefresh();
      return const Right(null);
    } catch (e) {
      return Left(handleDioError(e));
    }
  }
}
