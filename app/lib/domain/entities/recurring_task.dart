import 'package:equatable/equatable.dart';

/// 週期規則頻率
enum RecurrenceFrequency { daily, weekly, monthly }

/// 週期規則
class RecurrenceRule extends Equatable {
  final RecurrenceFrequency frequency;
  final int interval;
  final List<int>? daysOfWeek; // WEEKLY: 0=週日, 6=週六
  final int? dayOfMonth;       // MONTHLY: 1-31
  final String? timeOfDay;     // 'HH:mm'
  final String timezone;
  final String startDate;      // 'YYYY-MM-DD'
  final String? endDate;

  const RecurrenceRule({
    required this.frequency,
    required this.interval,
    this.daysOfWeek,
    this.dayOfMonth,
    this.timeOfDay,
    required this.timezone,
    required this.startDate,
    this.endDate,
  });

  @override
  List<Object?> get props =>
      [frequency, interval, daysOfWeek, dayOfMonth, timezone, startDate, endDate];

  String get frequencyLabel {
    switch (frequency) {
      case RecurrenceFrequency.daily:
        return interval == 1 ? '每天' : '每 $interval 天';
      case RecurrenceFrequency.weekly:
        return interval == 1 ? '每週' : '每 $interval 週';
      case RecurrenceFrequency.monthly:
        return interval == 1 ? '每月' : '每 $interval 個月';
    }
  }
}

/// 週期任務狀態
enum RecurringTaskStatus { active, paused, archived }

/// RecurringTask 領域實體
class RecurringTask extends Equatable {
  final String id;
  final String userId;
  final String? productId;
  final String? topicId;
  final String title;
  final RecurringTaskStatus status;
  final RecurrenceRule recurrenceRule;
  final int leadDays;
  final String? nextOccurrenceAt; // 'YYYY-MM-DD'
  final double? estimatedDurationHours;
  final DateTime createdAt;
  final DateTime updatedAt;

  const RecurringTask({
    required this.id,
    required this.userId,
    this.productId,
    this.topicId,
    required this.title,
    required this.status,
    required this.recurrenceRule,
    required this.leadDays,
    this.nextOccurrenceAt,
    this.estimatedDurationHours,
    required this.createdAt,
    required this.updatedAt,
  });

  bool get isActive => status == RecurringTaskStatus.active;

  @override
  List<Object?> get props => [id, title, status, recurrenceRule];
}
