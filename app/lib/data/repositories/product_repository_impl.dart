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
}
