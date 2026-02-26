import 'package:dartz/dartz.dart';
import 'package:dio/dio.dart';
import '../../core/errors/failures.dart';
import '../../domain/entities/product.dart';
import '../../domain/entities/reference.dart';
import '../../domain/entities/reorganize_proposal.dart';
import '../../domain/repositories/product_repository.dart';
import '../datasources/remote/api_client.dart';

class ProductRepositoryImpl implements ProductRepository {
  final ApiClient _apiClient;

  ProductRepositoryImpl(this._apiClient);

  @override
  Future<Either<Failure, List<Product>>> getProducts() async {
    try {
      final productModels = await _apiClient.getProducts();
      final products = productModels.map((model) => model.toEntity()).toList();
      return Right(products);
    } catch (e) {
      if (e is DioException) {
        return Left(ServerFailure(e.message ?? 'Unknown error'));
      }
      return Left(ServerFailure(e.toString()));
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
        'area_id': areaId,
        'description': '',
        // Default lifecycle and status handled by backend if omitted?
        // Or we might need to specify enum strings.
        // Assuming backend defaults for now based on typical behavior.
      };
      final model = await _apiClient.createProduct(payload);
      return Right(model.toEntity());
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, ReorganizeProposal>> reorganizeTopics(
    String productId,
  ) async {
    try {
      final json = await _apiClient.reorganizeProductTopics(productId);

      // 🔍 調試：打印 API 返回的原始數據
      print('🔍 [API Response] task_consolidations: ${json['task_consolidations']}');
      print('🔍 [API Response] task_consolidations type: ${json['task_consolidations'].runtimeType}');
      if (json['task_consolidations'] is List) {
        print('🔍 [API Response] task_consolidations length: ${(json['task_consolidations'] as List).length}');
      }

      return Right(ReorganizeProposal.fromJson(json));
    } catch (e) {
      if (e is DioException) {
        return Left(ServerFailure(e.message ?? 'Reorganization failed'));
      }
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, void>> applyReorganization(
    String productId,
    ReorganizeProposal proposal,
  ) async {
    try {
      await _apiClient.applyProductReorganization(productId, proposal.toJson());
      return const Right(null);
    } catch (e) {
      if (e is DioException) {
        return Left(ServerFailure(e.message ?? 'Apply reorganization failed'));
      }
      return Left(ServerFailure(e.toString()));
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
      if (e is DioException) {
        return Left(ServerFailure(e.message ?? 'Failed to fetch references'));
      }
      return Left(ServerFailure(e.toString()));
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
      final typeString = type == ReferenceType.url ? 'url' : 'note';
      final referenceModel = await _apiClient.addProductReference(
        productId: productId,
        type: typeString,
        content: content,
        title: title,
      );
      return Right(referenceModel.toEntity());
    } catch (e) {
      if (e is DioException) {
        return Left(ServerFailure(e.message ?? 'Failed to add reference'));
      }
      return Left(ServerFailure(e.toString()));
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
      return Right(referenceModel.toEntity());
    } catch (e) {
      if (e is DioException) {
        return Left(ServerFailure(e.message ?? 'Failed to update reference'));
      }
      return Left(ServerFailure(e.toString()));
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
      return const Right(null);
    } catch (e) {
      if (e is DioException) {
        return Left(ServerFailure(e.message ?? 'Failed to delete reference'));
      }
      return Left(ServerFailure(e.toString()));
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
  }) async {
    try {
      final payload = <String, dynamic>{};
      if (name != null) payload['name'] = name;
      if (description != null) payload['description'] = description;
      if (areaId != null) payload['area_id'] = areaId;
      if (status != null) payload['status'] = status.name.toUpperCase();
      if (lifecycle != null) payload['lifecycle'] = lifecycle.name.toUpperCase();

      final model = await _apiClient.updateProduct(productId, payload);
      return Right(model.toEntity());
    } catch (e) {
      if (e is DioException) {
        return Left(ServerFailure(e.message ?? 'Failed to update product'));
      }
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, void>> deleteProduct(String productId) async {
    try {
      await _apiClient.deleteProduct(productId);
      return const Right(null);
    } catch (e) {
      if (e is DioException) {
        // 後端返回 409 Conflict 表示專案有進行中的任務
        if (e.response?.statusCode == 409) {
          final errorData = e.response?.data;
          if (errorData is Map<String, dynamic> &&
              errorData['success'] == false &&
              errorData['error'] is Map<String, dynamic>) {
            final errorMessage = errorData['error']['message'] as String?;
            return Left(ServerFailure(
              errorMessage ?? '此專案仍有進行中的任務，無法刪除'
            ));
          }
        }
        return Left(ServerFailure(e.message ?? 'Failed to delete product'));
      }
      return Left(ServerFailure(e.toString()));
    }
  }
}
