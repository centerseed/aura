import 'package:flutter_dual_cache/flutter_dual_cache.dart';

import '../../../domain/entities/area.dart';
import '../../datasources/remote/api_client.dart';
import '../../models/area_model.dart';

/// Area Repository with dual-track caching.
///
/// Implements Stale-While-Revalidate pattern for Areas.
class AreaCachedRepository extends CachedRepository<Area, String> {
  final ApiClient _apiClient;

  AreaCachedRepository(this._apiClient)
      : super(
          boxName: 'areas_cache_v2',
          config: const CacheConfig(
            ttlMinutes: 10, // Areas change less frequently
            backgroundRefreshThrottleSeconds: 60,
          ),
        );

  @override
  Future<List<Area>> fetchFromRemote() async {
    final areaModels = await _apiClient.getAreas();
    return areaModels.map((model) => model.toEntity()).toList();
  }

  @override
  Map<String, dynamic> toJson(Area item) {
    return {
      'id': item.id,
      'user_id': '', // Not needed for cache
      'name': item.name,
      'description': item.description,
      'scope': item.scope,
      'rolling_summary': item.rollingSummary,
      'is_custom': item.isCustom,
      'created_at': item.createdAt?.toIso8601String(),
      'updated_at': item.updatedAt?.toIso8601String(),
    };
  }

  @override
  Area fromJson(Map<String, dynamic> json) {
    final model = AreaModel.fromJson(json);
    return model.toEntity();
  }

  @override
  String getId(Area item) => item.id;
}
