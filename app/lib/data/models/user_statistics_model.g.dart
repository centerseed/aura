// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'user_statistics_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$UserStatisticsModelImpl _$$UserStatisticsModelImplFromJson(
  Map<String, dynamic> json,
) => _$UserStatisticsModelImpl(
  totalTasks: (json['totalTasks'] as num).toInt(),
  totalProducts: (json['totalProducts'] as num).toInt(),
  totalAreas: (json['totalAreas'] as num).toInt(),
  daysActive: (json['daysActive'] as num).toInt(),
  activeTasks: (json['activeTasks'] as num).toInt(),
  archivedTasks: (json['archivedTasks'] as num).toInt(),
  completedToday: (json['completedToday'] as num).toInt(),
);

Map<String, dynamic> _$$UserStatisticsModelImplToJson(
  _$UserStatisticsModelImpl instance,
) => <String, dynamic>{
  'totalTasks': instance.totalTasks,
  'totalProducts': instance.totalProducts,
  'totalAreas': instance.totalAreas,
  'daysActive': instance.daysActive,
  'activeTasks': instance.activeTasks,
  'archivedTasks': instance.archivedTasks,
  'completedToday': instance.completedToday,
};
