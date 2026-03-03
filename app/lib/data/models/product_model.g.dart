// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'product_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ProductModelImpl _$$ProductModelImplFromJson(Map<String, dynamic> json) =>
    _$ProductModelImpl(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      areaId: json['area_id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      status: json['status'] as String,
      lifecycle: json['lifecycle'] as String,
      priority: json['priority'] as String? ?? 'P1',
      displayOrder: (json['display_order'] as num?)?.toInt() ?? 0,
      createdAt: json['created_at'] == null
          ? null
          : DateTime.parse(json['created_at'] as String),
      updatedAt: json['updated_at'] == null
          ? null
          : DateTime.parse(json['updated_at'] as String),
      deletedAt: json['deleted_at'] == null
          ? null
          : DateTime.parse(json['deleted_at'] as String),
      references: (json['references'] as List<dynamic>?)
          ?.map((e) => ReferenceModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      totalReferenceCount: (json['total_reference_count'] as num?)?.toInt(),
      tasks: (json['tasks'] as List<dynamic>?)
          ?.map((e) => TaskModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      recentTasks: (json['recent_tasks'] as List<dynamic>?)
          ?.map((e) => TaskModel.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$$ProductModelImplToJson(
  _$ProductModelImpl instance,
) => <String, dynamic>{
  'id': instance.id,
  'user_id': instance.userId,
  'area_id': instance.areaId,
  'name': instance.name,
  if (instance.description case final value?) 'description': value,
  'status': instance.status,
  'lifecycle': instance.lifecycle,
  'priority': instance.priority,
  'display_order': instance.displayOrder,
  if (instance.createdAt?.toIso8601String() case final value?)
    'created_at': value,
  if (instance.updatedAt?.toIso8601String() case final value?)
    'updated_at': value,
  if (instance.deletedAt?.toIso8601String() case final value?)
    'deleted_at': value,
  if (instance.references?.map((e) => e.toJson()).toList() case final value?)
    'references': value,
  if (instance.totalReferenceCount case final value?)
    'total_reference_count': value,
  if (instance.tasks?.map((e) => e.toJson()).toList() case final value?)
    'tasks': value,
  if (instance.recentTasks?.map((e) => e.toJson()).toList() case final value?)
    'recent_tasks': value,
};
