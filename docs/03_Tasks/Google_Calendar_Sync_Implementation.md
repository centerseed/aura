# Google Calendar 同步功能實現計畫

## 需求概述
為 Flutter app 中的 Task 提醒功能添加 Google 日曆同步能力。

## 技術方案

### 1. 添加依賴套件

```yaml
# pubspec.yaml
dependencies:
  googleapis: ^13.2.0
  extension_google_sign_in_as_googleapis_auth: ^2.0.12
```

### 2. 擴展 Google Sign-In Scope

```dart
// 在 Google Sign-In 初始化時添加日曆權限
GoogleSignIn(
  scopes: [
    'email',
    'https://www.googleapis.com/auth/calendar.events', // 新增
  ],
)
```

### 3. 建立 Calendar Service

```dart
// lib/domain/repositories/calendar_repository.dart
abstract class CalendarRepository {
  /// 同步任務提醒到 Google Calendar
  Future<Either<Failure, String>> syncTaskToCalendar({
    required Task task,
    required DateTime remindAt,
  });

  /// 從 Google Calendar 移除事件
  Future<Either<Failure, void>> removeCalendarEvent(String eventId);

  /// 更新 Calendar 事件
  Future<Either<Failure, void>> updateCalendarEvent({
    required String eventId,
    required DateTime newRemindAt,
  });
}
```

### 4. 實作 Calendar Repository

```dart
// lib/infrastructure/repositories/google_calendar_repository_impl.dart
class GoogleCalendarRepositoryImpl implements CalendarRepository {
  final GoogleSignIn _googleSignIn;

  @override
  Future<Either<Failure, String>> syncTaskToCalendar({
    required Task task,
    required DateTime remindAt,
  }) async {
    try {
      // 1. 獲取認證客戶端
      final googleUser = await _googleSignIn.signInSilently();
      if (googleUser == null) {
        return Left(AuthFailure('未登入 Google 帳號'));
      }

      final auth = await googleUser.authentication;
      final credentials = AccessCredentials(
        AccessToken('Bearer', auth.accessToken!, remindAt.add(Duration(hours: 1))),
        null,
        ['https://www.googleapis.com/auth/calendar.events'],
      );

      // 2. 建立 Calendar API 客戶端
      final client = authenticatedClient(Client(), credentials);
      final calendar = CalendarApi(client);

      // 3. 建立日曆事件
      final event = Event()
        ..summary = task.content
        ..description = 'Zentropy Task: ${task.id}'
        ..start = EventDateTime(dateTime: remindAt)
        ..end = EventDateTime(dateTime: remindAt.add(Duration(minutes: 30)))
        ..reminders = EventReminders(
          useDefault: false,
          overrides: [
            EventReminder(method: 'popup', minutes: 0),
          ],
        );

      // 4. 插入事件
      final createdEvent = await calendar.events.insert(event, 'primary');

      client.close();

      return Right(createdEvent.id!);
    } catch (e) {
      return Left(ServerFailure('同步到 Google Calendar 失敗: $e'));
    }
  }

  @override
  Future<Either<Failure, void>> removeCalendarEvent(String eventId) async {
    try {
      final googleUser = await _googleSignIn.signInSilently();
      if (googleUser == null) {
        return Left(AuthFailure('未登入 Google 帳號'));
      }

      final auth = await googleUser.authentication;
      final credentials = AccessCredentials(
        AccessToken('Bearer', auth.accessToken!, DateTime.now().add(Duration(hours: 1))),
        null,
        ['https://www.googleapis.com/auth/calendar.events'],
      );

      final client = authenticatedClient(Client(), credentials);
      final calendar = CalendarApi(client);

      await calendar.events.delete('primary', eventId);

      client.close();

      return Right(null);
    } catch (e) {
      return Left(ServerFailure('移除 Calendar 事件失敗: $e'));
    }
  }

  @override
  Future<Either<Failure, void>> updateCalendarEvent({
    required String eventId,
    required DateTime newRemindAt,
  }) async {
    try {
      final googleUser = await _googleSignIn.signInSilently();
      if (googleUser == null) {
        return Left(AuthFailure('未登入 Google 帳號'));
      }

      final auth = await googleUser.authentication;
      final credentials = AccessCredentials(
        AccessToken('Bearer', auth.accessToken!, DateTime.now().add(Duration(hours: 1))),
        null,
        ['https://www.googleapis.com/auth/calendar.events'],
      );

      final client = authenticatedClient(Client(), credentials);
      final calendar = CalendarApi(client);

      // 獲取現有事件
      final event = await calendar.events.get('primary', eventId);

      // 更新時間
      event.start = EventDateTime(dateTime: newRemindAt);
      event.end = EventDateTime(dateTime: newRemindAt.add(Duration(minutes: 30)));

      await calendar.events.update(event, 'primary', eventId);

      client.close();

      return Right(null);
    } catch (e) {
      return Left(ServerFailure('更新 Calendar 事件失敗: $e'));
    }
  }
}
```

### 5. 擴展 Task Entity

```dart
// 在 Task entity 中添加
final String? calendarEventId;  // Google Calendar 事件 ID
final bool syncToCalendar;       // 是否同步到 Calendar
```

### 6. 修改 Schedule Use Case

```dart
class ScheduleTaskReminderUseCase extends UseCase<int, ScheduleReminderParams> {
  final NotificationService notificationService;
  final NotificationRepository notificationRepository;
  final TaskRepository taskRepository;
  final CalendarRepository calendarRepository; // 新增

  @override
  Future<Either<Failure, int>> call(ScheduleReminderParams params) async {
    try {
      // 1. 排程本地通知
      final notificationId = await notificationService.scheduleTaskReminder(
        taskId: params.taskId,
        taskContent: params.taskContent,
        remindAt: params.remindAt,
        productName: params.productName,
      );

      // 2. 如果啟用日曆同步，同步到 Google Calendar
      String? calendarEventId;
      if (params.syncToCalendar) {
        final calendarResult = await calendarRepository.syncTaskToCalendar(
          task: params.task,
          remindAt: params.remindAt,
        );

        calendarResult.fold(
          (failure) {
            // 日曆同步失敗不影響本地通知
            print('Calendar sync failed: ${failure.message}');
          },
          (eventId) {
            calendarEventId = eventId;
          },
        );
      }

      // 3. 儲存提醒元數據
      await notificationRepository.saveReminderConfig(
        params.taskId,
        ReminderMetadata(
          taskId: params.taskId,
          taskContent: params.taskContent,
          remindAt: params.remindAt,
          timezone: tz.local.name,
          notificationId: notificationId,
          productName: params.productName,
          calendarEventId: calendarEventId, // 儲存 Calendar 事件 ID
        ),
      );

      return Right(notificationId);
    } catch (e) {
      return Left(ServerFailure('排程提醒失敗: ${e.toString()}'));
    }
  }
}
```

### 7. UI 開關

```dart
// 在提醒設定 UI 中添加同步開關
SwitchListTile(
  title: const Text('同步到 Google 日曆'),
  value: _syncToCalendar,
  onChanged: (value) {
    setState(() {
      _syncToCalendar = value;
    });
  },
)
```

## 注意事項

### 隱私權與權限
- Android: 需在 `AndroidManifest.xml` 中聲明網路權限（已有）
- iOS: 需在 `Info.plist` 中添加日曆使用說明
- 需向用戶明確說明日曆同步的用途和範圍

### 雙向同步考量
目前方案為**單向同步**（App → Calendar）。若需雙向同步:
1. 需實作 Calendar Events 監聽
2. 需處理衝突解決邏輯
3. 需考慮離線同步佇列

### 效能考量
- 批量同步時使用 Batch API 減少請求次數
- 實作重試機制處理網路錯誤
- 使用後台任務避免阻塞 UI

## 實現階段

1. **Phase 1**: 基本單向同步（App → Calendar）
2. **Phase 2**: 事件更新與刪除同步
3. **Phase 3**: 離線佇列與錯誤處理
4. **Phase 4**: 雙向同步（選配）

## 相關文件
- Google Calendar API 文件: https://developers.google.com/calendar/api/v3/reference
- Flutter googleapis 套件: https://pub.dev/packages/googleapis
