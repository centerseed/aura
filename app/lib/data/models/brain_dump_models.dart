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
  const factory BrainDumpResponse({
    required bool success,
    required List<BrainDumpItem> items,
  }) = _BrainDumpResponse;

  factory BrainDumpResponse.fromJson(Map<String, dynamic> json) =>
      _$BrainDumpResponseFromJson(json);
}

@freezed
class BrainDumpItem with _$BrainDumpItem {
  const factory BrainDumpItem({
    required String id,
    required String title,
    required String narrative,
    required String drawer,
    required BrainDumpTag tag,
    @JsonKey(name: 'due_date') String? dueDate,
    @JsonKey(name: 'time_confidence') double? timeConfidence,
    @JsonKey(name: 'time_reasoning') String? timeReasoning,
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
