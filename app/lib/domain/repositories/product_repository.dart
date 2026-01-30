import 'package:dartz/dartz.dart';
import '../../core/errors/failures.dart';
import '../entities/product.dart';
import '../entities/reorganize_proposal.dart';

abstract class ProductRepository {
  Future<Either<Failure, List<Product>>> getProducts();
  Future<Either<Failure, Product>> createProduct(String name, String areaId);

  /// AI Reorganization
  Future<Either<Failure, ReorganizeProposal>> reorganizeTopics(
    String productId,
  );
  Future<Either<Failure, void>> applyReorganization(
    String productId,
    ReorganizeProposal proposal,
  );
}
