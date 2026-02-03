import 'package:freezed_annotation/freezed_annotation.dart';
import '../../domain/entities/user_statistics.dart';

part 'user_statistics_model.freezed.dart';
part 'user_statistics_model.g.dart';

@freezed
class UserStatisticsModel with _$UserStatisticsModel {
  const factory UserStatisticsModel({
    @JsonKey(name: 'totalTasks') required int totalTasks,
    @JsonKey(name: 'totalProducts') required int totalProducts,
    @JsonKey(name: 'totalAreas') required int totalAreas,
    @JsonKey(name: 'daysActive') required int daysActive,
    @JsonKey(name: 'activeTasks') required int activeTasks,
    @JsonKey(name: 'archivedTasks') required int archivedTasks,
    @JsonKey(name: 'completedToday') required int completedToday,
  }) = _UserStatisticsModel;

  factory UserStatisticsModel.fromJson(Map<String, dynamic> json) =>
      _$UserStatisticsModelFromJson(json);

  // 轉換為 Domain Entity
  const UserStatisticsModel._();

  UserStatistics toEntity() => UserStatistics(
        totalTasks: totalTasks,
        totalProducts: totalProducts,
        totalAreas: totalAreas,
        daysActive: daysActive,
        activeTasks: activeTasks,
        archivedTasks: archivedTasks,
        completedToday: completedToday,
      );
}
