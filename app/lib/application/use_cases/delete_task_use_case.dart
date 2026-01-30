import 'package:dartz/dartz.dart';
import '../../core/errors/failures.dart';
import '../../domain/repositories/task_repository.dart';
import 'use_case.dart';

/// 刪除任務參數
class DeleteTaskParams {
  final String taskId;

  const DeleteTaskParams({required this.taskId});
}

/// 刪除任務 Use Case
class DeleteTaskUseCase extends UseCase<void, DeleteTaskParams> {
  final TaskRepository repository;

  DeleteTaskUseCase(this.repository);

  @override
  Future<Either<Failure, void>> call(DeleteTaskParams params) async {
    return await repository.deleteTask(params.taskId);
  }
}
