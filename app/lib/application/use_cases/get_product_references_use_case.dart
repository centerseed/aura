import 'package:dartz/dartz.dart';
import '../../core/errors/failures.dart';
import '../../domain/entities/reference.dart';
import '../../domain/repositories/product_repository.dart';
import 'use_case.dart';

/// 獲取產品 References Use Case
class GetProductReferencesUseCase
    extends UseCase<List<Reference>, GetProductReferencesParams> {
  final ProductRepository repository;

  GetProductReferencesUseCase(this.repository);

  @override
  Future<Either<Failure, List<Reference>>> call(
    GetProductReferencesParams params,
  ) async {
    return await repository.getProductReferences(params.productId);
  }
}

/// 獲取產品 References 參數
class GetProductReferencesParams {
  final String productId;

  GetProductReferencesParams({required this.productId});
}
