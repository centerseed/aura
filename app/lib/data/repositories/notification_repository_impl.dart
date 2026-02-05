import 'package:hive/hive.dart';

import '../../domain/repositories/notification_repository.dart';

/// 通知儲存庫實作
/// 使用 Hive 本地儲存提醒元數據，用於時區變更時重新排程
class NotificationRepositoryImpl implements NotificationRepository {
  final Box<Map> _reminderBox;

  /// Hive Box 名稱（用於在 main.dart 中初始化）
  static const String boxName = 'reminders';

  NotificationRepositoryImpl(this._reminderBox);

  @override
  Future<void> saveReminderConfig(
    String taskId,
    ReminderMetadata metadata,
  ) async {
    try {
      await _reminderBox.put(taskId, metadata.toJson());
    } catch (e) {
      throw Exception('儲存提醒配置失敗: $e');
    }
  }

  @override
  Future<List<ReminderMetadata>> getAllActiveReminders() async {
    try {
      final reminders = <ReminderMetadata>[];

      for (final key in _reminderBox.keys) {
        final data = _reminderBox.get(key);
        if (data != null && data is Map<String, dynamic>) {
          reminders.add(ReminderMetadata.fromJson(data));
        }
      }

      return reminders;
    } catch (e) {
      throw Exception('取得提醒配置失敗: $e');
    }
  }

  @override
  Future<void> deleteReminderConfig(String taskId) async {
    try {
      await _reminderBox.delete(taskId);
    } catch (e) {
      throw Exception('刪除提醒配置失敗: $e');
    }
  }

  @override
  Future<ReminderMetadata?> getReminderConfig(String taskId) async {
    try {
      final data = _reminderBox.get(taskId);
      if (data != null && data is Map<String, dynamic>) {
        return ReminderMetadata.fromJson(data);
      }
      return null;
    } catch (e) {
      throw Exception('取得提醒配置失敗: $e');
    }
  }

  /// 清除所有提醒配置（用於測試或重置）
  Future<void> clearAll() async {
    try {
      await _reminderBox.clear();
    } catch (e) {
      throw Exception('清除所有提醒配置失敗: $e');
    }
  }

  /// 取得提醒配置數量
  int get count => _reminderBox.length;
}
