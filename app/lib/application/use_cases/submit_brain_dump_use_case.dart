import 'package:dartz/dartz.dart';
import '../../core/errors/failures.dart';
import '../../domain/entities/brain_dump_result.dart';
import '../../domain/repositories/brain_dump_repository.dart';
import 'use_case.dart';

/// 提交 Brain Dump 參數
class SubmitBrainDumpParams {
  final String text;

  const SubmitBrainDumpParams({required this.text});
}

/// 提交 Brain Dump Use Case
class SubmitBrainDumpUseCase
    extends UseCase<BrainDumpResult, SubmitBrainDumpParams> {
  final BrainDumpRepository repository;

  SubmitBrainDumpUseCase(this.repository);

  @override
  Future<Either<Failure, BrainDumpResult>> call(
    SubmitBrainDumpParams params,
  ) async {
    return await repository.submit(params.text);
  }
}
