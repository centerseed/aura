import 'package:dartz/dartz.dart';
import '../../core/errors/failures.dart';
import '../../domain/repositories/task_repository.dart';
import 'use_case.dart';

/// 更新子項目參數
class UpdateSubItemParams {
  final String taskId;
  final String subItemId;
  final bool? completed;
  final String? content;

  const UpdateSubItemParams({
    required this.taskId,
    required this.subItemId,
    this.completed,
    this.content,
  });
}

/// 更新子項目 Use Case
class UpdateSubItemUseCase extends UseCase<void, UpdateSubItemParams> {
  final TaskRepository repository;

  UpdateSubItemUseCase(this.repository);

  @override
  Future<Either<Failure, void>> call(UpdateSubItemParams params) async {
    return await repository.updateSubItem(
      params.taskId,
      params.subItemId,
      completed: params.completed,
      content: params.content,
    );
  }
}
