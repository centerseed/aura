import '../../domain/entities/task.dart';

/// 通知服務介面
/// 負責管理本地通知的排程、取消和重新排程
abstract class NotificationService {
  /// 初始化通知系統
  /// 配置 Android/iOS 平台設定並初始化時區資料庫
  Future<void> initialize();

  /// 請求通知權限
  /// 返回：true 表示權限已授予，false 表示被拒絕
  Future<bool> requestPermission();

  /// 排程任務提醒通知
  ///
  /// [taskId] 任務 ID（用於點擊通知時導航）
  /// [taskContent] 任務內容（通知正文）
  /// [remindAt] 提醒時間（本地時區）
  /// [productName] 產品名稱（用於通知標題，可選）
  ///
  /// 返回：本地通知 ID（用於後續取消）
  Future<int> scheduleTaskReminder({
    required String taskId,
    required String taskContent,
    required DateTime remindAt,
    String? productName,
  });

  /// 取消特定提醒
  ///
  /// [notificationId] 本地通知 ID
  Future<void> cancelReminder(int notificationId);

  /// 取消所有提醒
  Future<void> cancelAllReminders();

  /// 重新排程所有提醒（用於時區變更）
  ///
  /// [tasks] 需要重新排程的任務列表
  Future<void> rescheduleAllReminders(List<Task> tasks);

  /// 取得待處理的通知數量
  Future<int> getPendingNotificationCount();
}
