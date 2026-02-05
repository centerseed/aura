import 'package:dartz/dartz.dart';
import 'package:timezone/timezone.dart' as tz;

import '../../core/errors/failures.dart';
import '../../core/services/notification_service.dart';
import '../../domain/repositories/notification_repository.dart';
import '../../domain/repositories/task_repository.dart';
import 'use_case.dart';

/// 排程任務提醒 Use Case
/// 負責協調通知服務、本地儲存和後端同步的完整流程
class ScheduleTaskReminderUseCase extends UseCase<int, ScheduleReminderParams> {
  final NotificationService notificationService;
  final NotificationRepository notificationRepository;
  final TaskRepository taskRepository;

  ScheduleTaskReminderUseCase({
    required this.notificationService,
    required this.notificationRepository,
    required this.taskRepository,
  });

  @override
  Future<Either<Failure, int>> call(ScheduleReminderParams params) async {
    try {
      // 1. 驗證提醒時間（不能是過去）
      if (params.remindAt.isBefore(DateTime.now())) {
        return Left(ValidationFailure('提醒時間不能設定在過去'));
      }

      // 2. 排程本地通知
      final notificationId = await notificationService.scheduleTaskReminder(
        taskId: params.taskId,
        taskContent: params.taskContent,
        remindAt: params.remindAt,
        productName: params.productName,
      );

      // 3. 儲存提醒元數據到 Hive（用於時區變更時重新排程）
      await notificationRepository.saveReminderConfig(
        params.taskId,
        ReminderMetadata(
          taskId: params.taskId,
          taskContent: params.taskContent,
          remindAt: params.remindAt,
          timezone: tz.local.name,
          notificationId: notificationId,
          productName: params.productName,
        ),
      );

      // 4. 同步到後端（更新 Task 實體）
      // 注意：這裡暫時返回成功，後端同步將在 Phase 5 實作
      // final result = await taskRepository.updateTask(
      //   params.taskId,
      //   remindAt: params.remindAt,
      //   reminderEnabled: true,
      //   reminderTimezone: tz.local.name,
      //   notificationId: notificationId,
      // );
      //
      // return result.fold(
      //   (failure) => Left(failure),
      //   (_) => Right(notificationId),
      // );

      return Right(notificationId);
    } catch (e) {
      return Left(ServerFailure('排程提醒失敗: ${e.toString()}'));
    }
  }
}

/// 排程提醒參數
class ScheduleReminderParams {
  final String taskId;
  final String taskContent;
  final DateTime remindAt;
  final String? productName;

  const ScheduleReminderParams({
    required this.taskId,
    required this.taskContent,
    required this.remindAt,
    this.productName,
  });
}
