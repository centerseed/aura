// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'reference_model.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

ReferenceModel _$ReferenceModelFromJson(Map<String, dynamic> json) {
  return _ReferenceModel.fromJson(json);
}

/// @nodoc
mixin _$ReferenceModel {
  String get id => throw _privateConstructorUsedError;
  String get type => throw _privateConstructorUsedError;
  String get content => throw _privateConstructorUsedError;
  String? get title => throw _privateConstructorUsedError;
  @JsonKey(name: 'created_at')
  String get createdAt => throw _privateConstructorUsedError;

  /// Serializes this ReferenceModel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ReferenceModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ReferenceModelCopyWith<ReferenceModel> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ReferenceModelCopyWith<$Res> {
  factory $ReferenceModelCopyWith(
    ReferenceModel value,
    $Res Function(ReferenceModel) then,
  ) = _$ReferenceModelCopyWithImpl<$Res, ReferenceModel>;
  @useResult
  $Res call({
    String id,
    String type,
    String content,
    String? title,
    @JsonKey(name: 'created_at') String createdAt,
  });
}

/// @nodoc
class _$ReferenceModelCopyWithImpl<$Res, $Val extends ReferenceModel>
    implements $ReferenceModelCopyWith<$Res> {
  _$ReferenceModelCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ReferenceModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? content = null,
    Object? title = freezed,
    Object? createdAt = null,
  }) {
    return _then(
      _value.copyWith(
            id: null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                      as String,
            type: null == type
                ? _value.type
                : type // ignore: cast_nullable_to_non_nullable
                      as String,
            content: null == content
                ? _value.content
                : content // ignore: cast_nullable_to_non_nullable
                      as String,
            title: freezed == title
                ? _value.title
                : title // ignore: cast_nullable_to_non_nullable
                      as String?,
            createdAt: null == createdAt
                ? _value.createdAt
                : createdAt // ignore: cast_nullable_to_non_nullable
                      as String,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$ReferenceModelImplCopyWith<$Res>
    implements $ReferenceModelCopyWith<$Res> {
  factory _$$ReferenceModelImplCopyWith(
    _$ReferenceModelImpl value,
    $Res Function(_$ReferenceModelImpl) then,
  ) = __$$ReferenceModelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String type,
    String content,
    String? title,
    @JsonKey(name: 'created_at') String createdAt,
  });
}

/// @nodoc
class __$$ReferenceModelImplCopyWithImpl<$Res>
    extends _$ReferenceModelCopyWithImpl<$Res, _$ReferenceModelImpl>
    implements _$$ReferenceModelImplCopyWith<$Res> {
  __$$ReferenceModelImplCopyWithImpl(
    _$ReferenceModelImpl _value,
    $Res Function(_$ReferenceModelImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of ReferenceModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? content = null,
    Object? title = freezed,
    Object? createdAt = null,
  }) {
    return _then(
      _$ReferenceModelImpl(
        id: null == id
            ? _value.id
            : id // ignore: cast_nullable_to_non_nullable
                  as String,
        type: null == type
            ? _value.type
            : type // ignore: cast_nullable_to_non_nullable
                  as String,
        content: null == content
            ? _value.content
            : content // ignore: cast_nullable_to_non_nullable
                  as String,
        title: freezed == title
            ? _value.title
            : title // ignore: cast_nullable_to_non_nullable
                  as String?,
        createdAt: null == createdAt
            ? _value.createdAt
            : createdAt // ignore: cast_nullable_to_non_nullable
                  as String,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$ReferenceModelImpl extends _ReferenceModel {
  const _$ReferenceModelImpl({
    required this.id,
    required this.type,
    required this.content,
    this.title,
    @JsonKey(name: 'created_at') required this.createdAt,
  }) : super._();

  factory _$ReferenceModelImpl.fromJson(Map<String, dynamic> json) =>
      _$$ReferenceModelImplFromJson(json);

  @override
  final String id;
  @override
  final String type;
  @override
  final String content;
  @override
  final String? title;
  @override
  @JsonKey(name: 'created_at')
  final String createdAt;

  @override
  String toString() {
    return 'ReferenceModel(id: $id, type: $type, content: $content, title: $title, createdAt: $createdAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ReferenceModelImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.content, content) || other.content == content) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, id, type, content, title, createdAt);

  /// Create a copy of ReferenceModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ReferenceModelImplCopyWith<_$ReferenceModelImpl> get copyWith =>
      __$$ReferenceModelImplCopyWithImpl<_$ReferenceModelImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$ReferenceModelImplToJson(this);
  }
}

abstract class _ReferenceModel extends ReferenceModel {
  const factory _ReferenceModel({
    required final String id,
    required final String type,
    required final String content,
    final String? title,
    @JsonKey(name: 'created_at') required final String createdAt,
  }) = _$ReferenceModelImpl;
  const _ReferenceModel._() : super._();

  factory _ReferenceModel.fromJson(Map<String, dynamic> json) =
      _$ReferenceModelImpl.fromJson;

  @override
  String get id;
  @override
  String get type;
  @override
  String get content;
  @override
  String? get title;
  @override
  @JsonKey(name: 'created_at')
  String get createdAt;

  /// Create a copy of ReferenceModel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ReferenceModelImplCopyWith<_$ReferenceModelImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
