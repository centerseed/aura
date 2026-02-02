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

      // 使用 when 方法處理不同的回應類型
      return response.when(
        createNewTasks: (success, items) {
          final result = BrainDumpResult(
            success: success,
            items: items
                .map(
                  (item) => BrainDumpResultItem(
                    id: item.id,
                    title: item.title,
                    narrative: item.narrative,
                    drawer: item.drawer,
                    areaName: item.tag.area,
                    productName: item.tag.product,
                    topicName: item.tag.topic,
                    strategyUsed: item.strategyUsed,
                    reasoning: item.reasoning,
                    dueDate: item.dueDate != null
                        ? DateTime.tryParse(item.dueDate!)
                        : null,
                    timeConfidence: item.timeConfidence,
                    timeReasoning: null, // timeReasoning 已從 BrainDumpItem 移除
                  ),
                )
                .toList(),
          );
          return Right(result);
        },
        appendSubItem: (success, targetTask, appendedSubItems, reasoning) {
          // 對於 append sub-item 的情況，返回空列表
          // TODO: 未來可能需要不同的處理邏輯
          final result = BrainDumpResult(
            success: success,
            items: [],
          );
          return Right(result);
        },
      );
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }
}
