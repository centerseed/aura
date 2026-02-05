import 'package:equatable/equatable.dart';

/// 通知儲存庫介面 (Domain Layer)
/// 負責管理提醒配置的持久化
abstract class NotificationRepository {
  /// 儲存提醒配置
  Future<void> saveReminderConfig(String taskId, ReminderMetadata metadata);

  /// 取得所有啟用的提醒配置
  Future<List<ReminderMetadata>> getAllActiveReminders();

  /// 刪除提醒配置
  Future<void> deleteReminderConfig(String taskId);

  /// 取得特定任務的提醒配置
  Future<ReminderMetadata?> getReminderConfig(String taskId);
}

/// 提醒元數據 (Value Object)
/// 用於在本地儲存提醒相關資訊，支援時區變更時重新排程
class ReminderMetadata extends Equatable {
  final String taskId;
  final String taskContent;          // 任務內容（用於通知顯示）
  final DateTime remindAt;            // 提醒時間（本地時區）
  final String timezone;              // IANA 時區（如 "Asia/Taipei"）
  final int notificationId;           // 本地通知 ID（用於取消）
  final String? productName;          // 產品名稱（用於通知標題）

  const ReminderMetadata({
    required this.taskId,
    required this.taskContent,
    required this.remindAt,
    required this.timezone,
    required this.notificationId,
    this.productName,
  });

  @override
  List<Object?> get props => [
        taskId,
        taskContent,
        remindAt,
        timezone,
        notificationId,
        productName,
      ];

  /// 從 JSON 反序列化
  factory ReminderMetadata.fromJson(Map<String, dynamic> json) {
    return ReminderMetadata(
      taskId: json['task_id'] as String,
      taskContent: json['task_content'] as String,
      remindAt: DateTime.parse(json['remind_at'] as String),
      timezone: json['timezone'] as String,
      notificationId: json['notification_id'] as int,
      productName: json['product_name'] as String?,
    );
  }

  /// 序列化為 JSON
  Map<String, dynamic> toJson() {
    return {
      'task_id': taskId,
      'task_content': taskContent,
      'remind_at': remindAt.toIso8601String(),
      'timezone': timezone,
      'notification_id': notificationId,
      'product_name': productName,
    };
  }

  /// 創建副本
  ReminderMetadata copyWith({
    String? taskId,
    String? taskContent,
    DateTime? remindAt,
    String? timezone,
    int? notificationId,
    String? productName,
  }) {
    return ReminderMetadata(
      taskId: taskId ?? this.taskId,
      taskContent: taskContent ?? this.taskContent,
      remindAt: remindAt ?? this.remindAt,
      timezone: timezone ?? this.timezone,
      notificationId: notificationId ?? this.notificationId,
      productName: productName ?? this.productName,
    );
  }
}
