// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'milestone_model.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

MilestoneModel _$MilestoneModelFromJson(Map<String, dynamic> json) {
  return _MilestoneModel.fromJson(json);
}

/// @nodoc
mixin _$MilestoneModel {
  String get id => throw _privateConstructorUsedError;
  @JsonKey(name: 'user_id')
  String get userId => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;
  @JsonKey(name: 'target_date')
  DateTime get targetDate => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  @JsonKey(name: 'entity_type')
  String get entityType => throw _privateConstructorUsedError;
  @JsonKey(name: 'entity_id')
  String get entityId => throw _privateConstructorUsedError;
  int get priority => throw _privateConstructorUsedError;
  String? get description =>
      throw _privateConstructorUsedError; // 關聯物件（API 返回的巢狀結構）
  Map<String, dynamic>? get product => throw _privateConstructorUsedError;
  Map<String, dynamic>? get area => throw _privateConstructorUsedError;
  Map<String, dynamic>? get topic => throw _privateConstructorUsedError;
  @JsonKey(name: 'created_at')
  DateTime? get createdAt => throw _privateConstructorUsedError;
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt => throw _privateConstructorUsedError;
  @JsonKey(name: 'deleted_at')
  DateTime? get deletedAt => throw _privateConstructorUsedError;

  /// Serializes this MilestoneModel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of MilestoneModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $MilestoneModelCopyWith<MilestoneModel> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $MilestoneModelCopyWith<$Res> {
  factory $MilestoneModelCopyWith(
    MilestoneModel value,
    $Res Function(MilestoneModel) then,
  ) = _$MilestoneModelCopyWithImpl<$Res, MilestoneModel>;
  @useResult
  $Res call({
    String id,
    @JsonKey(name: 'user_id') String userId,
    String name,
    @JsonKey(name: 'target_date') DateTime targetDate,
    String status,
    @JsonKey(name: 'entity_type') String entityType,
    @JsonKey(name: 'entity_id') String entityId,
    int priority,
    String? description,
    Map<String, dynamic>? product,
    Map<String, dynamic>? area,
    Map<String, dynamic>? topic,
    @JsonKey(name: 'created_at') DateTime? createdAt,
    @JsonKey(name: 'updated_at') DateTime? updatedAt,
    @JsonKey(name: 'deleted_at') DateTime? deletedAt,
  });
}

/// @nodoc
class _$MilestoneModelCopyWithImpl<$Res, $Val extends MilestoneModel>
    implements $MilestoneModelCopyWith<$Res> {
  _$MilestoneModelCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of MilestoneModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? userId = null,
    Object? name = null,
    Object? targetDate = null,
    Object? status = null,
    Object? entityType = null,
    Object? entityId = null,
    Object? priority = null,
    Object? description = freezed,
    Object? product = freezed,
    Object? area = freezed,
    Object? topic = freezed,
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
            targetDate: null == targetDate
                ? _value.targetDate
                : targetDate // ignore: cast_nullable_to_non_nullable
                      as DateTime,
            status: null == status
                ? _value.status
                : status // ignore: cast_nullable_to_non_nullable
                      as String,
            entityType: null == entityType
                ? _value.entityType
                : entityType // ignore: cast_nullable_to_non_nullable
                      as String,
            entityId: null == entityId
                ? _value.entityId
                : entityId // ignore: cast_nullable_to_non_nullable
                      as String,
            priority: null == priority
                ? _value.priority
                : priority // ignore: cast_nullable_to_non_nullable
                      as int,
            description: freezed == description
                ? _value.description
                : description // ignore: cast_nullable_to_non_nullable
                      as String?,
            product: freezed == product
                ? _value.product
                : product // ignore: cast_nullable_to_non_nullable
                      as Map<String, dynamic>?,
            area: freezed == area
                ? _value.area
                : area // ignore: cast_nullable_to_non_nullable
                      as Map<String, dynamic>?,
            topic: freezed == topic
                ? _value.topic
                : topic // ignore: cast_nullable_to_non_nullable
                      as Map<String, dynamic>?,
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
abstract class _$$MilestoneModelImplCopyWith<$Res>
    implements $MilestoneModelCopyWith<$Res> {
  factory _$$MilestoneModelImplCopyWith(
    _$MilestoneModelImpl value,
    $Res Function(_$MilestoneModelImpl) then,
  ) = __$$MilestoneModelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    @JsonKey(name: 'user_id') String userId,
    String name,
    @JsonKey(name: 'target_date') DateTime targetDate,
    String status,
    @JsonKey(name: 'entity_type') String entityType,
    @JsonKey(name: 'entity_id') String entityId,
    int priority,
    String? description,
    Map<String, dynamic>? product,
    Map<String, dynamic>? area,
    Map<String, dynamic>? topic,
    @JsonKey(name: 'created_at') DateTime? createdAt,
    @JsonKey(name: 'updated_at') DateTime? updatedAt,
    @JsonKey(name: 'deleted_at') DateTime? deletedAt,
  });
}

/// @nodoc
class __$$MilestoneModelImplCopyWithImpl<$Res>
    extends _$MilestoneModelCopyWithImpl<$Res, _$MilestoneModelImpl>
    implements _$$MilestoneModelImplCopyWith<$Res> {
  __$$MilestoneModelImplCopyWithImpl(
    _$MilestoneModelImpl _value,
    $Res Function(_$MilestoneModelImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of MilestoneModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? userId = null,
    Object? name = null,
    Object? targetDate = null,
    Object? status = null,
    Object? entityType = null,
    Object? entityId = null,
    Object? priority = null,
    Object? description = freezed,
    Object? product = freezed,
    Object? area = freezed,
    Object? topic = freezed,
    Object? createdAt = freezed,
    Object? updatedAt = freezed,
    Object? deletedAt = freezed,
  }) {
    return _then(
      _$MilestoneModelImpl(
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
        targetDate: null == targetDate
            ? _value.targetDate
            : targetDate // ignore: cast_nullable_to_non_nullable
                  as DateTime,
        status: null == status
            ? _value.status
            : status // ignore: cast_nullable_to_non_nullable
                  as String,
        entityType: null == entityType
            ? _value.entityType
            : entityType // ignore: cast_nullable_to_non_nullable
                  as String,
        entityId: null == entityId
            ? _value.entityId
            : entityId // ignore: cast_nullable_to_non_nullable
                  as String,
        priority: null == priority
            ? _value.priority
            : priority // ignore: cast_nullable_to_non_nullable
                  as int,
        description: freezed == description
            ? _value.description
            : description // ignore: cast_nullable_to_non_nullable
                  as String?,
        product: freezed == product
            ? _value._product
            : product // ignore: cast_nullable_to_non_nullable
                  as Map<String, dynamic>?,
        area: freezed == area
            ? _value._area
            : area // ignore: cast_nullable_to_non_nullable
                  as Map<String, dynamic>?,
        topic: freezed == topic
            ? _value._topic
            : topic // ignore: cast_nullable_to_non_nullable
                  as Map<String, dynamic>?,
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
class _$MilestoneModelImpl extends _MilestoneModel {
  const _$MilestoneModelImpl({
    required this.id,
    @JsonKey(name: 'user_id') required this.userId,
    required this.name,
    @JsonKey(name: 'target_date') required this.targetDate,
    required this.status,
    @JsonKey(name: 'entity_type') required this.entityType,
    @JsonKey(name: 'entity_id') required this.entityId,
    required this.priority,
    this.description,
    final Map<String, dynamic>? product,
    final Map<String, dynamic>? area,
    final Map<String, dynamic>? topic,
    @JsonKey(name: 'created_at') this.createdAt,
    @JsonKey(name: 'updated_at') this.updatedAt,
    @JsonKey(name: 'deleted_at') this.deletedAt,
  }) : _product = product,
       _area = area,
       _topic = topic,
       super._();

  factory _$MilestoneModelImpl.fromJson(Map<String, dynamic> json) =>
      _$$MilestoneModelImplFromJson(json);

  @override
  final String id;
  @override
  @JsonKey(name: 'user_id')
  final String userId;
  @override
  final String name;
  @override
  @JsonKey(name: 'target_date')
  final DateTime targetDate;
  @override
  final String status;
  @override
  @JsonKey(name: 'entity_type')
  final String entityType;
  @override
  @JsonKey(name: 'entity_id')
  final String entityId;
  @override
  final int priority;
  @override
  final String? description;
  // 關聯物件（API 返回的巢狀結構）
  final Map<String, dynamic>? _product;
  // 關聯物件（API 返回的巢狀結構）
  @override
  Map<String, dynamic>? get product {
    final value = _product;
    if (value == null) return null;
    if (_product is EqualUnmodifiableMapView) return _product;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(value);
  }

  final Map<String, dynamic>? _area;
  @override
  Map<String, dynamic>? get area {
    final value = _area;
    if (value == null) return null;
    if (_area is EqualUnmodifiableMapView) return _area;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(value);
  }

  final Map<String, dynamic>? _topic;
  @override
  Map<String, dynamic>? get topic {
    final value = _topic;
    if (value == null) return null;
    if (_topic is EqualUnmodifiableMapView) return _topic;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(value);
  }

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
    return 'MilestoneModel(id: $id, userId: $userId, name: $name, targetDate: $targetDate, status: $status, entityType: $entityType, entityId: $entityId, priority: $priority, description: $description, product: $product, area: $area, topic: $topic, createdAt: $createdAt, updatedAt: $updatedAt, deletedAt: $deletedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$MilestoneModelImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.userId, userId) || other.userId == userId) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.targetDate, targetDate) ||
                other.targetDate == targetDate) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.entityType, entityType) ||
                other.entityType == entityType) &&
            (identical(other.entityId, entityId) ||
                other.entityId == entityId) &&
            (identical(other.priority, priority) ||
                other.priority == priority) &&
            (identical(other.description, description) ||
                other.description == description) &&
            const DeepCollectionEquality().equals(other._product, _product) &&
            const DeepCollectionEquality().equals(other._area, _area) &&
            const DeepCollectionEquality().equals(other._topic, _topic) &&
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
    targetDate,
    status,
    entityType,
    entityId,
    priority,
    description,
    const DeepCollectionEquality().hash(_product),
    const DeepCollectionEquality().hash(_area),
    const DeepCollectionEquality().hash(_topic),
    createdAt,
    updatedAt,
    deletedAt,
  );

  /// Create a copy of MilestoneModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$MilestoneModelImplCopyWith<_$MilestoneModelImpl> get copyWith =>
      __$$MilestoneModelImplCopyWithImpl<_$MilestoneModelImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$MilestoneModelImplToJson(this);
  }
}

abstract class _MilestoneModel extends MilestoneModel {
  const factory _MilestoneModel({
    required final String id,
    @JsonKey(name: 'user_id') required final String userId,
    required final String name,
    @JsonKey(name: 'target_date') required final DateTime targetDate,
    required final String status,
    @JsonKey(name: 'entity_type') required final String entityType,
    @JsonKey(name: 'entity_id') required final String entityId,
    required final int priority,
    final String? description,
    final Map<String, dynamic>? product,
    final Map<String, dynamic>? area,
    final Map<String, dynamic>? topic,
    @JsonKey(name: 'created_at') final DateTime? createdAt,
    @JsonKey(name: 'updated_at') final DateTime? updatedAt,
    @JsonKey(name: 'deleted_at') final DateTime? deletedAt,
  }) = _$MilestoneModelImpl;
  const _MilestoneModel._() : super._();

  factory _MilestoneModel.fromJson(Map<String, dynamic> json) =
      _$MilestoneModelImpl.fromJson;

  @override
  String get id;
  @override
  @JsonKey(name: 'user_id')
  String get userId;
  @override
  String get name;
  @override
  @JsonKey(name: 'target_date')
  DateTime get targetDate;
  @override
  String get status;
  @override
  @JsonKey(name: 'entity_type')
  String get entityType;
  @override
  @JsonKey(name: 'entity_id')
  String get entityId;
  @override
  int get priority;
  @override
  String? get description; // 關聯物件（API 返回的巢狀結構）
  @override
  Map<String, dynamic>? get product;
  @override
  Map<String, dynamic>? get area;
  @override
  Map<String, dynamic>? get topic;
  @override
  @JsonKey(name: 'created_at')
  DateTime? get createdAt;
  @override
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt;
  @override
  @JsonKey(name: 'deleted_at')
  DateTime? get deletedAt;

  /// Create a copy of MilestoneModel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$MilestoneModelImplCopyWith<_$MilestoneModelImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
