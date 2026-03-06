// Daily Plan 領域實體 - 教練每日計畫

class DailyPlan {
  final String id;
  final String planDate;
  final String? coachMessage;
  final String? capacityNote;
  final int? availableMinutes;
  final int? meetingMinutes;
  final int? plannedMinutes;
  final List<Map<String, dynamic>> overflowItems;
  final List<DailyPlanItem> items;
  final DateTime createdAt;
  final DateTime updatedAt;

  const DailyPlan({
    required this.id,
    required this.planDate,
    this.coachMessage,
    this.capacityNote,
    this.availableMinutes,
    this.meetingMinutes,
    this.plannedMinutes,
    this.overflowItems = const [],
    required this.items,
    required this.createdAt,
    required this.updatedAt,
  });

  factory DailyPlan.fromJson(Map<String, dynamic> json) {
    return DailyPlan(
      id: json['id'] as String,
      planDate: json['plan_date'] as String,
      coachMessage: json['coach_message'] as String?,
      capacityNote: json['capacity_note'] as String?,
      availableMinutes: json['available_minutes'] as int?,
      meetingMinutes: json['meeting_minutes'] as int?,
      plannedMinutes: json['planned_minutes'] as int?,
      overflowItems: (json['overflow_items'] as List<dynamic>? ?? [])
          .map((e) => e as Map<String, dynamic>)
          .toList(),
      items: (json['items'] as List<dynamic>? ?? [])
          .map((e) => DailyPlanItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
    );
  }

  int get totalEstimatedMinutes =>
      items.fold(0, (sum, item) => sum + (item.estimatedMinutes ?? 0));

  int get completedCount => items.where((i) => i.completed).length;
}

class DailyPlanItem {
  final String id;
  final String? taskId;
  final String? subTaskId;
  final String itemType;
  final String content;
  final String? areaName;
  final String? productName;
  final String? taskName;
  final int? estimatedMinutes;
  final int? actualMinutes;
  final String? dueDate;
  final int order;
  final String? reasoning;
  final bool completed;
  final DateTime? completedAt;
  final bool pinned;
  final bool deferred;
  final String status;
  final bool userAdjusted;
  final bool isRecurring;

  const DailyPlanItem({
    required this.id,
    this.taskId,
    this.subTaskId,
    required this.itemType,
    required this.content,
    this.areaName,
    this.productName,
    this.taskName,
    this.estimatedMinutes,
    this.actualMinutes,
    this.dueDate,
    required this.order,
    this.reasoning,
    this.completed = false,
    this.completedAt,
    this.pinned = false,
    this.deferred = false,
    this.status = 'pending',
    this.userAdjusted = false,
    this.isRecurring = false,
  });

  factory DailyPlanItem.fromJson(Map<String, dynamic> json) {
    return DailyPlanItem(
      id: json['id'] as String,
      taskId: json['task_id'] as String?,
      subTaskId: json['sub_task_id'] as String?,
      itemType: json['item_type'] as String? ?? 'task',
      content: json['content'] as String? ?? '',
      areaName: json['area_name'] as String?,
      productName: json['product_name'] as String?,
      taskName: json['task_name'] as String?,
      estimatedMinutes: json['estimated_minutes'] as int?,
      actualMinutes: json['actual_minutes'] as int?,
      dueDate: json['due_date'] as String?,
      order: json['order'] as int? ?? 0,
      reasoning: json['reasoning'] as String?,
      completed: json['completed'] as bool? ?? false,
      completedAt: json['completed_at'] != null
          ? DateTime.parse(json['completed_at'] as String)
          : null,
      pinned: json['pinned'] as bool? ?? false,
      deferred: json['deferred'] as bool? ?? false,
      status: json['status'] as String? ?? 'pending',
      userAdjusted: json['user_adjusted'] as bool? ?? false,
      isRecurring: json['is_recurring'] as bool? ?? false,
    );
  }
}
