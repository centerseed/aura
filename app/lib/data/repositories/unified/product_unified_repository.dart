import 'package:dartz/dartz.dart';
import 'package:flutter_dual_cache/flutter_dual_cache.dart';

import '../../../core/errors/dio_error_handler.dart';
import '../../../core/errors/failures.dart';
import '../../../domain/entities/product.dart';
import '../../../domain/entities/reference.dart';
import '../../../domain/entities/reorganize_proposal.dart';
import '../../../domain/repositories/product_repository.dart';
import '../../datasources/remote/api_client.dart';
import '../../models/product_model.dart';
import '../../models/reference_model.dart';

/// Unified Product Repository combining caching and Either-based error handling.
///
/// This repository implements the hybrid pattern:
///
/// ## Query Operations (Stream-based)
/// Uses [CachedRepository] to provide `Stream<CacheState<List<Product>>>` for
/// reactive UI updates with automatic cache management.
///
/// ```dart
/// StreamBuilder<CacheState<List<Product>>>(
///   stream: productRepo.stream,
///   builder: (context, snapshot) {
///     final state = snapshot.data;
///     if (state == null || state.isLoading) return LoadingWidget();
///     if (state.error != null) return ErrorWidget(state.error);
///     return ProductList(products: state.data);
///   },
/// )
/// ```
///
/// ## Mutation Operations (Either-based)
/// Uses `Either<Failure, T>` for explicit error handling in use cases,
/// with automatic cache refresh after successful mutations.
///
/// ```dart
/// final result = await productRepo.createProduct(name, areaId);
/// result.fold(
///   (failure) => showError(failure.message),
///   (product) => showSuccess('Product created'),
/// );
/// ```
class ProductUnifiedRepository extends CachedRepository<Product, String>
    implements ProductRepository {
  final ApiClient _apiClient;

  ProductUnifiedRepository(this._apiClient)
      : super(
          boxName: 'products_unified_v1',
          config: const CacheConfig(
            ttlMinutes: 5,
            backgroundRefreshThrottleSeconds: 30,
          ),
        );

  // ==================== CachedRepository Implementation ====================

  @override
  Future<List<Product>> fetchFromRemote() async {
    final productModels = await _apiClient.getProducts();
    return productModels.map((model) => model.toEntity()).toList();
  }

  @override
  Map<String, dynamic> toJson(Product item) {
    return {
      'id': item.id,
      'user_id': '',
      'area_id': item.areaId,
      'name': item.name,
      'description': item.description,
      'status': item.status.name.toUpperCase(),
      'lifecycle': item.lifecycle.name.toUpperCase(),
      'display_order': item.displayOrder,
      'created_at': item.createdAt?.toIso8601String(),
      'updated_at': item.updatedAt?.toIso8601String(),
    };
  }

  @override
  Product fromJson(Map<String, dynamic> json) {
    return ProductModel.fromJson(json).toEntity();
  }

  @override
  String getId(Product item) => item.id;

  // ==================== ProductRepository Interface ====================

  @override
  Future<Either<Failure, List<Product>>> getProducts() async {
    try {
      final productModels = await _apiClient.getProducts();
      final products = productModels.map((model) => model.toEntity()).toList();
      return Right(products);
    } catch (e) {
      return Left(handleDioError(e));
    }
  }

  @override
  Future<Either<Failure, Product>> createProduct(
    String name,
    String areaId,
  ) async {
    try {
      final payload = {
        'name': name,
        'areaId': areaId,
        'description': '',
      };
      final model = await _apiClient.createProduct(payload);
      final product = model.toEntity();

      await silentRefresh(force: true);

      return Right(product);
    } catch (e) {
      return Left(handleDioError(e));
    }
  }

  @override
  Future<Either<Failure, Product>> updateProduct({
    required String productId,
    String? name,
    String? description,
    String? areaId,
    ProductStatus? status,
    ProductLifecycle? lifecycle,
    ProductPriority? priority,
  }) async {
    try {
      final body = <String, dynamic>{};
      if (name != null) body['name'] = name;
      if (description != null) body['description'] = description;
      if (areaId != null) body['area_id'] = areaId;
      if (status != null) body['status'] = status.name.toUpperCase();
      if (lifecycle != null) body['lifecycle'] = lifecycle.name.toUpperCase();
      if (priority != null) body['priority'] = priority.name.toUpperCase();

      final model = await _apiClient.updateProduct(productId, body);
      final product = model.toEntity();

      await silentRefresh(force: true);

      return Right(product);
    } catch (e) {
      return Left(handleDioError(e));
    }
  }

  @override
  Future<Either<Failure, void>> deleteProduct(String productId) async {
    try {
      await _apiClient.deleteProduct(productId);
      await silentRefresh(force: true);
      return const Right(null);
    } catch (e) {
      return Left(handleDioError(e));
    }
  }

  @override
  Future<Either<Failure, ReorganizeProposal>> reorganizeTopics(
    String productId,
  ) async {
    try {
      final json = await _apiClient.reorganizeProductTopics(productId);
      return Right(ReorganizeProposal.fromJson(json));
    } catch (e) {
      return Left(handleDioError(e));
    }
  }

  @override
  Future<Either<Failure, void>> applyReorganization(
    String productId,
    ReorganizeProposal proposal,
  ) async {
    try {
      await _apiClient.applyProductReorganization(productId, proposal.toJson());
      await silentRefresh(force: true);
      return const Right(null);
    } catch (e) {
      return Left(handleDioError(e));
    }
  }

  @override
  Future<Either<Failure, List<Reference>>> getProductReferences(
    String productId,
  ) async {
    try {
      final referenceModels = await _apiClient.getProductReferences(productId);
      final references = referenceModels.map((model) => model.toEntity()).toList();
      return Right(references);
    } catch (e) {
      return Left(handleDioError(e));
    }
  }

  @override
  Future<Either<Failure, Reference>> addProductReference({
    required String productId,
    required ReferenceType type,
    required String content,
    String? title,
  }) async {
    try {
      final referenceModel = await _apiClient.addProductReference(
        productId: productId,
        type: type.name, // Convert enum to string
        content: content,
        title: title,
      );
      final reference = referenceModel.toEntity();

      // Reference 變更也需要刷新 Product 快取
      await silentRefresh(force: true);

      return Right(reference);
    } catch (e) {
      return Left(handleDioError(e));
    }
  }

  @override
  Future<Either<Failure, Reference>> updateProductReference({
    required String productId,
    required String referenceId,
    required String content,
    String? title,
    String? taskId,
  }) async {
    try {
      final referenceModel = await _apiClient.updateProductReference(
        productId: productId,
        referenceId: referenceId,
        content: content,
        title: title,
        taskId: taskId,
      );
      final reference = referenceModel.toEntity();

      // Reference 變更也需要刷新 Product 快取
      await silentRefresh(force: true);

      return Right(reference);
    } catch (e) {
      return Left(handleDioError(e));
    }
  }

  @override
  Future<Either<Failure, void>> deleteProductReference({
    required String productId,
    required String referenceId,
    String? taskId,
  }) async {
    try {
      await _apiClient.deleteProductReference(
        productId: productId,
        referenceId: referenceId,
        taskId: taskId,
      );

      // Reference 變更也需要刷新 Product 快取
      await silentRefresh(force: true);

      return const Right(null);
    } catch (e) {
      return Left(handleDioError(e));
    }
  }
}
