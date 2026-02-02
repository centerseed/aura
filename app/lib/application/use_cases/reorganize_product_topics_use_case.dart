import 'package:dartz/dartz.dart';
import '../../core/errors/failures.dart';
import '../../domain/entities/reorganize_proposal.dart';
import '../../domain/repositories/product_repository.dart';

class ReorganizeProductTopicsParams {
  final String productId;

  ReorganizeProductTopicsParams({required this.productId});
}

class ReorganizeProductTopicsUseCase {
  final ProductRepository _productRepository;

  ReorganizeProductTopicsUseCase({
    required ProductRepository productRepository,
  }) : _productRepository = productRepository;

  Future<Either<Failure, ReorganizeProposal>> call(
    ReorganizeProductTopicsParams params,
  ) async {
    return await _productRepository.reorganizeTopics(params.productId);
  }
}
