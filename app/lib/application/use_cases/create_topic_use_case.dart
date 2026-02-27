import 'package:dartz/dartz.dart';
import '../../core/errors/failures.dart';
import '../../data/datasources/remote/api_client.dart';
import 'use_case.dart';

class CreateTopicParams {
  final String productId;
  final String name;

  const CreateTopicParams({required this.productId, required this.name});
}

class CreateTopicUseCase extends UseCase<Map<String, dynamic>, CreateTopicParams> {
  final ApiClient apiClient;

  CreateTopicUseCase(this.apiClient);

  @override
  Future<Either<Failure, Map<String, dynamic>>> call(CreateTopicParams params) async {
    try {
      final result = await apiClient.createTopic(params.productId, params.name);
      return Right(result);
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }
}
