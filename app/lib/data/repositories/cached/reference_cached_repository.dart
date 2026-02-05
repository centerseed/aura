import 'package:flutter_dual_cache/flutter_dual_cache.dart';

import '../../../domain/entities/reference.dart';
import '../../datasources/remote/api_client.dart';
import '../../models/reference_model.dart';

/// Reference Repository with dual-track caching.
///
/// Implements Stale-While-Revalidate pattern for References:
/// 1. Instantly display cached references
/// 2. Fetch fresh data from API in background
/// 3. Update UI when new data arrives
///
/// Each product has its own cache instance.
class ReferenceCachedRepository extends CachedRepository<Reference, String> {
  final ApiClient _apiClient;
  final String productId;

  ReferenceCachedRepository({
    required ApiClient apiClient,
    required this.productId,
  })  : _apiClient = apiClient,
        super(
          boxName: 'references_$productId',
          config: const CacheConfig(
            ttlMinutes: 10, // References 可以快取較久
            backgroundRefreshThrottleSeconds: 30,
          ),
        );

  @override
  Future<List<Reference>> fetchFromRemote() async {
    final referenceModels = await _apiClient.getProductReferences(productId);
    return referenceModels.map((model) => model.toEntity()).toList();
  }

  @override
  Map<String, dynamic> toJson(Reference item) {
    return {
      'id': item.id,
      'type': item.type.name,
      'content': item.content,
      'title': item.title,
      'created_at': item.createdAt.toIso8601String(),
    };
  }

  @override
  Reference fromJson(Map<String, dynamic> json) {
    final model = ReferenceModel.fromJson(json);
    return model.toEntity();
  }

  @override
  String getId(Reference item) => item.id;

  /// 清除此 product 的 reference 快取
  Future<void> clearCache() async {
    await invalidate();
  }
}
