import 'dart:io';
import 'package:dartz/dartz.dart';
import '../../core/errors/dio_error_handler.dart';
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
      return Right(_mapResponse(response));
    } catch (e) {
      return Left(handleDioError(e));
    }
  }

  @override
  Future<Either<Failure, BrainDumpResult>> submitWithImage({
    required File imageFile,
    String text = '',
  }) async {
    try {
      final mimeType = _getMimeType(imageFile.path);
      final response = await _apiClient.brainDumpWithImage(
        imagePath: imageFile.path,
        mimeType: mimeType,
        text: text,
      );
      return Right(_mapResponse(response));
    } catch (e) {
      return Left(handleDioError(e));
    }
  }

  String _getMimeType(String path) {
    final ext = path.split('.').last.toLowerCase();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      default:
        return 'image/jpeg';
    }
  }

  BrainDumpResult _mapResponse(BrainDumpResponse response) {
    return response.when(
      createNewTasks: (success, items) {
        return BrainDumpResult(
          success: success,
          action: BrainDumpAction.createNewTasks,
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
                  timeReasoning: null,
                ),
              )
              .toList(),
        );
      },
      appendSubItem: (success, targetTask, appendedSubItems, reasoning) {
        return BrainDumpResult(
          success: success,
          action: BrainDumpAction.appendSubItem,
          items: [],
          appendInfo: AppendSubItemInfo(
            targetTaskId: targetTask.id,
            targetTaskContent: targetTask.content,
            targetProductName: targetTask.product,
            appendedItems: appendedSubItems.map((s) => s.content).toList(),
            reasoning: reasoning,
          ),
        );
      },
    );
  }
}
