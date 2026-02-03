import '../../../domain/entities/task.dart';

/// Mixin for converting Task entities to/from JSON format.
///
/// This mixin provides shared serialization logic for all task repositories,
/// ensuring consistent JSON structure across cached and unified repositories.
mixin TaskJsonConverter {
  /// Converts a Task entity to JSON format compatible with TaskModel.
  Map<String, dynamic> taskToJson(Task item) {
    return {
      'id': item.id,
      'user_id': '', // Not needed for cache
      'product_id': item.productId,
      'topic_id': item.topicId,
      'content': item.content,
      'status': item.status.name.toUpperCase(),
      'due_date': item.dueDate?.toIso8601String(),
      'start_date': item.startDate?.toIso8601String(),
      'time_confidence': item.timeConfidence,
      'sub_items': item.subItems?.map(subItemToJson).toList(),
      'tag': {
        'area': item.areaName,
        'product': item.productName,
        'topic': item.topicName,
      },
      'tags': item.tags,
      'created_at': item.createdAt?.toIso8601String(),
      'updated_at': item.updatedAt?.toIso8601String(),
      'deleted_at': item.deletedAt?.toIso8601String(),
    };
  }

  /// Converts a SubItem entity to JSON format.
  Map<String, dynamic> subItemToJson(SubItem subItem) {
    return {
      'id': subItem.id,
      'content': subItem.content,
      'completed': subItem.completed,
      'completed_at': subItem.completedAt?.toIso8601String(),
    };
  }
}
