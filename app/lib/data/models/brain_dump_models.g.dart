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

_$BrainDumpTargetTaskImpl _$$BrainDumpTargetTaskImplFromJson(
  Map<String, dynamic> json,
) => _$BrainDumpTargetTaskImpl(
  id: json['id'] as String,
  content: json['content'] as String,
  product: json['product'] as String,
);

Map<String, dynamic> _$$BrainDumpTargetTaskImplToJson(
  _$BrainDumpTargetTaskImpl instance,
) => <String, dynamic>{
  'id': instance.id,
  'content': instance.content,
  'product': instance.product,
};

_$BrainDumpAppendedSubItemImpl _$$BrainDumpAppendedSubItemImplFromJson(
  Map<String, dynamic> json,
) => _$BrainDumpAppendedSubItemImpl(
  id: json['id'] as String,
  content: json['content'] as String,
  completed: json['completed'] as bool,
  createdAt: json['created_at'] as String,
  completedAt: json['completed_at'] as String?,
  order: (json['order'] as num).toInt(),
);

Map<String, dynamic> _$$BrainDumpAppendedSubItemImplToJson(
  _$BrainDumpAppendedSubItemImpl instance,
) => <String, dynamic>{
  'id': instance.id,
  'content': instance.content,
  'completed': instance.completed,
  'created_at': instance.createdAt,
  if (instance.completedAt case final value?) 'completed_at': value,
  'order': instance.order,
};

_$SourceAttributionImpl _$$SourceAttributionImplFromJson(
  Map<String, dynamic> json,
) => _$SourceAttributionImpl(
  sourceType: json['source_type'] as String,
  confidence: (json['confidence'] as num).toDouble(),
  reasoning: json['reasoning'] as String,
);

Map<String, dynamic> _$$SourceAttributionImplToJson(
  _$SourceAttributionImpl instance,
) => <String, dynamic>{
  'source_type': instance.sourceType,
  'confidence': instance.confidence,
  'reasoning': instance.reasoning,
};

_$BrainDumpItemImpl _$$BrainDumpItemImplFromJson(Map<String, dynamic> json) =>
    _$BrainDumpItemImpl(
      id: json['id'] as String,
      title: json['title'] as String,
      narrative: json['narrative'] as String,
      drawer: json['drawer'] as String,
      tag: BrainDumpTag.fromJson(json['tag'] as Map<String, dynamic>),
      strategyUsed: json['strategy_used'] as String?,
      reasoning: json['reasoning'] as String?,
      dueDate: json['due_date'] as String?,
      timeConfidence: (json['time_confidence'] as num?)?.toDouble(),
      dueDateSource: json['due_date_source'] == null
          ? null
          : SourceAttribution.fromJson(
              json['due_date_source'] as Map<String, dynamic>,
            ),
      inferredFromMilestone: json['inferred_from_milestone'] as String?,
    );

Map<String, dynamic> _$$BrainDumpItemImplToJson(_$BrainDumpItemImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'narrative': instance.narrative,
      'drawer': instance.drawer,
      'tag': instance.tag.toJson(),
      if (instance.strategyUsed case final value?) 'strategy_used': value,
      if (instance.reasoning case final value?) 'reasoning': value,
      if (instance.dueDate case final value?) 'due_date': value,
      if (instance.timeConfidence case final value?) 'time_confidence': value,
      if (instance.dueDateSource?.toJson() case final value?)
        'due_date_source': value,
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
