// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'task_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$TaskModelImpl _$$TaskModelImplFromJson(Map<String, dynamic> json) =>
    _$TaskModelImpl(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      productId: json['product_id'] as String,
      topicId: json['topic_id'] as String?,
      content: json['content'] as String,
      status: json['status'] as String,
      dueDate: json['due_date'] == null
          ? null
          : DateTime.parse(json['due_date'] as String),
      startDate: json['start_date'] == null
          ? null
          : DateTime.parse(json['start_date'] as String),
      timeConfidence: (json['time_confidence'] as num?)?.toDouble(),
      inferredFromMilestone: json['inferred_from_milestone'] as String?,
      aiAnalysis: json['ai_analysis'] as Map<String, dynamic>?,
      subItems: (json['sub_items'] as List<dynamic>?)
          ?.map((e) => SubItemModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      tag: json['tag'] as Map<String, dynamic>?,
      tags: (json['tags'] as List<dynamic>?)?.map((e) => e as String).toList(),
      createdAt: json['created_at'] == null
          ? null
          : DateTime.parse(json['created_at'] as String),
      updatedAt: json['updated_at'] == null
          ? null
          : DateTime.parse(json['updated_at'] as String),
      deletedAt: json['deleted_at'] == null
          ? null
          : DateTime.parse(json['deleted_at'] as String),
    );

Map<String, dynamic> _$$TaskModelImplToJson(_$TaskModelImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'user_id': instance.userId,
      'product_id': instance.productId,
      'topic_id': instance.topicId,
      'content': instance.content,
      'status': instance.status,
      'due_date': instance.dueDate?.toIso8601String(),
      'start_date': instance.startDate?.toIso8601String(),
      'time_confidence': instance.timeConfidence,
      'inferred_from_milestone': instance.inferredFromMilestone,
      'ai_analysis': instance.aiAnalysis,
      'sub_items': instance.subItems,
      'tag': instance.tag,
      'tags': instance.tags,
      'created_at': instance.createdAt?.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'deleted_at': instance.deletedAt?.toIso8601String(),
    };

_$SubItemModelImpl _$$SubItemModelImplFromJson(Map<String, dynamic> json) =>
    _$SubItemModelImpl(
      id: json['id'] as String,
      content: json['content'] as String,
      completed: json['completed'] as bool,
      completedAt: json['completed_at'] == null
          ? null
          : DateTime.parse(json['completed_at'] as String),
    );

Map<String, dynamic> _$$SubItemModelImplToJson(_$SubItemModelImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'content': instance.content,
      'completed': instance.completed,
      'completed_at': instance.completedAt?.toIso8601String(),
    };
