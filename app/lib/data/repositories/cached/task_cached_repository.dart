import 'package:flutter_dual_cache/flutter_dual_cache.dart';

import '../../../domain/entities/task.dart';
import '../../datasources/remote/api_client.dart';
import '../../models/task_model.dart';

/// Task Repository with dual-track caching.
///
/// Implements Stale-While-Revalidate pattern:
/// 1. Instantly display cached tasks
/// 2. Fetch fresh data from API in background
/// 3. Update UI when new data arrives
class TaskCachedRepository extends CachedRepository<Task, String> {
  final ApiClient _apiClient;

  TaskCachedRepository(this._apiClient)
      : super(
          boxName: 'tasks_cache_v2',
          config: const CacheConfig(
            ttlMinutes: 5,
            backgroundRefreshThrottleSeconds: 30,
          ),
        );

  @override
  Future<List<Task>> fetchFromRemote() async {
    final taskModels = await _apiClient.getTasks();
    return taskModels.map((model) => model.toEntity()).toList();
  }

  @override
  Map<String, dynamic> toJson(Task item) {
    // Convert Task entity back to TaskModel JSON format
    return {
      'id': item.id,
      'user_id': '', // Not needed for cache
      'product_id': item.productId,
      'topic_id': item.topicId,
      'content': item.content,
      'status': item.status.name.toUpperCase(),
      'due_date': item.dueDate?.toIso8601String(),
      'start_date': item.startDate?.toIso8601String(),
      'time_confidence': item.timeConfidence,
      'sub_items': item.subItems
          ?.map((s) => {
                'id': s.id,
                'content': s.content,
                'completed': s.completed,
                'completed_at': s.completedAt?.toIso8601String(),
              })
          .toList(),
      'tag': {
        'area': item.areaName,
        'product': item.productName,
        'topic': item.topicName,
      },
      'tags': item.tags,
      'created_at': item.createdAt?.toIso8601String(),
      'updated_at': item.updatedAt?.toIso8601String(),
      'deleted_at': item.deletedAt?.toIso8601String(),
    };
  }

  @override
  Task fromJson(Map<String, dynamic> json) {
    final model = TaskModel.fromJson(json);
    return model.toEntity();
  }

  @override
  String getId(Task item) => item.id;

  @override
  List<Task> transformForDisplay(List<Task> data) {
    // Filter out archived tasks for display
    return data.where((task) => task.status != TaskStatus.archive).toList();
  }
}
