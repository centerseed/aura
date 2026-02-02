import 'package:freezed_annotation/freezed_annotation.dart';

part 'brain_dump_models.freezed.dart';
part 'brain_dump_models.g.dart';

// ==================== Request ====================

@freezed
class BrainDumpRequest with _$BrainDumpRequest {
  const factory BrainDumpRequest({required String text}) = _BrainDumpRequest;

  factory BrainDumpRequest.fromJson(Map<String, dynamic> json) =>
      _$BrainDumpRequestFromJson(json);
}

// ==================== Response ====================

@freezed
class BrainDumpResponse with _$BrainDumpResponse {
  // 創建新任務的回應
  const factory BrainDumpResponse.createNewTasks({
    required bool success,
    required List<BrainDumpItem> items,
  }) = BrainDumpCreateNewTasksResponse;

  // 追加 sub-item 的回應
  const factory BrainDumpResponse.appendSubItem({
    required bool success,
    @JsonKey(name: 'target_task') required BrainDumpTargetTask targetTask,
    @JsonKey(name: 'appended_sub_items') required List<BrainDumpAppendedSubItem> appendedSubItems,
    required String reasoning,
  }) = BrainDumpAppendSubItemResponse;

  factory BrainDumpResponse.fromJson(Map<String, dynamic> json) {
    // 根據 action 字段判斷使用哪個工廠構造函數
    final action = json['action'] as String?;
    if (action == 'append_sub_item') {
      return BrainDumpResponse.appendSubItem(
        success: json['success'] as bool,
        targetTask: BrainDumpTargetTask.fromJson(json['target_task'] as Map<String, dynamic>),
        appendedSubItems: (json['appended_sub_items'] as List)
            .map((e) => BrainDumpAppendedSubItem.fromJson(e as Map<String, dynamic>))
            .toList(),
        reasoning: json['reasoning'] as String,
      );
    } else {
      // 默認為 create_new_tasks
      return BrainDumpResponse.createNewTasks(
        success: json['success'] as bool,
        items: (json['items'] as List)
            .map((e) => BrainDumpItem.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
    }
  }
}

// 目標任務資訊
@freezed
class BrainDumpTargetTask with _$BrainDumpTargetTask {
  const factory BrainDumpTargetTask({
    required String id,
    required String content,
    required String product,
  }) = _BrainDumpTargetTask;

  factory BrainDumpTargetTask.fromJson(Map<String, dynamic> json) =>
      _$BrainDumpTargetTaskFromJson(json);
}

// 追加的 sub-item 結構
@freezed
class BrainDumpAppendedSubItem with _$BrainDumpAppendedSubItem {
  const factory BrainDumpAppendedSubItem({
    required String id,
    required String content,
    required bool completed,
    @JsonKey(name: 'created_at') required String createdAt,
    @JsonKey(name: 'completed_at') String? completedAt,
    required int order,
  }) = _BrainDumpAppendedSubItem;

  factory BrainDumpAppendedSubItem.fromJson(Map<String, dynamic> json) =>
      _$BrainDumpAppendedSubItemFromJson(json);
}

// 來源歸因結構
@freezed
class SourceAttribution with _$SourceAttribution {
  const factory SourceAttribution({
    @JsonKey(name: 'source_type') required String sourceType,
    required double confidence,
    required String reasoning,
  }) = _SourceAttribution;

  factory SourceAttribution.fromJson(Map<String, dynamic> json) =>
      _$SourceAttributionFromJson(json);
}

@freezed
class BrainDumpItem with _$BrainDumpItem {
  const factory BrainDumpItem({
    required String id,
    required String title,
    required String narrative,
    required String drawer,
    required BrainDumpTag tag,
    @JsonKey(name: 'strategy_used') String? strategyUsed,
    String? reasoning,
    @JsonKey(name: 'due_date') String? dueDate,
    @JsonKey(name: 'time_confidence') double? timeConfidence,
    @JsonKey(name: 'due_date_source') SourceAttribution? dueDateSource,
    @JsonKey(name: 'inferred_from_milestone') String? inferredFromMilestone,
  }) = _BrainDumpItem;

  factory BrainDumpItem.fromJson(Map<String, dynamic> json) =>
      _$BrainDumpItemFromJson(json);
}

@freezed
class BrainDumpTag with _$BrainDumpTag {
  const factory BrainDumpTag({
    required String area,
    required String product,
    String? topic,
  }) = _BrainDumpTag;

  factory BrainDumpTag.fromJson(Map<String, dynamic> json) =>
      _$BrainDumpTagFromJson(json);
}
