// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'milestone_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$MilestoneModelImpl _$$MilestoneModelImplFromJson(Map<String, dynamic> json) =>
    _$MilestoneModelImpl(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      name: json['name'] as String,
      targetDate: DateTime.parse(json['target_date'] as String),
      status: json['status'] as String,
      entityType: json['entity_type'] as String,
      entityId: json['entity_id'] as String,
      priority: (json['priority'] as num).toInt(),
      description: json['description'] as String?,
      product: json['product'] as Map<String, dynamic>?,
      area: json['area'] as Map<String, dynamic>?,
      topic: json['topic'] as Map<String, dynamic>?,
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

Map<String, dynamic> _$$MilestoneModelImplToJson(
  _$MilestoneModelImpl instance,
) => <String, dynamic>{
  'id': instance.id,
  'user_id': instance.userId,
  'name': instance.name,
  'target_date': instance.targetDate.toIso8601String(),
  'status': instance.status,
  'entity_type': instance.entityType,
  'entity_id': instance.entityId,
  'priority': instance.priority,
  if (instance.description case final value?) 'description': value,
  if (instance.product case final value?) 'product': value,
  if (instance.area case final value?) 'area': value,
  if (instance.topic case final value?) 'topic': value,
  if (instance.createdAt?.toIso8601String() case final value?)
    'created_at': value,
  if (instance.updatedAt?.toIso8601String() case final value?)
    'updated_at': value,
  if (instance.deletedAt?.toIso8601String() case final value?)
    'deleted_at': value,
};
