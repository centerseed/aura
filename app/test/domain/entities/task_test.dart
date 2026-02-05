import 'package:flutter_test/flutter_test.dart';
import 'package:app/domain/entities/task.dart';

void main() {
  group('Task Entity - Reminder Fields', () {
    final testTask = Task(
      id: 'test-task-1',
      content: 'Test Task',
      status: TaskStatus.active,
      productId: 'product-1',
      remindAt: DateTime(2024, 12, 25, 9, 0, 0),
      reminderEnabled: true,
      reminderTimezone: 'Asia/Taipei',
      notificationId: 1001,
    );

    test('應該正確創建包含提醒欄位的 Task', () {
      expect(testTask.remindAt, equals(DateTime(2024, 12, 25, 9, 0, 0)));
      expect(testTask.reminderEnabled, isTrue);
      expect(testTask.reminderTimezone, equals('Asia/Taipei'));
      expect(testTask.notificationId, equals(1001));
    });

    test('reminderEnabled 預設值應該為 false', () {
      final taskWithoutReminder = Task(
        id: 'test-task-2',
        content: 'Task without reminder',
        status: TaskStatus.inbox,
      );

      expect(taskWithoutReminder.reminderEnabled, isFalse);
      expect(taskWithoutReminder.remindAt, isNull);
      expect(taskWithoutReminder.reminderTimezone, isNull);
      expect(taskWithoutReminder.notificationId, isNull);
    });

    test('copyWith 應該正確更新提醒時間', () {
      final newRemindAt = DateTime(2024, 12, 31, 20, 0, 0);
      final updatedTask = testTask.copyWith(remindAt: newRemindAt);

      expect(updatedTask.remindAt, equals(newRemindAt));
      expect(updatedTask.reminderEnabled, equals(testTask.reminderEnabled));
      expect(updatedTask.reminderTimezone, equals(testTask.reminderTimezone));
      expect(updatedTask.notificationId, equals(testTask.notificationId));
    });

    test('copyWith 應該正確更新提醒開關', () {
      final updatedTask = testTask.copyWith(reminderEnabled: false);

      expect(updatedTask.reminderEnabled, isFalse);
      expect(updatedTask.remindAt, equals(testTask.remindAt));
    });

    test('copyWith 應該正確更新時區', () {
      final updatedTask = testTask.copyWith(reminderTimezone: 'America/New_York');

      expect(updatedTask.reminderTimezone, equals('America/New_York'));
      expect(updatedTask.remindAt, equals(testTask.remindAt));
      expect(updatedTask.reminderEnabled, equals(testTask.reminderEnabled));
    });

    test('copyWith 應該正確更新通知 ID', () {
      final updatedTask = testTask.copyWith(notificationId: 2002);

      expect(updatedTask.notificationId, equals(2002));
      expect(updatedTask.remindAt, equals(testTask.remindAt));
    });

    test('copyWith 應該能同時更新多個提醒欄位', () {
      final newRemindAt = DateTime(2024, 12, 31, 20, 0, 0);
      final updatedTask = testTask.copyWith(
        remindAt: newRemindAt,
        reminderEnabled: false,
        reminderTimezone: 'America/New_York',
        notificationId: 3003,
      );

      expect(updatedTask.remindAt, equals(newRemindAt));
      expect(updatedTask.reminderEnabled, isFalse);
      expect(updatedTask.reminderTimezone, equals('America/New_York'));
      expect(updatedTask.notificationId, equals(3003));
    });

    test('copyWith 應該保持其他欄位不變', () {
      final updatedTask = testTask.copyWith(remindAt: DateTime(2024, 12, 31));

      expect(updatedTask.id, equals(testTask.id));
      expect(updatedTask.content, equals(testTask.content));
      expect(updatedTask.status, equals(testTask.status));
      expect(updatedTask.productId, equals(testTask.productId));
    });

    test('props 應該包含所有提醒欄位', () {
      expect(testTask.props, contains(testTask.remindAt));
      expect(testTask.props, contains(testTask.reminderEnabled));
      expect(testTask.props, contains(testTask.reminderTimezone));
      expect(testTask.props, contains(testTask.notificationId));
    });

    test('兩個相同提醒欄位的 Task 應該相等 (Equatable)', () {
      final task1 = Task(
        id: 'task-1',
        content: 'Test',
        status: TaskStatus.active,
        remindAt: DateTime(2024, 12, 25, 9, 0, 0),
        reminderEnabled: true,
        reminderTimezone: 'Asia/Taipei',
        notificationId: 1001,
      );

      final task2 = Task(
        id: 'task-1',
        content: 'Test',
        status: TaskStatus.active,
        remindAt: DateTime(2024, 12, 25, 9, 0, 0),
        reminderEnabled: true,
        reminderTimezone: 'Asia/Taipei',
        notificationId: 1001,
      );

      expect(task1, equals(task2));
    });

    test('提醒欄位不同的 Task 應該不相等', () {
      final task1 = testTask;
      final task2 = testTask.copyWith(reminderEnabled: false);

      expect(task1, isNot(equals(task2)));
    });

    test('應該能夠清除提醒時間 (設為 null)', () {
      final clearedTask = Task(
        id: testTask.id,
        content: testTask.content,
        status: testTask.status,
        remindAt: null,
        reminderEnabled: testTask.reminderEnabled,
        reminderTimezone: testTask.reminderTimezone,
        notificationId: testTask.notificationId,
      );

      expect(clearedTask.remindAt, isNull);
      expect(clearedTask.reminderEnabled, isTrue);
    });
  });

  group('Task Entity - Basic Functionality', () {
    test('isOverdue 應該正確判斷逾期任務', () {
      final overdueTask = Task(
        id: 'task-1',
        content: 'Overdue task',
        status: TaskStatus.active,
        dueDate: DateTime.now().subtract(const Duration(days: 1)),
      );

      expect(overdueTask.isOverdue, isTrue);
    });

    test('isOverdue 應該對已歸檔任務返回 false', () {
      final archivedTask = Task(
        id: 'task-1',
        content: 'Archived task',
        status: TaskStatus.archive,
        dueDate: DateTime.now().subtract(const Duration(days: 1)),
      );

      expect(archivedTask.isOverdue, isFalse);
    });

    test('isToday 應該正確判斷今日任務', () {
      final todayTask = Task(
        id: 'task-1',
        content: 'Today task',
        status: TaskStatus.active,
        dueDate: DateTime.now(),
      );

      expect(todayTask.isToday, isTrue);
    });

    test('isStarted 應該正確判斷已開始任務', () {
      final startedTask = Task(
        id: 'task-1',
        content: 'Started task',
        status: TaskStatus.active,
        startDate: DateTime.now().subtract(const Duration(days: 1)),
      );

      expect(startedTask.isStarted, isTrue);
    });
  });
}
