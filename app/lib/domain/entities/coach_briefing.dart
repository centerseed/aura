// Coach Briefing 領域實體 - 教練晨報/晚報

enum BriefingType { morning, evening }

class CoachBriefing {
  final String id;
  final BriefingType type;
  final String briefingDate;

  // 聚合資料
  final List<CalendarEventSummary> calendarEvents;
  final List<TaskSummary> overdueTasks;
  final List<TaskSummary> approachingTasks;
  final List<ConflictItem> conflicts;
  final List<StagnationItem> stagnations;
  final List<TaskSummary> completedTasks;
  final List<TaskSummary> remainingTasks;
  final List<CalendarEventSummary> tomorrowPreview;

  // AI 生成內容
  final String summary;
  final List<Recommendation> recommendations;
  final List<DeferSuggestion> deferSuggestions;

  final DateTime createdAt;
  final DateTime updatedAt;

  const CoachBriefing({
    required this.id,
    required this.type,
    required this.briefingDate,
    required this.calendarEvents,
    required this.overdueTasks,
    required this.approachingTasks,
    required this.conflicts,
    required this.stagnations,
    required this.completedTasks,
    required this.remainingTasks,
    required this.tomorrowPreview,
    required this.summary,
    required this.recommendations,
    required this.deferSuggestions,
    required this.createdAt,
    required this.updatedAt,
  });

  factory CoachBriefing.fromJson(Map<String, dynamic> json) {
    return CoachBriefing(
      id: json['id'] as String,
      type: json['type'] == 'MORNING' ? BriefingType.morning : BriefingType.evening,
      briefingDate: json['briefing_date'] as String,
      calendarEvents: (json['calendar_events'] as List<dynamic>? ?? [])
          .map((e) => CalendarEventSummary.fromJson(e as Map<String, dynamic>))
          .toList(),
      overdueTasks: (json['overdue_tasks'] as List<dynamic>? ?? [])
          .map((e) => TaskSummary.fromJson(e as Map<String, dynamic>))
          .toList(),
      approachingTasks: (json['approaching_tasks'] as List<dynamic>? ?? [])
          .map((e) => TaskSummary.fromJson(e as Map<String, dynamic>))
          .toList(),
      conflicts: (json['conflicts'] as List<dynamic>? ?? [])
          .map((e) => ConflictItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      stagnations: (json['stagnations'] as List<dynamic>? ?? [])
          .map((e) => StagnationItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      completedTasks: (json['completed_tasks'] as List<dynamic>? ?? [])
          .map((e) => TaskSummary.fromJson(e as Map<String, dynamic>))
          .toList(),
      remainingTasks: (json['remaining_tasks'] as List<dynamic>? ?? [])
          .map((e) => TaskSummary.fromJson(e as Map<String, dynamic>))
          .toList(),
      tomorrowPreview: (json['tomorrow_preview'] as List<dynamic>? ?? [])
          .map((e) => CalendarEventSummary.fromJson(e as Map<String, dynamic>))
          .toList(),
      summary: json['summary'] as String? ?? '',
      recommendations: (json['recommendations'] as List<dynamic>? ?? [])
          .map((e) => Recommendation.fromJson(e as Map<String, dynamic>))
          .toList(),
      deferSuggestions: (json['defer_suggestions'] as List<dynamic>? ?? [])
          .map((e) => DeferSuggestion.fromJson(e as Map<String, dynamic>))
          .toList(),
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
    );
  }
}

class CalendarEventSummary {
  final String id;
  final String summary;
  final String startDateTime;
  final String endDateTime;
  final String? meetLink;
  final String eventLink;
  final List<String> attendees;

  const CalendarEventSummary({
    required this.id,
    required this.summary,
    required this.startDateTime,
    required this.endDateTime,
    this.meetLink,
    required this.eventLink,
    required this.attendees,
  });

  factory CalendarEventSummary.fromJson(Map<String, dynamic> json) {
    return CalendarEventSummary(
      id: json['id'] as String? ?? '',
      summary: json['summary'] as String? ?? '',
      startDateTime: json['start_date_time'] as String? ?? '',
      endDateTime: json['end_date_time'] as String? ?? '',
      meetLink: json['meet_link'] as String?,
      eventLink: json['event_link'] as String? ?? '',
      attendees: (json['attendees'] as List<dynamic>? ?? [])
          .map((e) => e as String)
          .toList(),
    );
  }
}

class TaskSummary {
  final String id;
  final String content;
  final String status;
  final String? dueDate;
  final String? areaName;
  final String? productName;
  final int? daysOverdue;
  final int? daysRemaining;
  final int? daysStagnant;
  final String? urgencyLevel;
  final int? estimatedMinutes;

  const TaskSummary({
    required this.id,
    required this.content,
    required this.status,
    this.dueDate,
    this.areaName,
    this.productName,
    this.daysOverdue,
    this.daysRemaining,
    this.daysStagnant,
    this.urgencyLevel,
    this.estimatedMinutes,
  });

  factory TaskSummary.fromJson(Map<String, dynamic> json) {
    return TaskSummary(
      id: json['id'] as String? ?? '',
      content: json['content'] as String? ?? '',
      status: json['status'] as String? ?? '',
      dueDate: json['due_date'] as String?,
      areaName: json['area_name'] as String?,
      productName: json['product_name'] as String?,
      daysOverdue: json['days_overdue'] as int?,
      daysRemaining: json['days_remaining'] as int?,
      daysStagnant: json['days_stagnant'] as int?,
      urgencyLevel: json['urgency_level'] as String?,
      estimatedMinutes: json['estimated_minutes'] as int?,
    );
  }
}

class ConflictItem {
  final String type;
  final String severity;
  final String description;

  const ConflictItem({
    required this.type,
    required this.severity,
    required this.description,
  });

  factory ConflictItem.fromJson(Map<String, dynamic> json) {
    return ConflictItem(
      type: json['type'] as String? ?? '',
      severity: json['severity'] as String? ?? 'low',
      description: json['description'] as String? ?? '',
    );
  }
}

class StagnationItem {
  final String type;
  final String entityId;
  final String entityName;
  final String areaName;
  final int daysInactive;
  final String suggestion;

  const StagnationItem({
    required this.type,
    required this.entityId,
    required this.entityName,
    required this.areaName,
    required this.daysInactive,
    required this.suggestion,
  });

  factory StagnationItem.fromJson(Map<String, dynamic> json) {
    return StagnationItem(
      type: json['type'] as String? ?? '',
      entityId: json['entity_id'] as String? ?? '',
      entityName: json['entity_name'] as String? ?? '',
      areaName: json['area_name'] as String? ?? '',
      daysInactive: json['days_inactive'] as int? ?? 0,
      suggestion: json['suggestion'] as String? ?? '',
    );
  }
}

class Recommendation {
  final int priority;
  final String action;
  final String reasoning;
  final String? relatedTaskId;

  const Recommendation({
    required this.priority,
    required this.action,
    required this.reasoning,
    this.relatedTaskId,
  });

  factory Recommendation.fromJson(Map<String, dynamic> json) {
    return Recommendation(
      priority: json['priority'] as int? ?? 3,
      action: json['action'] as String? ?? '',
      reasoning: json['reasoning'] as String? ?? '',
      relatedTaskId: json['related_task_id'] as String?,
    );
  }
}

class DeferSuggestion {
  final String taskId;
  final String taskContent;
  final String suggestedAction;
  final String reasoning;

  const DeferSuggestion({
    required this.taskId,
    required this.taskContent,
    required this.suggestedAction,
    required this.reasoning,
  });

  factory DeferSuggestion.fromJson(Map<String, dynamic> json) {
    return DeferSuggestion(
      taskId: json['task_id'] as String? ?? '',
      taskContent: json['task_content'] as String? ?? '',
      suggestedAction: json['suggested_action'] as String? ?? 'defer',
      reasoning: json['reasoning'] as String? ?? '',
    );
  }
}
