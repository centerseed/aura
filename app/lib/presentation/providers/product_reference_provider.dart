import 'package:dartz/dartz.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/di/providers.dart' as providers;
import '../../core/errors/failures.dart';
import '../../domain/entities/reference.dart';
import '../../application/use_cases/get_product_references_use_case.dart';

/// Product References Provider - 自動刷新的 reference 列表
///
/// 使用 family 參數接收 productId，每個 product 有獨立的 provider instance
final productReferencesProvider = FutureProvider.autoDispose
    .family<Either<Failure, List<Reference>>, String>((ref, productId) async {
  final useCase = ref.watch(providers.getProductReferencesUseCaseProvider);
  return await useCase(GetProductReferencesParams(productId: productId));
});

/// Unwrapped 版本 - 直接拋出錯誤供 UI 使用
final productReferencesUnwrappedProvider = FutureProvider.autoDispose
    .family<List<Reference>, String>((ref, productId) async {
  final result = await ref.watch(productReferencesProvider(productId).future);
  return result.fold(
    (failure) => throw Exception(failure.message),
    (references) => references,
  );
});
