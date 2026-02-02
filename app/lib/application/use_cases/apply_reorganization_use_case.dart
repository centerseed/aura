import 'package:dartz/dartz.dart';
import '../../core/errors/failures.dart';
import '../../domain/entities/reorganize_proposal.dart';
import '../../domain/repositories/product_repository.dart';

class ApplyReorganizationParams {
  final String productId;
  final ReorganizeProposal proposal;

  ApplyReorganizationParams({
    required this.productId,
    required this.proposal,
  });
}

class ApplyReorganizationUseCase {
  final ProductRepository _productRepository;

  ApplyReorganizationUseCase({
    required ProductRepository productRepository,
  }) : _productRepository = productRepository;

  Future<Either<Failure, void>> call(ApplyReorganizationParams params) async {
    return await _productRepository.applyReorganization(
      params.productId,
      params.proposal,
    );
  }
}
