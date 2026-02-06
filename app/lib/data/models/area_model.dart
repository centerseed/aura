import 'package:freezed_annotation/freezed_annotation.dart';
import '../../domain/entities/area.dart';

part 'area_model.freezed.dart';
part 'area_model.g.dart';

@freezed
class AreaModel with _$AreaModel {
  const factory AreaModel({
    required String id,
    @JsonKey(name: 'user_id') required String userId,
    required String name,
    String? description,
    String? scope,
    @JsonKey(name: 'rolling_summary') Object? rollingSummary,
    @JsonKey(name: 'is_custom') required bool isCustom,
    @JsonKey(name: 'created_at') DateTime? createdAt,
    @JsonKey(name: 'updated_at') DateTime? updatedAt,
    @JsonKey(name: 'deleted_at') DateTime? deletedAt,
  }) = _AreaModel;

  factory AreaModel.fromJson(Map<String, dynamic> json) =>
      _$AreaModelFromJson(json);

  const AreaModel._();

  Area toEntity() => Area(
    id: id,
    name: name,
    description: description,
    scope: scope,
    rollingSummary: rollingSummary?.toString(),
    isCustom: isCustom,
    createdAt: createdAt,
    updatedAt: updatedAt,
  );
}
