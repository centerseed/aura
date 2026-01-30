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

  Future<Either<Failure, Task>> createTask(String content);

  Future<Either<Failure, Task>> updateTask(Task task);

  /// 更新任務詳細資訊 (支援多欄位更新)
  Future<Either<Failure, Task>> updateTaskDetails({
    required String taskId,
    TaskStatus? status,
    DateTime? dueDate,
    String? productId,
    List<String>? tags,
  });

  Future<Either<Failure, void>> deleteTask(String taskId);

  Future<Either<Failure, void>> updateSubItem(
    String taskId,
    String subItemId,
    bool completed,
  );
}
