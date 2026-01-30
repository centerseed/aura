import 'package:dartz/dartz.dart';
import '../../core/errors/failures.dart';
import '../entities/area.dart';

abstract class AreaRepository {
  Future<Either<Failure, List<Area>>> getAreas();
  Future<Either<Failure, Area>> createArea(String name, String description);
}
