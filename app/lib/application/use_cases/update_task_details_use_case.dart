import 'package:dartz/dartz.dart' hide Task;
import '../../core/errors/failures.dart';
import '../../domain/entities/task.dart';
import '../../domain/repositories/task_repository.dart';
import 'use_case.dart';

/// 更新任務詳細資訊參數
class UpdateTaskDetailsParams {
  final String taskId;
  final TaskStatus? status;
  final DateTime? dueDate;
  final String? productId;
  final List<String>? tags;

  const UpdateTaskDetailsParams({
    required this.taskId,
    this.status,
    this.dueDate,
    this.productId,
    this.tags,
  });
}

/// 更新任務詳細資訊 Use Case
class UpdateTaskDetailsUseCase extends UseCase<Task, UpdateTaskDetailsParams> {
  final TaskRepository repository;

  UpdateTaskDetailsUseCase(this.repository);

  @override
  Future<Either<Failure, Task>> call(UpdateTaskDetailsParams params) async {
    return await repository.updateTaskDetails(
      taskId: params.taskId,
      status: params.status,
      dueDate: params.dueDate,
      productId: params.productId,
      tags: params.tags,
    );
  }
}
