import 'package:dartz/dartz.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/di/providers.dart' as providers;
import '../../core/errors/failures.dart';
import '../../domain/entities/product.dart';
import 'provider_extensions.dart';

// 從統一的 providers 中導出 productRepositoryProvider
final productRepositoryProvider = providers.productRepositoryProvider;

// 使用 Use Case 獲取 Products
final productsProvider =
    FutureProvider.autoDispose<Either<Failure, List<Product>>>((ref) async {
  final useCase = ref.watch(providers.getProductsUseCaseProvider);
  return await useCase.call();
});

// 便捷的 unwrapped 版本 (如果需要)
final productsUnwrappedProvider =
    FutureProvider.autoDispose<List<Product>>((ref) async {
  final result = await ref.watch(productsProvider.future);
  return result.fold(
    (failure) => throw Exception(failure.message),
    (products) => products,
  );
});
