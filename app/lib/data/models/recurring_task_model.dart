import '../../domain/entities/recurring_task.dart';

class RecurringTaskModel {
  final String id;
  final String userId;
  final String? productId;
  final String? topicId;
  final String title;
  final String status;
  final Map<String, dynamic> recurrenceRule;
  final int leadDays;
  final String? nextOccurrenceAt;
  final double? estimatedDurationHours;
  final DateTime createdAt;
  final DateTime updatedAt;

  const RecurringTaskModel({
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

  factory RecurringTaskModel.fromJson(Map<String, dynamic> json) {
    return RecurringTaskModel(
      id: json['id'] as String,
      userId: json['user_id'] as String? ?? '',
      productId: json['product_id'] as String?,
      topicId: json['topic_id'] as String?,
      title: json['title'] as String,
      status: json['status'] as String? ?? 'ACTIVE',
      recurrenceRule: json['recurrence_rule'] as Map<String, dynamic>? ?? {},
      leadDays: (json['lead_days'] as num?)?.toInt() ?? 1,
      nextOccurrenceAt: json['next_occurrence_at'] as String?,
      estimatedDurationHours: (json['estimated_duration_hours'] as num?)?.toDouble(),
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'user_id': userId,
    'product_id': productId,
    'topic_id': topicId,
    'title': title,
    'status': status,
    'recurrence_rule': recurrenceRule,
    'lead_days': leadDays,
    'next_occurrence_at': nextOccurrenceAt,
    'estimated_duration_hours': estimatedDurationHours,
    'created_at': createdAt.toIso8601String(),
    'updated_at': updatedAt.toIso8601String(),
  };

  RecurringTask toEntity() => RecurringTask(
    id: id,
    userId: userId,
    productId: productId,
    topicId: topicId,
    title: title,
    status: _parseStatus(status),
    recurrenceRule: _parseRule(recurrenceRule),
    leadDays: leadDays,
    nextOccurrenceAt: nextOccurrenceAt,
    estimatedDurationHours: estimatedDurationHours,
    createdAt: createdAt,
    updatedAt: updatedAt,
  );

  RecurringTaskStatus _parseStatus(String s) {
    switch (s.toUpperCase()) {
      case 'PAUSED':
        return RecurringTaskStatus.paused;
      case 'ARCHIVED':
        return RecurringTaskStatus.archived;
      default:
        return RecurringTaskStatus.active;
    }
  }

  RecurrenceRule _parseRule(Map<String, dynamic> rule) {
    final freq = rule['frequency'] as String? ?? 'DAILY';
    RecurrenceFrequency frequency;
    switch (freq.toUpperCase()) {
      case 'WEEKLY':
        frequency = RecurrenceFrequency.weekly;
        break;
      case 'MONTHLY':
        frequency = RecurrenceFrequency.monthly;
        break;
      default:
        frequency = RecurrenceFrequency.daily;
    }

    return RecurrenceRule(
      frequency: frequency,
      interval: (rule['interval'] as num?)?.toInt() ?? 1,
      daysOfWeek: (rule['days_of_week'] as List?)?.cast<int>(),
      dayOfMonth: (rule['day_of_month'] as num?)?.toInt(),
      timeOfDay: rule['time_of_day'] as String?,
      timezone: rule['timezone'] as String? ?? 'Asia/Taipei',
      startDate: rule['start_date'] as String? ?? '',
      endDate: rule['end_date'] as String?,
    );
  }
}
