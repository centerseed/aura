// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'area_model.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

AreaModel _$AreaModelFromJson(Map<String, dynamic> json) {
  return _AreaModel.fromJson(json);
}

/// @nodoc
mixin _$AreaModel {
  String get id => throw _privateConstructorUsedError;
  @JsonKey(name: 'user_id')
  String get userId => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;
  String? get description => throw _privateConstructorUsedError;
  String? get scope => throw _privateConstructorUsedError;
  @JsonKey(name: 'rolling_summary')
  Object? get rollingSummary => throw _privateConstructorUsedError;
  @JsonKey(name: 'is_custom')
  bool get isCustom => throw _privateConstructorUsedError;
  @JsonKey(name: 'created_at')
  DateTime? get createdAt => throw _privateConstructorUsedError;
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt => throw _privateConstructorUsedError;
  @JsonKey(name: 'deleted_at')
  DateTime? get deletedAt => throw _privateConstructorUsedError;

  /// Serializes this AreaModel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AreaModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AreaModelCopyWith<AreaModel> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AreaModelCopyWith<$Res> {
  factory $AreaModelCopyWith(AreaModel value, $Res Function(AreaModel) then) =
      _$AreaModelCopyWithImpl<$Res, AreaModel>;
  @useResult
  $Res call({
    String id,
    @JsonKey(name: 'user_id') String userId,
    String name,
    String? description,
    String? scope,
    @JsonKey(name: 'rolling_summary') Object? rollingSummary,
    @JsonKey(name: 'is_custom') bool isCustom,
    @JsonKey(name: 'created_at') DateTime? createdAt,
    @JsonKey(name: 'updated_at') DateTime? updatedAt,
    @JsonKey(name: 'deleted_at') DateTime? deletedAt,
  });
}

/// @nodoc
class _$AreaModelCopyWithImpl<$Res, $Val extends AreaModel>
    implements $AreaModelCopyWith<$Res> {
  _$AreaModelCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AreaModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? userId = null,
    Object? name = null,
    Object? description = freezed,
    Object? scope = freezed,
    Object? rollingSummary = freezed,
    Object? isCustom = null,
    Object? createdAt = freezed,
    Object? updatedAt = freezed,
    Object? deletedAt = freezed,
  }) {
    return _then(
      _value.copyWith(
            id: null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                      as String,
            userId: null == userId
                ? _value.userId
                : userId // ignore: cast_nullable_to_non_nullable
                      as String,
            name: null == name
                ? _value.name
                : name // ignore: cast_nullable_to_non_nullable
                      as String,
            description: freezed == description
                ? _value.description
                : description // ignore: cast_nullable_to_non_nullable
                      as String?,
            scope: freezed == scope
                ? _value.scope
                : scope // ignore: cast_nullable_to_non_nullable
                      as String?,
            rollingSummary: freezed == rollingSummary
                ? _value.rollingSummary
                : rollingSummary,
            isCustom: null == isCustom
                ? _value.isCustom
                : isCustom // ignore: cast_nullable_to_non_nullable
                      as bool,
            createdAt: freezed == createdAt
                ? _value.createdAt
                : createdAt // ignore: cast_nullable_to_non_nullable
                      as DateTime?,
            updatedAt: freezed == updatedAt
                ? _value.updatedAt
                : updatedAt // ignore: cast_nullable_to_non_nullable
                      as DateTime?,
            deletedAt: freezed == deletedAt
                ? _value.deletedAt
                : deletedAt // ignore: cast_nullable_to_non_nullable
                      as DateTime?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$AreaModelImplCopyWith<$Res>
    implements $AreaModelCopyWith<$Res> {
  factory _$$AreaModelImplCopyWith(
    _$AreaModelImpl value,
    $Res Function(_$AreaModelImpl) then,
  ) = __$$AreaModelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    @JsonKey(name: 'user_id') String userId,
    String name,
    String? description,
    String? scope,
    @JsonKey(name: 'rolling_summary') Object? rollingSummary,
    @JsonKey(name: 'is_custom') bool isCustom,
    @JsonKey(name: 'created_at') DateTime? createdAt,
    @JsonKey(name: 'updated_at') DateTime? updatedAt,
    @JsonKey(name: 'deleted_at') DateTime? deletedAt,
  });
}

/// @nodoc
class __$$AreaModelImplCopyWithImpl<$Res>
    extends _$AreaModelCopyWithImpl<$Res, _$AreaModelImpl>
    implements _$$AreaModelImplCopyWith<$Res> {
  __$$AreaModelImplCopyWithImpl(
    _$AreaModelImpl _value,
    $Res Function(_$AreaModelImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of AreaModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? userId = null,
    Object? name = null,
    Object? description = freezed,
    Object? scope = freezed,
    Object? rollingSummary = freezed,
    Object? isCustom = null,
    Object? createdAt = freezed,
    Object? updatedAt = freezed,
    Object? deletedAt = freezed,
  }) {
    return _then(
      _$AreaModelImpl(
        id: null == id
            ? _value.id
            : id // ignore: cast_nullable_to_non_nullable
                  as String,
        userId: null == userId
            ? _value.userId
            : userId // ignore: cast_nullable_to_non_nullable
                  as String,
        name: null == name
            ? _value.name
            : name // ignore: cast_nullable_to_non_nullable
                  as String,
        description: freezed == description
            ? _value.description
            : description // ignore: cast_nullable_to_non_nullable
                  as String?,
        scope: freezed == scope
            ? _value.scope
            : scope // ignore: cast_nullable_to_non_nullable
                  as String?,
        rollingSummary: freezed == rollingSummary
            ? _value.rollingSummary
            : rollingSummary,
        isCustom: null == isCustom
            ? _value.isCustom
            : isCustom // ignore: cast_nullable_to_non_nullable
                  as bool,
        createdAt: freezed == createdAt
            ? _value.createdAt
            : createdAt // ignore: cast_nullable_to_non_nullable
                  as DateTime?,
        updatedAt: freezed == updatedAt
            ? _value.updatedAt
            : updatedAt // ignore: cast_nullable_to_non_nullable
                  as DateTime?,
        deletedAt: freezed == deletedAt
            ? _value.deletedAt
            : deletedAt // ignore: cast_nullable_to_non_nullable
                  as DateTime?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$AreaModelImpl extends _AreaModel {
  const _$AreaModelImpl({
    required this.id,
    @JsonKey(name: 'user_id') required this.userId,
    required this.name,
    this.description,
    this.scope,
    @JsonKey(name: 'rolling_summary') this.rollingSummary,
    @JsonKey(name: 'is_custom') required this.isCustom,
    @JsonKey(name: 'created_at') this.createdAt,
    @JsonKey(name: 'updated_at') this.updatedAt,
    @JsonKey(name: 'deleted_at') this.deletedAt,
  }) : super._();

  factory _$AreaModelImpl.fromJson(Map<String, dynamic> json) =>
      _$$AreaModelImplFromJson(json);

  @override
  final String id;
  @override
  @JsonKey(name: 'user_id')
  final String userId;
  @override
  final String name;
  @override
  final String? description;
  @override
  final String? scope;
  @override
  @JsonKey(name: 'rolling_summary')
  final Object? rollingSummary;
  @override
  @JsonKey(name: 'is_custom')
  final bool isCustom;
  @override
  @JsonKey(name: 'created_at')
  final DateTime? createdAt;
  @override
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;
  @override
  @JsonKey(name: 'deleted_at')
  final DateTime? deletedAt;

  @override
  String toString() {
    return 'AreaModel(id: $id, userId: $userId, name: $name, description: $description, scope: $scope, rollingSummary: $rollingSummary, isCustom: $isCustom, createdAt: $createdAt, updatedAt: $updatedAt, deletedAt: $deletedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AreaModelImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.userId, userId) || other.userId == userId) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.description, description) ||
                other.description == description) &&
            (identical(other.scope, scope) || other.scope == scope) &&
            const DeepCollectionEquality().equals(
              other.rollingSummary,
              rollingSummary,
            ) &&
            (identical(other.isCustom, isCustom) ||
                other.isCustom == isCustom) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            (identical(other.deletedAt, deletedAt) ||
                other.deletedAt == deletedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    id,
    userId,
    name,
    description,
    scope,
    const DeepCollectionEquality().hash(rollingSummary),
    isCustom,
    createdAt,
    updatedAt,
    deletedAt,
  );

  /// Create a copy of AreaModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AreaModelImplCopyWith<_$AreaModelImpl> get copyWith =>
      __$$AreaModelImplCopyWithImpl<_$AreaModelImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AreaModelImplToJson(this);
  }
}

abstract class _AreaModel extends AreaModel {
  const factory _AreaModel({
    required final String id,
    @JsonKey(name: 'user_id') required final String userId,
    required final String name,
    final String? description,
    final String? scope,
    @JsonKey(name: 'rolling_summary') final Object? rollingSummary,
    @JsonKey(name: 'is_custom') required final bool isCustom,
    @JsonKey(name: 'created_at') final DateTime? createdAt,
    @JsonKey(name: 'updated_at') final DateTime? updatedAt,
    @JsonKey(name: 'deleted_at') final DateTime? deletedAt,
  }) = _$AreaModelImpl;
  const _AreaModel._() : super._();

  factory _AreaModel.fromJson(Map<String, dynamic> json) =
      _$AreaModelImpl.fromJson;

  @override
  String get id;
  @override
  @JsonKey(name: 'user_id')
  String get userId;
  @override
  String get name;
  @override
  String? get description;
  @override
  String? get scope;
  @override
  @JsonKey(name: 'rolling_summary')
  Object? get rollingSummary;
  @override
  @JsonKey(name: 'is_custom')
  bool get isCustom;
  @override
  @JsonKey(name: 'created_at')
  DateTime? get createdAt;
  @override
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt;
  @override
  @JsonKey(name: 'deleted_at')
  DateTime? get deletedAt;

  /// Create a copy of AreaModel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AreaModelImplCopyWith<_$AreaModelImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
