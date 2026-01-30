import 'package:dartz/dartz.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/di/providers.dart' as providers;
import '../../core/errors/failures.dart';
import '../../domain/entities/area.dart';
import 'provider_extensions.dart';

// 從統一的 providers 中導出 areaRepositoryProvider
final areaRepositoryProvider = providers.areaRepositoryProvider;

// 使用 Use Case 獲取 Areas
final areasProvider =
    FutureProvider.autoDispose<Either<Failure, List<Area>>>((ref) async {
  final useCase = ref.watch(providers.getAreasUseCaseProvider);
  return await useCase.call();
});

// 便捷的 unwrapped 版本 (如果需要)
final areasUnwrappedProvider =
    FutureProvider.autoDispose<List<Area>>((ref) async {
  final result = await ref.watch(areasProvider.future);
  return result.fold(
    (failure) => throw Exception(failure.message),
    (areas) => areas,
  );
});
