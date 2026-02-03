import 'package:dartz/dartz.dart' hide Task;
import '../../core/errors/failures.dart';
import '../../domain/entities/task.dart';
import '../../domain/repositories/task_repository.dart';
import 'use_case.dart';

/// 升級子項目為獨立任務參數
class PromoteSubItemParams {
  final String taskId;
  final String subItemId;

  const PromoteSubItemParams({
    required this.taskId,
    required this.subItemId,
  });
}

/// 升級子項目為獨立任務 Use Case
class PromoteSubItemUseCase extends UseCase<Task, PromoteSubItemParams> {
  final TaskRepository repository;

  PromoteSubItemUseCase(this.repository);

  @override
  Future<Either<Failure, Task>> call(PromoteSubItemParams params) async {
    return await repository.promoteSubItem(
      params.taskId,
      params.subItemId,
    );
  }
}
