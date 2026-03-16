import 'package:dartz/dartz.dart' hide Task;
import '../../core/errors/failures.dart';
import '../../domain/entities/task.dart';
import '../../domain/repositories/task_repository.dart';
import 'use_case.dart';

/// 更新任務詳細資訊參數
class UpdateTaskDetailsParams {
  final String taskId;
  final String? content;
  final TaskStatus? status;
  final DateTime? startDate;
  final DateTime? dueDate;
  final String? productId;
  final String? topicId;
  final double? timeConfidence;
  final List<String>? tags;
  final bool? dateLocked;

  const UpdateTaskDetailsParams({
    required this.taskId,
    this.content,
    this.status,
    this.startDate,
    this.dueDate,
    this.productId,
    this.topicId,
    this.timeConfidence,
    this.tags,
    this.dateLocked,
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
      content: params.content,
      status: params.status,
      startDate: params.startDate,
      dueDate: params.dueDate,
      productId: params.productId,
      topicId: params.topicId,
      timeConfidence: params.timeConfidence,
      tags: params.tags,
      dateLocked: params.dateLocked,
    );
  }
}
