import 'package:dartz/dartz.dart';
import '../../core/errors/failures.dart';
import '../../domain/entities/product.dart';
import '../../domain/repositories/product_repository.dart';
import 'use_case.dart';

/// 更新 Product 參數
class UpdateProductParams {
  final String productId;
  final String? name;
  final String? description;
  final String? areaId;
  final ProductStatus? status;
  final ProductLifecycle? lifecycle;

  const UpdateProductParams({
    required this.productId,
    this.name,
    this.description,
    this.areaId,
    this.status,
    this.lifecycle,
  });
}

/// 更新 Product Use Case
class UpdateProductUseCase extends UseCase<Product, UpdateProductParams> {
  final ProductRepository repository;

  UpdateProductUseCase(this.repository);

  @override
  Future<Either<Failure, Product>> call(UpdateProductParams params) async {
    return await repository.updateProduct(
      productId: params.productId,
      name: params.name,
      description: params.description,
      areaId: params.areaId,
      status: params.status,
      lifecycle: params.lifecycle,
    );
  }
}
