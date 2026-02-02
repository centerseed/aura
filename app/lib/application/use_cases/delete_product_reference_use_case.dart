import 'package:dartz/dartz.dart';
import '../../core/errors/failures.dart';
import '../../domain/repositories/product_repository.dart';

class DeleteProductReferenceParams {
  final String productId;
  final String referenceId;
  final String? taskId;

  const DeleteProductReferenceParams({
    required this.productId,
    required this.referenceId,
    this.taskId,
  });
}

class DeleteProductReferenceUseCase {
  final ProductRepository _repository;

  DeleteProductReferenceUseCase(this._repository);

  Future<Either<Failure, void>> call(
    DeleteProductReferenceParams params,
  ) async {
    return await _repository.deleteProductReference(
      productId: params.productId,
      referenceId: params.referenceId,
      taskId: params.taskId,
    );
  }
}
