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
  }) {
    final body = <String, dynamic>{};

    if (content != null) {
      body['content'] = content;
    }
    if (status != null) {
      body['status'] = status.name.toUpperCase();
    }
    if (startDate != null) {
      body['start_date'] = startDate.toUtc().toIso8601String();
    }
    if (dueDate != null) {
      body['due_date'] = dueDate.toUtc().toIso8601String();
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

    return body;
  }
}
