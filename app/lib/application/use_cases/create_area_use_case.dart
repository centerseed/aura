import 'package:dartz/dartz.dart';
import '../../core/errors/failures.dart';
import '../../domain/entities/area.dart';
import '../../domain/repositories/area_repository.dart';
import 'use_case.dart';

class CreateAreaParams {
  final String name;
  final String description;

  const CreateAreaParams({required this.name, this.description = ''});
}

class CreateAreaUseCase extends UseCase<Area, CreateAreaParams> {
  final AreaRepository repository;

  CreateAreaUseCase(this.repository);

  @override
  Future<Either<Failure, Area>> call(CreateAreaParams params) async {
    return await repository.createArea(params.name, params.description);
  }
}
