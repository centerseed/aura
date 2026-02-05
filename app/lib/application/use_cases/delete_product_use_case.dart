import 'package:dartz/dartz.dart';
import '../../core/errors/failures.dart';
import '../../domain/repositories/product_repository.dart';
import 'use_case.dart';

/// 刪除 Product 參數
class DeleteProductParams {
  final String productId;

  const DeleteProductParams({required this.productId});
}

/// 刪除 Product Use Case（軟刪除）
class DeleteProductUseCase extends UseCase<void, DeleteProductParams> {
  final ProductRepository repository;

  DeleteProductUseCase(this.repository);

  @override
  Future<Either<Failure, void>> call(DeleteProductParams params) async {
    return await repository.deleteProduct(params.productId);
  }
}
