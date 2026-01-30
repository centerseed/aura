import 'package:dartz/dartz.dart' hide Task;
import '../../core/errors/failures.dart';
import '../../domain/entities/task.dart';
import '../../domain/repositories/task_repository.dart';
import 'use_case.dart';

/// 獲取今日完成任務 Use Case
class GetCompletedTodayTasksUseCase extends NoParamsUseCase<List<Task>> {
  final TaskRepository repository;

  GetCompletedTodayTasksUseCase(this.repository);

  @override
  Future<Either<Failure, List<Task>>> call() async {
    return await repository.getTasks(completedToday: true);
  }
}
