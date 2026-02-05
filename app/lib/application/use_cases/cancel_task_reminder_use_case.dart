import 'package:dartz/dartz.dart';

import '../../core/errors/failures.dart';
import '../../core/services/notification_service.dart';
import '../../domain/repositories/notification_repository.dart';
import '../../domain/repositories/task_repository.dart';
import 'use_case.dart';

/// 取消任務提醒 Use Case
/// 負責取消本地通知、刪除本地配置並同步到後端
class CancelTaskReminderUseCase extends UseCase<void, String> {
  final NotificationService notificationService;
  final NotificationRepository notificationRepository;
  final TaskRepository taskRepository;

  CancelTaskReminderUseCase({
    required this.notificationService,
    required this.notificationRepository,
    required this.taskRepository,
  });

  @override
  Future<Either<Failure, void>> call(String taskId) async {
    try {
      // 1. 取得提醒配置
      final reminder = await notificationRepository.getReminderConfig(taskId);

      if (reminder == null) {
        // 沒有提醒配置，直接返回成功
        return const Right(null);
      }

      // 2. 取消本地通知
      await notificationService.cancelReminder(reminder.notificationId);

      // 3. 刪除本地配置
      await notificationRepository.deleteReminderConfig(taskId);

      // 4. 同步到後端（將在 Phase 5 實作）
      // return taskRepository.updateTask(
      //   taskId,
      //   reminderEnabled: false,
      //   remindAt: null,
      //   notificationId: null,
      // );

      return const Right(null);
    } catch (e) {
      return Left(ServerFailure('取消提醒失敗: ${e.toString()}'));
    }
  }
}
