// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'reference_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ReferenceModelImpl _$$ReferenceModelImplFromJson(Map<String, dynamic> json) =>
    _$ReferenceModelImpl(
      id: json['id'] as String,
      type: json['type'] as String,
      content: json['content'] as String,
      title: json['title'] as String?,
      createdAt: json['created_at'] as String,
    );

Map<String, dynamic> _$$ReferenceModelImplToJson(
  _$ReferenceModelImpl instance,
) => <String, dynamic>{
  'id': instance.id,
  'type': instance.type,
  'content': instance.content,
  if (instance.title case final value?) 'title': value,
  'created_at': instance.createdAt,
};
