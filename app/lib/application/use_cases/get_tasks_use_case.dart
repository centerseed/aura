import 'package:dartz/dartz.dart' hide Task;
import '../../core/errors/failures.dart';
import '../../domain/entities/task.dart';
import '../../domain/repositories/task_repository.dart';
import 'use_case.dart';

/// 獲取任務列表參數
class GetTasksParams {
  final String? status;
  final DateTime? from;
  final DateTime? to;
  final bool? completedToday;

  const GetTasksParams({
    this.status,
    this.from,
    this.to,
    this.completedToday,
  });
}

/// 獲取任務列表 Use Case
class GetTasksUseCase extends UseCase<List<Task>, GetTasksParams> {
  final TaskRepository repository;

  GetTasksUseCase(this.repository);

  @override
  Future<Either<Failure, List<Task>>> call(GetTasksParams params) async {
    return await repository.getTasks(
      status: params.status,
      from: params.from,
      to: params.to,
      completedToday: params.completedToday,
    );
  }
}
