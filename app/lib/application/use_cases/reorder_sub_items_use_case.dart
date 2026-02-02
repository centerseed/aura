import 'package:dartz/dartz.dart';
import '../../core/errors/failures.dart';
import '../../domain/repositories/task_repository.dart';
import 'use_case.dart';

/// 重新排序子項目參數
class ReorderSubItemsParams {
  final String taskId;
  final List<String> subItemIds;

  const ReorderSubItemsParams({
    required this.taskId,
    required this.subItemIds,
  });
}

/// 重新排序子項目 Use Case
class ReorderSubItemsUseCase extends UseCase<void, ReorderSubItemsParams> {
  final TaskRepository repository;

  ReorderSubItemsUseCase(this.repository);

  @override
  Future<Either<Failure, void>> call(ReorderSubItemsParams params) async {
    return await repository.reorderSubItems(
      params.taskId,
      params.subItemIds,
    );
  }
}
