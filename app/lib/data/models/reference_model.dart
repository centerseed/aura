import 'package:freezed_annotation/freezed_annotation.dart';
import '../../domain/entities/reference.dart';

part 'reference_model.freezed.dart';
part 'reference_model.g.dart';

@freezed
class ReferenceModel with _$ReferenceModel {
  const factory ReferenceModel({
    required String id,
    required String type,
    required String content,
    String? title,
    @JsonKey(name: 'created_at') required String createdAt,
  }) = _ReferenceModel;

  factory ReferenceModel.fromJson(Map<String, dynamic> json) =>
      _$ReferenceModelFromJson(json);

  const ReferenceModel._();

  Reference toEntity() => Reference(
    id: id,
    type: _parseType(type),
    content: content,
    title: title,
    createdAt: DateTime.parse(createdAt),
  );

  ReferenceType _parseType(String type) {
    switch (type.toLowerCase()) {
      case 'url':
        return ReferenceType.url;
      case 'note':
        return ReferenceType.note;
      default:
        return ReferenceType.note;
    }
  }
}
