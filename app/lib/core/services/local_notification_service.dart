import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:timezone/data/latest_all.dart' as tz;
import 'package:timezone/timezone.dart' as tz;

import '../../domain/entities/task.dart';
import 'notification_service.dart';

/// 本地通知服務實作
/// 使用 flutter_local_notifications 套件實作跨平台通知功能
class LocalNotificationService implements NotificationService {
  final FlutterLocalNotificationsPlugin _plugin;

  /// 通知 ID 計數器（確保每個通知都有唯一 ID）
  static int _notificationIdCounter = 1000;

  /// 通知渠道 ID（Android）
  static const String _channelId = 'task_reminders';
  static const String _channelName = '任務提醒';
  static const String _channelDescription = '顯示任務到期提醒通知';

  LocalNotificationService(this._plugin);

  @override
  Future<void> initialize() async {
    // 1. 初始化 Android 設定
    const androidSettings = AndroidInitializationSettings('@mipmap/launcher_icon');

    // 2. 初始化 iOS 設定
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    // 3. 組合初始化設定
    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    // 4. 初始化 Plugin
    await _plugin.initialize(
      initSettings,
      onDidReceiveNotificationResponse: _onNotificationTapped,
    );

    // 5. 初始化時區資料庫
    tz.initializeTimeZones();
    final localTimezone = await FlutterTimezone.getLocalTimezone();
    final location = tz.getLocation(localTimezone);
    tz.setLocalLocation(location);
  }

  @override
  Future<bool> requestPermission() async {
    // Android 13+ 需要動態請求通知權限
    if (await _isAndroid()) {
      final androidImplementation =
          _plugin.resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>();

      if (androidImplementation != null) {
        final granted = await androidImplementation.requestNotificationsPermission();
        return granted ?? false;
      }
    }

    // iOS 請求權限
    final iosImplementation =
        _plugin.resolvePlatformSpecificImplementation<
            IOSFlutterLocalNotificationsPlugin>();

    if (iosImplementation != null) {
      final granted = await iosImplementation.requestPermissions(
        alert: true,
        badge: true,
        sound: true,
      );
      return granted ?? false;
    }

    return true; // 其他平台預設為 true
  }

  @override
  Future<int> scheduleTaskReminder({
    required String taskId,
    required String taskContent,
    required DateTime remindAt,
    String? productName,
  }) async {
    // 1. 生成唯一通知 ID
    final notificationId = _notificationIdCounter++;

    // 2. 轉換為 TZDateTime（時區感知）
    final scheduledDate = tz.TZDateTime.from(remindAt, tz.local);

    // 3. 構建通知內容
    final title = productName != null
        ? '任務提醒 • $productName'
        : '任務提醒';

    // 4. 配置通知詳情
    final notificationDetails = NotificationDetails(
      android: AndroidNotificationDetails(
        _channelId,
        _channelName,
        channelDescription: _channelDescription,
        importance: Importance.high,
        priority: Priority.high,
        icon: '@mipmap/launcher_icon',
        // 通知樣式
        styleInformation: BigTextStyleInformation(taskContent),
        // 通知行為
        enableVibration: true,
        playSound: true,
      ),
      iOS: DarwinNotificationDetails(
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
        subtitle: productName,
      ),
    );

    // 5. 排程通知
    await _plugin.zonedSchedule(
      notificationId,
      title,
      taskContent,
      scheduledDate,
      notificationDetails,
      androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
      uiLocalNotificationDateInterpretation:
          UILocalNotificationDateInterpretation.absoluteTime,
      payload: taskId, // 用於點擊通知時導航
    );

    return notificationId;
  }

  @override
  Future<void> cancelReminder(int notificationId) async {
    await _plugin.cancel(notificationId);
  }

  @override
  Future<void> cancelAllReminders() async {
    await _plugin.cancelAll();
  }

  @override
  Future<void> rescheduleAllReminders(List<Task> tasks) async {
    // 1. 取消所有現有通知
    await cancelAllReminders();

    // 2. 重新排程所有啟用提醒的任務
    for (final task in tasks) {
      if (task.reminderEnabled && task.remindAt != null) {
        // 確保提醒時間在未來
        if (task.remindAt!.isAfter(DateTime.now())) {
          await scheduleTaskReminder(
            taskId: task.id,
            taskContent: task.content,
            remindAt: task.remindAt!,
            productName: task.productName,
          );
        }
      }
    }
  }

  @override
  Future<int> getPendingNotificationCount() async {
    final pendingNotifications = await _plugin.pendingNotificationRequests();
    return pendingNotifications.length;
  }

  /// 通知點擊回調
  /// TODO: 實作導航到任務詳情頁的邏輯
  Future<void> _onNotificationTapped(NotificationResponse response) async {
    final taskId = response.payload;

    if (taskId != null) {
      // 使用 GoRouter 導航到任務詳情頁
      // 需要透過 Global NavigatorKey 或 ProviderContainer 實作
      // 參考: navigatorKey.currentState?.pushNamed('/task/$taskId');
      print('通知被點擊，任務 ID: $taskId');
    }
  }

  /// 檢查是否為 Android 平台
  Future<bool> _isAndroid() async {
    // 簡化實作，可根據需要改用 Platform.isAndroid
    try {
      final androidImplementation =
          _plugin.resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>();
      return androidImplementation != null;
    } catch (e) {
      return false;
    }
  }
}
