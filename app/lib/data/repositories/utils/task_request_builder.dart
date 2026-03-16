import '../../../domain/entities/task.dart';

/// Utility class for building task-related API request bodies.
///
/// Provides static methods to construct request payloads with proper
/// null-handling and type conversion.
class TaskRequestBuilder {
  TaskRequestBuilder._(); // Private constructor to prevent instantiation

  /// Builds a request body for updating task details.
  ///
  /// Only includes non-null fields in the request body to support partial updates.
  ///
  /// Example:
  /// ```dart
  /// final body = TaskRequestBuilder.buildUpdateRequestBody(
  ///   content: 'Updated content',
  ///   status: TaskStatus.active,
  ///   dueDate: DateTime.now().add(Duration(days: 7)),
  /// );
  /// // Result: {'content': '...', 'status': 'ACTIVE', 'due_date': '...'}
  /// ```
  static Map<String, dynamic> buildUpdateRequestBody({
    String? content,
    TaskStatus? status,
    DateTime? startDate,
    DateTime? dueDate,
    String? productId,
    String? topicId,
    double? timeConfidence,
    List<String>? tags,
    DateTime? remindAt,
    bool? reminderEnabled,
    String? reminderTimezone,
    int? notificationId,
    bool? dateLocked,
  }) {
    final body = <String, dynamic>{};

    if (content != null) {
      body['content'] = content;
    }
    if (status != null) {
      body['status'] = status.name.toUpperCase();
    }
    if (startDate != null) {
      body['start_date'] = toDateOnlyUtcNoon(startDate);
    }
    if (dueDate != null) {
      body['due_date'] = toDateOnlyUtcNoon(dueDate);
    }
    if (productId != null) {
      body['product_id'] = productId;
    }
    if (topicId != null) {
      body['topic_id'] = topicId;
    }
    if (timeConfidence != null) {
      body['time_confidence'] = timeConfidence;
    }
    if (tags != null) {
      body['tags'] = tags;
    }
    if (remindAt != null) {
      body['remind_at'] = remindAt.toUtc().toIso8601String();
    }
    if (reminderEnabled != null) {
      body['reminder_enabled'] = reminderEnabled;
    }
    if (reminderTimezone != null) {
      body['reminder_timezone'] = reminderTimezone;
    }
    if (notificationId != null) {
      body['notification_id'] = notificationId;
    }
    if (dateLocked != null) {
      body['date_locked'] = dateLocked;
    }

    return body;
  }

  /// 將日期轉為 UTC 中午的 ISO 字串，避免時區轉換導致日期偏移。
  /// 例：台北 2/17 00:00 → UTC 2/17 12:00，而非 UTC 2/16 16:00。
  /// 將日期轉為 UTC 中午的 ISO 字串，避免時區轉換導致日期偏移。
  /// 公開供其他 repository 使用。
  static String toDateOnlyUtcNoon(DateTime date) {
    return DateTime.utc(date.year, date.month, date.day, 12, 0, 0)
        .toIso8601String();
  }
}
