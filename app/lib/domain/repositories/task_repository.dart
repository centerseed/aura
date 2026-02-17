import 'package:dartz/dartz.dart' hide Task;
import '../../core/errors/failures.dart';
import '../entities/task.dart';

abstract class TaskRepository {
  Future<Either<Failure, List<Task>>> getTasks({
    String? status,
    DateTime? from,
    DateTime? to,
    bool? completedToday,
  });

  Future<Either<Failure, Task>> createTask(String content, {String? productId});

  Future<Either<Failure, Task>> updateTask(Task task);

  /// 更新任務詳細資訊 (支援多欄位更新)
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
  });

  Future<Either<Failure, void>> deleteTask(String taskId);

  /// 更新 sub-item (支援 completed、content、startDate 和 dueDate)
  Future<Either<Failure, void>> updateSubItem(
    String taskId,
    String subItemId, {
    bool? completed,
    String? content,
    DateTime? startDate,
    DateTime? dueDate,
  });

  /// 新增 sub-item
  Future<Either<Failure, void>> addSubItem(
    String taskId,
    String content,
  );

  /// 刪除 sub-item
  Future<Either<Failure, void>> deleteSubItem(
    String taskId,
    String subItemId,
  );

  /// 升級 sub-item 為獨立任務
  Future<Either<Failure, Task>> promoteSubItem(
    String taskId,
    String subItemId,
  );

  /// 重新排序 sub-items
  Future<Either<Failure, void>> reorderSubItems(
    String taskId,
    List<String> subItemIds,
  );
}
