import 'package:dartz/dartz.dart';
import '../../core/errors/failures.dart';
import '../../domain/entities/product.dart';
import '../../domain/repositories/product_repository.dart';
import 'use_case.dart';

/// 獲取產品列表 Use Case
class GetProductsUseCase extends NoParamsUseCase<List<Product>> {
  final ProductRepository repository;

  GetProductsUseCase(this.repository);

  @override
  Future<Either<Failure, List<Product>>> call() async {
    return await repository.getProducts();
  }
}
