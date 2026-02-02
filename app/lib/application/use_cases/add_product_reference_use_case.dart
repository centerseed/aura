import 'package:dartz/dartz.dart';
import '../../core/errors/failures.dart';
import '../../domain/entities/reference.dart';
import '../../domain/repositories/product_repository.dart';

class AddProductReferenceParams {
  final String productId;
  final ReferenceType type;
  final String content;
  final String? title;

  const AddProductReferenceParams({
    required this.productId,
    required this.type,
    required this.content,
    this.title,
  });
}

class AddProductReferenceUseCase {
  final ProductRepository _repository;

  AddProductReferenceUseCase(this._repository);

  Future<Either<Failure, Reference>> call(
    AddProductReferenceParams params,
  ) async {
    return await _repository.addProductReference(
      productId: params.productId,
      type: params.type,
      content: params.content,
      title: params.title,
    );
  }
}
