import 'package:dartz/dartz.dart';
import '../../core/errors/failures.dart';
import '../../domain/entities/reference.dart';
import '../../domain/repositories/product_repository.dart';

class UpdateProductReferenceParams {
  final String productId;
  final String referenceId;
  final String content;
  final String? title;
  final String? taskId;

  const UpdateProductReferenceParams({
    required this.productId,
    required this.referenceId,
    required this.content,
    this.title,
    this.taskId,
  });
}

class UpdateProductReferenceUseCase {
  final ProductRepository _repository;

  UpdateProductReferenceUseCase(this._repository);

  Future<Either<Failure, Reference>> call(
    UpdateProductReferenceParams params,
  ) async {
    return await _repository.updateProductReference(
      productId: params.productId,
      referenceId: params.referenceId,
      content: params.content,
      title: params.title,
      taskId: params.taskId,
    );
  }
}
