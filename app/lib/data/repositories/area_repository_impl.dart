import 'package:dartz/dartz.dart';
import '../../core/errors/failures.dart';
import '../../domain/entities/area.dart';
import '../../domain/repositories/area_repository.dart';
import '../datasources/remote/api_client.dart';

class AreaRepositoryImpl implements AreaRepository {
  final ApiClient _apiClient;

  AreaRepositoryImpl(this._apiClient);

  @override
  Future<Either<Failure, List<Area>>> getAreas() async {
    try {
      final areaModels = await _apiClient.getAreas();
      final areas = areaModels.map((model) => model.toEntity()).toList();
      return Right(areas);
    } catch (e) {
      return Left(ServerFailure(e.toString()));
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
      return Right(model.toEntity());
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }
}
