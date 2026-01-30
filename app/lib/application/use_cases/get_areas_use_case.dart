import 'package:dartz/dartz.dart';
import '../../core/errors/failures.dart';
import '../../domain/entities/area.dart';
import '../../domain/repositories/area_repository.dart';
import 'use_case.dart';

/// 獲取領域列表 Use Case
class GetAreasUseCase extends NoParamsUseCase<List<Area>> {
  final AreaRepository repository;

  GetAreasUseCase(this.repository);

  @override
  Future<Either<Failure, List<Area>>> call() async {
    return await repository.getAreas();
  }
}
