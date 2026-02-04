import 'package:freezed_annotation/freezed_annotation.dart';
import '../../domain/entities/task.dart';

part 'task_model.freezed.dart';
part 'task_model.g.dart';

@Freezed(toJson: true)
class TaskModel with _$TaskModel {
  const factory TaskModel({
    required String id,
    @JsonKey(name: 'user_id') required String userId,
    @JsonKey(name: 'product_id') String? productId,
    @JsonKey(name: 'topic_id') String? topicId,
    required String content,
    required String status,
    @JsonKey(name: 'due_date') DateTime? dueDate,
    @JsonKey(name: 'start_date') DateTime? startDate,
    @JsonKey(name: 'time_confidence') double? timeConfidence,
    @JsonKey(name: 'inferred_from_milestone') String? inferredFromMilestone,
    @JsonKey(name: 'ai_analysis') Map<String, dynamic>? aiAnalysis,
    @JsonKey(name: 'sub_items') List<SubItemModel>? subItems,
    @JsonKey(name: 'tag') Map<String, dynamic>? tag,
    @JsonKey(name: 'tags') List<String>? tags,
    @JsonKey(name: 'created_at') DateTime? createdAt,
    @JsonKey(name: 'updated_at') DateTime? updatedAt,
    @JsonKey(name: 'deleted_at') DateTime? deletedAt,
    // Reminder fields
    @JsonKey(name: 'remind_at') DateTime? remindAt,
    @JsonKey(name: 'reminder_enabled') @Default(false) bool reminderEnabled,
    @JsonKey(name: 'reminder_timezone') String? reminderTimezone,
    @JsonKey(name: 'notification_id') int? notificationId,
  }) = _TaskModel;

  factory TaskModel.fromJson(Map<String, dynamic> json) =>
      _$TaskModelFromJson(json);

  // 轉換為 Domain Entity
  const TaskModel._();

  Task toEntity() => Task(
    id: id,
    content: content,
    status: _parseStatus(status),
    dueDate: dueDate?.toLocal(),
    startDate: startDate?.toLocal(),
    timeConfidence: timeConfidence,
    productId: productId,
    topicId: topicId,
    subItems: subItems?.map((e) => e.toEntity()).toList(),
    createdAt: createdAt,
    updatedAt: updatedAt,
    deletedAt: deletedAt,
    areaName: tag?['area'] as String?,
    productName: tag?['product'] as String?,
    topicName: tag?['topic'] as String?,
    tags: tags,
    remindAt: remindAt?.toLocal(),
    reminderEnabled: reminderEnabled,
    reminderTimezone: reminderTimezone,
    notificationId: notificationId,
  );

  TaskStatus _parseStatus(String status) {
    switch (status.toUpperCase()) {
      case 'INBOX':
        return TaskStatus.inbox;
      case 'ACTIVE':
        return TaskStatus.active;
      case 'MAINTAIN':
        return TaskStatus.maintain;
      case 'REFERENCE':
        return TaskStatus.reference;
      case 'ARCHIVE':
        return TaskStatus.archive;
      default:
        return TaskStatus.inbox;
    }
  }
}

@Freezed(toJson: true)
class SubItemModel with _$SubItemModel {
  const factory SubItemModel({
    required String id,
    required String content,
    required bool completed,
    @JsonKey(name: 'completed_at') DateTime? completedAt,
  }) = _SubItemModel;

  factory SubItemModel.fromJson(Map<String, dynamic> json) =>
      _$SubItemModelFromJson(json);

  const SubItemModel._();

  SubItem toEntity() => SubItem(
    id: id,
    content: content,
    completed: completed,
    completedAt: completedAt,
  );
}
