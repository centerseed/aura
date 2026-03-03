import 'package:dartz/dartz.dart';
import '../../core/errors/failures.dart';
import '../entities/product.dart';
import '../entities/reference.dart';
import '../entities/reorganize_proposal.dart';

abstract class ProductRepository {
  Future<Either<Failure, List<Product>>> getProducts();
  Future<Either<Failure, Product>> createProduct(String name, String areaId);

  /// 更新 Product
  Future<Either<Failure, Product>> updateProduct({
    required String productId,
    String? name,
    String? description,
    String? areaId,
    ProductStatus? status,
    ProductLifecycle? lifecycle,
    ProductPriority? priority,
  });

  /// 刪除 Product（軟刪除）
  Future<Either<Failure, void>> deleteProduct(String productId);

  /// AI Reorganization
  Future<Either<Failure, ReorganizeProposal>> reorganizeTopics(
    String productId,
  );
  Future<Either<Failure, void>> applyReorganization(
    String productId,
    ReorganizeProposal proposal,
  );

  /// Product References Management
  Future<Either<Failure, List<Reference>>> getProductReferences(
    String productId,
  );
  Future<Either<Failure, Reference>> addProductReference({
    required String productId,
    required ReferenceType type,
    required String content,
    String? title,
  });
  Future<Either<Failure, Reference>> updateProductReference({
    required String productId,
    required String referenceId,
    required String content,
    String? title,
    String? taskId,
  });
  Future<Either<Failure, void>> deleteProductReference({
    required String productId,
    required String referenceId,
    String? taskId,
  });
}
