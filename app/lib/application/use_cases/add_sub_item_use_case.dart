import 'package:dartz/dartz.dart';
import '../../core/errors/failures.dart';
import '../../domain/repositories/task_repository.dart';
import 'use_case.dart';

/// 新增子項目參數
class AddSubItemParams {
  final String taskId;
  final String content;

  const AddSubItemParams({
    required this.taskId,
    required this.content,
  });
}

/// 新增子項目 Use Case
class AddSubItemUseCase extends UseCase<void, AddSubItemParams> {
  final TaskRepository repository;

  AddSubItemUseCase(this.repository);

  @override
  Future<Either<Failure, void>> call(AddSubItemParams params) async {
    return await repository.addSubItem(
      params.taskId,
      params.content,
    );
  }
}
