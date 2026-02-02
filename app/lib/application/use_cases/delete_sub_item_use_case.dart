import 'package:dartz/dartz.dart';
import '../../core/errors/failures.dart';
import '../../domain/repositories/task_repository.dart';
import 'use_case.dart';

/// 刪除子項目參數
class DeleteSubItemParams {
  final String taskId;
  final String subItemId;

  const DeleteSubItemParams({
    required this.taskId,
    required this.subItemId,
  });
}

/// 刪除子項目 Use Case
class DeleteSubItemUseCase extends UseCase<void, DeleteSubItemParams> {
  final TaskRepository repository;

  DeleteSubItemUseCase(this.repository);

  @override
  Future<Either<Failure, void>> call(DeleteSubItemParams params) async {
    return await repository.deleteSubItem(
      params.taskId,
      params.subItemId,
    );
  }
}
