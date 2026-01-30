import 'package:dartz/dartz.dart' hide Task;
import '../../core/errors/failures.dart';
import '../../domain/entities/task.dart';
import '../../domain/repositories/task_repository.dart';
import 'use_case.dart';

/// 更新任務參數
class UpdateTaskParams {
  final Task task;

  const UpdateTaskParams({required this.task});
}

/// 更新任務 Use Case
class UpdateTaskUseCase extends UseCase<Task, UpdateTaskParams> {
  final TaskRepository repository;

  UpdateTaskUseCase(this.repository);

  @override
  Future<Either<Failure, Task>> call(UpdateTaskParams params) async {
    return await repository.updateTask(params.task);
  }
}
