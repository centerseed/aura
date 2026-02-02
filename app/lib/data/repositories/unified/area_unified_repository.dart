import 'package:dartz/dartz.dart';
import 'package:flutter_dual_cache/flutter_dual_cache.dart';

import '../../../core/errors/dio_error_handler.dart';
import '../../../core/errors/failures.dart';
import '../../../domain/entities/area.dart';
import '../../../domain/repositories/area_repository.dart';
import '../../datasources/remote/api_client.dart';
import '../../models/area_model.dart';

/// Unified Area Repository combining caching and Either-based error handling.
///
/// This repository implements the hybrid pattern:
///
/// ## Query Operations (Stream-based)
/// Uses [CachedRepository] to provide `Stream<CacheState<List<Area>>>` for
/// reactive UI updates with automatic cache management.
///
/// ```dart
/// StreamBuilder<CacheState<List<Area>>>(
///   stream: areaRepo.stream,
///   builder: (context, snapshot) {
///     final state = snapshot.data;
///     if (state == null || state.isLoading) return LoadingWidget();
///     if (state.error != null) return ErrorWidget(state.error);
///     return AreaList(areas: state.data);
///   },
/// )
/// ```
///
/// ## Mutation Operations (Either-based)
/// Uses `Either<Failure, T>` for explicit error handling in use cases,
/// with automatic cache refresh after successful mutations.
///
/// ```dart
/// final result = await areaRepo.createArea(name, description);
/// result.fold(
///   (failure) => showError(failure.message),
///   (area) => showSuccess('Area created'),
/// );
/// ```
///
/// Note: Areas have a longer cache TTL (10 minutes) since they change less
/// frequently than tasks or products.
class AreaUnifiedRepository extends CachedRepository<Area, String>
    implements AreaRepository {
  final ApiClient _apiClient;

  AreaUnifiedRepository(this._apiClient)
      : super(
          boxName: 'areas_unified_v1',
          config: const CacheConfig(
            ttlMinutes: 10,
            backgroundRefreshThrottleSeconds: 60,
          ),
        );

  // ==================== CachedRepository Implementation ====================

  @override
  Future<List<Area>> fetchFromRemote() async {
    final areaModels = await _apiClient.getAreas();
    return areaModels.map((model) => model.toEntity()).toList();
  }

  @override
  Map<String, dynamic> toJson(Area item) {
    return {
      'id': item.id,
      'user_id': '',
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
    return AreaModel.fromJson(json).toEntity();
  }

  @override
  String getId(Area item) => item.id;

  // ==================== AreaRepository Interface ====================

  @override
  Future<Either<Failure, List<Area>>> getAreas() async {
    try {
      final areaModels = await _apiClient.getAreas();
      final areas = areaModels.map((model) => model.toEntity()).toList();
      return Right(areas);
    } catch (e) {
      return Left(handleDioError(e));
    }
  }

  @override
  Future<Either<Failure, Area>> createArea(
    String name,
    String description,
  ) async {
    try {
      final model = await _apiClient.createArea({
        'name': name,
        'description': description,
      });
      final area = model.toEntity();

      await silentRefresh();

      return Right(area);
    } catch (e) {
      return Left(handleDioError(e));
    }
  }
}
