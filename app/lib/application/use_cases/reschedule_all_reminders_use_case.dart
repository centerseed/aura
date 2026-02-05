import 'package:dartz/dartz.dart';
import 'package:timezone/timezone.dart' as tz;

import '../../core/errors/failures.dart';
import '../../core/services/notification_service.dart';
import '../../domain/repositories/notification_repository.dart';
import '../../domain/repositories/task_repository.dart';
import 'use_case.dart';

/// 重新排程所有提醒 Use Case
/// 用於時區變更時自動調整所有提醒時間
class RescheduleAllRemindersUseCase extends NoParamsUseCase<int> {
  final NotificationService notificationService;
  final NotificationRepository notificationRepository;
  final TaskRepository taskRepository;

  RescheduleAllRemindersUseCase({
    required this.notificationService,
    required this.notificationRepository,
    required this.taskRepository,
  });

  @override
  Future<Either<Failure, int>> call() async {
    try {
      // 1. 取得所有啟用提醒的任務配置
      final reminders = await notificationRepository.getAllActiveReminders();

      if (reminders.isEmpty) {
        // 沒有提醒需要重新排程
        return const Right(0);
      }

      // 2. 取消所有現有通知
      await notificationService.cancelAllReminders();

      // 3. 逐一重新排程
      int rescheduledCount = 0;

      for (final reminder in reminders) {
        try {
          // 確保提醒時間仍在未來
          if (reminder.remindAt.isAfter(DateTime.now())) {
            // 重新排程通知
            final newNotificationId = await notificationService.scheduleTaskReminder(
              taskId: reminder.taskId,
              taskContent: reminder.taskContent,
              remindAt: reminder.remindAt,
              productName: reminder.productName,
            );

            // 更新元數據（使用新的通知 ID 和時區）
            await notificationRepository.saveReminderConfig(
              reminder.taskId,
              reminder.copyWith(
                notificationId: newNotificationId,
                timezone: tz.local.name,
              ),
            );

            rescheduledCount++;
          } else {
            // 提醒時間已過期，刪除配置
            await notificationRepository.deleteReminderConfig(reminder.taskId);
          }
        } catch (e) {
          // 單個提醒重新排程失敗時繼續處理其他提醒
          print('重新排程提醒失敗 (taskId: ${reminder.taskId}): $e');
          continue;
        }
      }

      return Right(rescheduledCount);
    } catch (e) {
      return Left(ServerFailure('重新排程所有提醒失敗: ${e.toString()}'));
    }
  }
}
