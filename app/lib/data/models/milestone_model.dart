import 'package:freezed_annotation/freezed_annotation.dart';

import '../../domain/entities/milestone.dart';

part 'milestone_model.freezed.dart';
part 'milestone_model.g.dart';

/// Milestone API Model
@Freezed(toJson: true)
class MilestoneModel with _$MilestoneModel {
  const factory MilestoneModel({
    required String id,
    @JsonKey(name: 'user_id') required String userId,
    required String name,
    @JsonKey(name: 'target_date') required DateTime targetDate,
    required String status,
    @JsonKey(name: 'entity_type') required String entityType,
    @JsonKey(name: 'entity_id') required String entityId,
    @Default(1) int priority,
    String? description,
    // 關聯物件（API 返回的巢狀結構）
    Map<String, dynamic>? product,
    Map<String, dynamic>? area,
    Map<String, dynamic>? topic,
    @JsonKey(name: 'created_at') DateTime? createdAt,
    @JsonKey(name: 'updated_at') DateTime? updatedAt,
    @JsonKey(name: 'deleted_at') DateTime? deletedAt,
  }) = _MilestoneModel;

  factory MilestoneModel.fromJson(Map<String, dynamic> json) =>
      _$MilestoneModelFromJson(json);

  const MilestoneModel._();

  /// 轉換為 Domain Entity
  Milestone toEntity() => Milestone(
        id: id,
        name: name,
        targetDate: targetDate.toLocal(),
        status: MilestoneStatusExtension.fromApiValue(status),
        entityType: MilestoneEntityTypeExtension.fromApiValue(entityType),
        entityId: entityId,
        priority: priority,
        description: description,
        productName: product?['name'] as String?,
        areaName: area?['name'] as String?,
        topicName: topic?['name'] as String?,
        createdAt: createdAt?.toLocal(),
        updatedAt: updatedAt?.toLocal(),
      );
}
