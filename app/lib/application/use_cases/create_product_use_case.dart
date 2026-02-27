import 'package:dartz/dartz.dart';
import '../../core/errors/failures.dart';
import '../../domain/entities/product.dart';
import '../../domain/repositories/product_repository.dart';
import 'use_case.dart';

class CreateProductParams {
  final String name;
  final String areaId;

  const CreateProductParams({required this.name, required this.areaId});
}

class CreateProductUseCase extends UseCase<Product, CreateProductParams> {
  final ProductRepository repository;

  CreateProductUseCase(this.repository);

  @override
  Future<Either<Failure, Product>> call(CreateProductParams params) async {
    return await repository.createProduct(params.name, params.areaId);
  }
}
