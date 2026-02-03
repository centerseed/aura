import 'package:flutter_dual_cache/flutter_dual_cache.dart';

import '../../../domain/entities/task.dart';
import '../../datasources/remote/api_client.dart';
import '../../models/task_model.dart';
import '../mixins/task_json_converter.dart';

/// Task Repository with dual-track caching.
///
/// Implements Stale-While-Revalidate pattern:
/// 1. Instantly display cached tasks
/// 2. Fetch fresh data from API in background
/// 3. Update UI when new data arrives
class TaskCachedRepository extends CachedRepository<Task, String>
    with TaskJsonConverter {
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
  Map<String, dynamic> toJson(Task item) => taskToJson(item);

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
