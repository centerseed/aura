import 'package:dartz/dartz.dart' hide Task;
import '../../core/errors/failures.dart';
import '../../domain/entities/task.dart';
import '../../domain/repositories/task_repository.dart';
import 'use_case.dart';

/// 創建任務參數
class CreateTaskParams {
  final String content;
  final String? productId;

  const CreateTaskParams({required this.content, this.productId});
}

/// 創建任務 Use Case
class CreateTaskUseCase extends UseCase<Task, CreateTaskParams> {
  final TaskRepository repository;

  CreateTaskUseCase(this.repository);

  @override
  Future<Either<Failure, Task>> call(CreateTaskParams params) async {
    return await repository.createTask(params.content, productId: params.productId);
  }
}
