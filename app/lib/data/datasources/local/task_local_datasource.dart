import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';

import '../../../core/cache/cache_config.dart';
import '../../../domain/entities/task.dart';
import '../../models/task_model.dart';

/// Task 本地數據源介面
abstract class TaskLocalDataSource {
  /// 從快取讀取所有 Tasks
  Future<List<Task>> getCachedTasks();

  /// 儲存 Tasks 到快取
  Future<void> cacheTasks(List<TaskModel> tasks);

  /// 取得上次同步時間
  DateTime? getLastSyncTime();

  /// 更新同步時間
  Future<void> updateSyncTime();

  /// 清除快取
  Future<void> clearCache();

  /// 快取是否過期
  bool isCacheStale(Duration ttl);
}

/// Hive 實作
class TaskLocalDataSourceImpl implements TaskLocalDataSource {
  final Box<Map> _tasksBox;

  TaskLocalDataSourceImpl(this._tasksBox);

  @override
  Future<List<Task>> getCachedTasks() async {
    final List<Task> tasks = [];

    for (final key in _tasksBox.keys) {
      if (key == CacheConfig.lastSyncKey) continue;

      final data = _tasksBox.get(key);
      if (data != null) {
        try {
          final model = TaskModel.fromJson(Map<String, dynamic>.from(data));
          tasks.add(model.toEntity());
        } catch (e) {
          debugPrint('Failed to parse cached task: $e');
        }
      }
    }

    return tasks;
  }

  @override
  Future<void> cacheTasks(List<TaskModel> tasks) async {
    // 清除舊資料 (除了 metadata)
    final keysToDelete =
        _tasksBox.keys.where((k) => k != CacheConfig.lastSyncKey).toList();
    await _tasksBox.deleteAll(keysToDelete);

    // 寫入新資料
    for (final task in tasks) {
      await _tasksBox.put(task.id, task.toJson());
    }

    await updateSyncTime();
  }

  @override
  DateTime? getLastSyncTime() {
    final timestamp = _tasksBox.get(CacheConfig.lastSyncKey)?['timestamp'];
    if (timestamp is int) {
      return DateTime.fromMillisecondsSinceEpoch(timestamp);
    }
    return null;
  }

  @override
  Future<void> updateSyncTime() async {
    await _tasksBox.put(CacheConfig.lastSyncKey, {
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    });
  }

  @override
  Future<void> clearCache() async {
    await _tasksBox.clear();
  }

  @override
  bool isCacheStale(Duration ttl) {
    final lastSync = getLastSyncTime();
    if (lastSync == null) return true;
    return DateTime.now().difference(lastSync) > ttl;
  }
}
