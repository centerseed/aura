// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'brain_dump_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$BrainDumpRequestImpl _$$BrainDumpRequestImplFromJson(
  Map<String, dynamic> json,
) => _$BrainDumpRequestImpl(text: json['text'] as String);

Map<String, dynamic> _$$BrainDumpRequestImplToJson(
  _$BrainDumpRequestImpl instance,
) => <String, dynamic>{'text': instance.text};

_$BrainDumpResponseImpl _$$BrainDumpResponseImplFromJson(
  Map<String, dynamic> json,
) => _$BrainDumpResponseImpl(
  success: json['success'] as bool,
  items: (json['items'] as List<dynamic>)
      .map((e) => BrainDumpItem.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$$BrainDumpResponseImplToJson(
  _$BrainDumpResponseImpl instance,
) => <String, dynamic>{
  'success': instance.success,
  'items': instance.items.map((e) => e.toJson()).toList(),
};

_$BrainDumpItemImpl _$$BrainDumpItemImplFromJson(Map<String, dynamic> json) =>
    _$BrainDumpItemImpl(
      id: json['id'] as String,
      title: json['title'] as String,
      narrative: json['narrative'] as String,
      drawer: json['drawer'] as String,
      tag: BrainDumpTag.fromJson(json['tag'] as Map<String, dynamic>),
      dueDate: json['due_date'] as String?,
      timeConfidence: (json['time_confidence'] as num?)?.toDouble(),
      timeReasoning: json['time_reasoning'] as String?,
      inferredFromMilestone: json['inferred_from_milestone'] as String?,
    );

Map<String, dynamic> _$$BrainDumpItemImplToJson(_$BrainDumpItemImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'narrative': instance.narrative,
      'drawer': instance.drawer,
      'tag': instance.tag.toJson(),
      if (instance.dueDate case final value?) 'due_date': value,
      if (instance.timeConfidence case final value?) 'time_confidence': value,
      if (instance.timeReasoning case final value?) 'time_reasoning': value,
      if (instance.inferredFromMilestone case final value?)
        'inferred_from_milestone': value,
    };

_$BrainDumpTagImpl _$$BrainDumpTagImplFromJson(Map<String, dynamic> json) =>
    _$BrainDumpTagImpl(
      area: json['area'] as String,
      product: json['product'] as String,
      topic: json['topic'] as String?,
    );

Map<String, dynamic> _$$BrainDumpTagImplToJson(_$BrainDumpTagImpl instance) =>
    <String, dynamic>{
      'area': instance.area,
      'product': instance.product,
      if (instance.topic case final value?) 'topic': value,
    };
