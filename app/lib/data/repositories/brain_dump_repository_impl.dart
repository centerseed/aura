import 'package:dartz/dartz.dart';
import '../../core/errors/failures.dart';
import '../../domain/entities/brain_dump_result.dart';
import '../../domain/repositories/brain_dump_repository.dart';
import '../datasources/remote/api_client.dart';
import '../models/brain_dump_models.dart';

class BrainDumpRepositoryImpl implements BrainDumpRepository {
  final ApiClient _apiClient;

  BrainDumpRepositoryImpl(this._apiClient);

  @override
  Future<Either<Failure, BrainDumpResult>> submit(String text) async {
    try {
      final request = BrainDumpRequest(text: text);
      final response = await _apiClient.brainDump(request);

      final result = BrainDumpResult(
        success: response.success,
        items: response.items
            .map(
              (item) => BrainDumpResultItem(
                id: item.id,
                title: item.title,
                narrative: item.narrative,
                drawer: item.drawer,
                areaName: item.tag.area,
                productName: item.tag.product,
                topicName: item.tag.topic,
                dueDate: item.dueDate != null
                    ? DateTime.tryParse(item.dueDate!)
                    : null,
                timeConfidence: item.timeConfidence,
                timeReasoning: item.timeReasoning,
              ),
            )
            .toList(),
      );

      return Right(result);
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }
}
