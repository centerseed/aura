import 'package:dartz/dartz.dart' hide Task;
import '../../core/errors/failures.dart';
import '../../domain/entities/task.dart';
import '../../domain/repositories/task_repository.dart';
import 'use_case.dart';

/// 獲取活躍任務 (排除已歸檔) Use Case
class GetActiveTasksUseCase extends NoParamsUseCase<List<Task>> {
  final TaskRepository repository;

  GetActiveTasksUseCase(this.repository);

  @override
  Future<Either<Failure, List<Task>>> call() async {
    final result = await repository.getTasks();
    return result.map(
      (tasks) => tasks.where((t) => t.status != TaskStatus.archive).toList(),
    );
  }
}
