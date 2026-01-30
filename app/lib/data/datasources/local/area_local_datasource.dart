import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';

import '../../../core/cache/cache_config.dart';
import '../../../domain/entities/area.dart';
import '../../models/area_model.dart';

/// Area 本地數據源介面
abstract class AreaLocalDataSource {
  /// 從快取讀取所有 Areas
  Future<List<Area>> getCachedAreas();

  /// 儲存 Areas 到快取
  Future<void> cacheAreas(List<AreaModel> areas);

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
class AreaLocalDataSourceImpl implements AreaLocalDataSource {
  final Box<Map> _areasBox;

  AreaLocalDataSourceImpl(this._areasBox);

  @override
  Future<List<Area>> getCachedAreas() async {
    final List<Area> areas = [];

    for (final key in _areasBox.keys) {
      if (key == CacheConfig.lastSyncKey) continue;

      final data = _areasBox.get(key);
      if (data != null) {
        try {
          final model = AreaModel.fromJson(Map<String, dynamic>.from(data));
          areas.add(model.toEntity());
        } catch (e) {
          debugPrint('Failed to parse cached area: $e');
        }
      }
    }

    return areas;
  }

  @override
  Future<void> cacheAreas(List<AreaModel> areas) async {
    final keysToDelete =
        _areasBox.keys.where((k) => k != CacheConfig.lastSyncKey).toList();
    await _areasBox.deleteAll(keysToDelete);

    for (final area in areas) {
      await _areasBox.put(area.id, area.toJson());
    }

    await updateSyncTime();
  }

  @override
  DateTime? getLastSyncTime() {
    final timestamp = _areasBox.get(CacheConfig.lastSyncKey)?['timestamp'];
    if (timestamp is int) {
      return DateTime.fromMillisecondsSinceEpoch(timestamp);
    }
    return null;
  }

  @override
  Future<void> updateSyncTime() async {
    await _areasBox.put(CacheConfig.lastSyncKey, {
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    });
  }

  @override
  Future<void> clearCache() async {
    await _areasBox.clear();
  }

  @override
  bool isCacheStale(Duration ttl) {
    final lastSync = getLastSyncTime();
    if (lastSync == null) return true;
    return DateTime.now().difference(lastSync) > ttl;
  }
}
