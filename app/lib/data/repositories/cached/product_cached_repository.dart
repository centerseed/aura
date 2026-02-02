import 'package:flutter_dual_cache/flutter_dual_cache.dart';

import '../../../domain/entities/product.dart';
import '../../datasources/remote/api_client.dart';
import '../../models/product_model.dart';

/// Product Repository with dual-track caching.
///
/// Implements Stale-While-Revalidate pattern for Products.
class ProductCachedRepository extends CachedRepository<Product, String> {
  final ApiClient _apiClient;

  ProductCachedRepository(this._apiClient)
      : super(
          boxName: 'products_cache_v2',
          config: const CacheConfig(
            ttlMinutes: 5,
            backgroundRefreshThrottleSeconds: 30,
          ),
        );

  @override
  Future<List<Product>> fetchFromRemote() async {
    final productModels = await _apiClient.getProducts();
    return productModels.map((model) => model.toEntity()).toList();
  }

  @override
  Map<String, dynamic> toJson(Product item) {
    return {
      'id': item.id,
      'user_id': '', // Not needed for cache
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
    final model = ProductModel.fromJson(json);
    return model.toEntity();
  }

  @override
  String getId(Product item) => item.id;
}
