// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'product_model.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

ProductModel _$ProductModelFromJson(Map<String, dynamic> json) {
  return _ProductModel.fromJson(json);
}

/// @nodoc
mixin _$ProductModel {
  String get id => throw _privateConstructorUsedError;
  @JsonKey(name: 'user_id')
  String get userId => throw _privateConstructorUsedError;
  @JsonKey(name: 'area_id')
  String get areaId => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;
  String? get description => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  String get lifecycle => throw _privateConstructorUsedError;
  @JsonKey(name: 'display_order', defaultValue: 0)
  int get displayOrder => throw _privateConstructorUsedError;
  @JsonKey(name: 'created_at')
  DateTime? get createdAt => throw _privateConstructorUsedError;
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt => throw _privateConstructorUsedError;
  @JsonKey(name: 'deleted_at')
  DateTime? get deletedAt => throw _privateConstructorUsedError; // 關聯資料
  List<ReferenceModel>? get references => throw _privateConstructorUsedError;
  @JsonKey(name: 'total_reference_count')
  int? get totalReferenceCount => throw _privateConstructorUsedError;
  List<TaskModel>? get tasks => throw _privateConstructorUsedError;
  @JsonKey(name: 'recent_tasks')
  List<TaskModel>? get recentTasks => throw _privateConstructorUsedError;

  /// Serializes this ProductModel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ProductModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ProductModelCopyWith<ProductModel> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ProductModelCopyWith<$Res> {
  factory $ProductModelCopyWith(
    ProductModel value,
    $Res Function(ProductModel) then,
  ) = _$ProductModelCopyWithImpl<$Res, ProductModel>;
  @useResult
  $Res call({
    String id,
    @JsonKey(name: 'user_id') String userId,
    @JsonKey(name: 'area_id') String areaId,
    String name,
    String? description,
    String status,
    String lifecycle,
    @JsonKey(name: 'display_order', defaultValue: 0) int displayOrder,
    @JsonKey(name: 'created_at') DateTime? createdAt,
    @JsonKey(name: 'updated_at') DateTime? updatedAt,
    @JsonKey(name: 'deleted_at') DateTime? deletedAt,
    List<ReferenceModel>? references,
    @JsonKey(name: 'total_reference_count') int? totalReferenceCount,
    List<TaskModel>? tasks,
    @JsonKey(name: 'recent_tasks') List<TaskModel>? recentTasks,
  });
}

/// @nodoc
class _$ProductModelCopyWithImpl<$Res, $Val extends ProductModel>
    implements $ProductModelCopyWith<$Res> {
  _$ProductModelCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ProductModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? userId = null,
    Object? areaId = null,
    Object? name = null,
    Object? description = freezed,
    Object? status = null,
    Object? lifecycle = null,
    Object? displayOrder = null,
    Object? createdAt = freezed,
    Object? updatedAt = freezed,
    Object? deletedAt = freezed,
    Object? references = freezed,
    Object? totalReferenceCount = freezed,
    Object? tasks = freezed,
    Object? recentTasks = freezed,
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
            areaId: null == areaId
                ? _value.areaId
                : areaId // ignore: cast_nullable_to_non_nullable
                      as String,
            name: null == name
                ? _value.name
                : name // ignore: cast_nullable_to_non_nullable
                      as String,
            description: freezed == description
                ? _value.description
                : description // ignore: cast_nullable_to_non_nullable
                      as String?,
            status: null == status
                ? _value.status
                : status // ignore: cast_nullable_to_non_nullable
                      as String,
            lifecycle: null == lifecycle
                ? _value.lifecycle
                : lifecycle // ignore: cast_nullable_to_non_nullable
                      as String,
            displayOrder: null == displayOrder
                ? _value.displayOrder
                : displayOrder // ignore: cast_nullable_to_non_nullable
                      as int,
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
            references: freezed == references
                ? _value.references
                : references // ignore: cast_nullable_to_non_nullable
                      as List<ReferenceModel>?,
            totalReferenceCount: freezed == totalReferenceCount
                ? _value.totalReferenceCount
                : totalReferenceCount // ignore: cast_nullable_to_non_nullable
                      as int?,
            tasks: freezed == tasks
                ? _value.tasks
                : tasks // ignore: cast_nullable_to_non_nullable
                      as List<TaskModel>?,
            recentTasks: freezed == recentTasks
                ? _value.recentTasks
                : recentTasks // ignore: cast_nullable_to_non_nullable
                      as List<TaskModel>?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$ProductModelImplCopyWith<$Res>
    implements $ProductModelCopyWith<$Res> {
  factory _$$ProductModelImplCopyWith(
    _$ProductModelImpl value,
    $Res Function(_$ProductModelImpl) then,
  ) = __$$ProductModelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    @JsonKey(name: 'user_id') String userId,
    @JsonKey(name: 'area_id') String areaId,
    String name,
    String? description,
    String status,
    String lifecycle,
    @JsonKey(name: 'display_order', defaultValue: 0) int displayOrder,
    @JsonKey(name: 'created_at') DateTime? createdAt,
    @JsonKey(name: 'updated_at') DateTime? updatedAt,
    @JsonKey(name: 'deleted_at') DateTime? deletedAt,
    List<ReferenceModel>? references,
    @JsonKey(name: 'total_reference_count') int? totalReferenceCount,
    List<TaskModel>? tasks,
    @JsonKey(name: 'recent_tasks') List<TaskModel>? recentTasks,
  });
}

/// @nodoc
class __$$ProductModelImplCopyWithImpl<$Res>
    extends _$ProductModelCopyWithImpl<$Res, _$ProductModelImpl>
    implements _$$ProductModelImplCopyWith<$Res> {
  __$$ProductModelImplCopyWithImpl(
    _$ProductModelImpl _value,
    $Res Function(_$ProductModelImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of ProductModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? userId = null,
    Object? areaId = null,
    Object? name = null,
    Object? description = freezed,
    Object? status = null,
    Object? lifecycle = null,
    Object? displayOrder = null,
    Object? createdAt = freezed,
    Object? updatedAt = freezed,
    Object? deletedAt = freezed,
    Object? references = freezed,
    Object? totalReferenceCount = freezed,
    Object? tasks = freezed,
    Object? recentTasks = freezed,
  }) {
    return _then(
      _$ProductModelImpl(
        id: null == id
            ? _value.id
            : id // ignore: cast_nullable_to_non_nullable
                  as String,
        userId: null == userId
            ? _value.userId
            : userId // ignore: cast_nullable_to_non_nullable
                  as String,
        areaId: null == areaId
            ? _value.areaId
            : areaId // ignore: cast_nullable_to_non_nullable
                  as String,
        name: null == name
            ? _value.name
            : name // ignore: cast_nullable_to_non_nullable
                  as String,
        description: freezed == description
            ? _value.description
            : description // ignore: cast_nullable_to_non_nullable
                  as String?,
        status: null == status
            ? _value.status
            : status // ignore: cast_nullable_to_non_nullable
                  as String,
        lifecycle: null == lifecycle
            ? _value.lifecycle
            : lifecycle // ignore: cast_nullable_to_non_nullable
                  as String,
        displayOrder: null == displayOrder
            ? _value.displayOrder
            : displayOrder // ignore: cast_nullable_to_non_nullable
                  as int,
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
        references: freezed == references
            ? _value._references
            : references // ignore: cast_nullable_to_non_nullable
                  as List<ReferenceModel>?,
        totalReferenceCount: freezed == totalReferenceCount
            ? _value.totalReferenceCount
            : totalReferenceCount // ignore: cast_nullable_to_non_nullable
                  as int?,
        tasks: freezed == tasks
            ? _value._tasks
            : tasks // ignore: cast_nullable_to_non_nullable
                  as List<TaskModel>?,
        recentTasks: freezed == recentTasks
            ? _value._recentTasks
            : recentTasks // ignore: cast_nullable_to_non_nullable
                  as List<TaskModel>?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$ProductModelImpl extends _ProductModel {
  const _$ProductModelImpl({
    required this.id,
    @JsonKey(name: 'user_id') required this.userId,
    @JsonKey(name: 'area_id') required this.areaId,
    required this.name,
    this.description,
    required this.status,
    required this.lifecycle,
    @JsonKey(name: 'display_order', defaultValue: 0) required this.displayOrder,
    @JsonKey(name: 'created_at') this.createdAt,
    @JsonKey(name: 'updated_at') this.updatedAt,
    @JsonKey(name: 'deleted_at') this.deletedAt,
    final List<ReferenceModel>? references,
    @JsonKey(name: 'total_reference_count') this.totalReferenceCount,
    final List<TaskModel>? tasks,
    @JsonKey(name: 'recent_tasks') final List<TaskModel>? recentTasks,
  }) : _references = references,
       _tasks = tasks,
       _recentTasks = recentTasks,
       super._();

  factory _$ProductModelImpl.fromJson(Map<String, dynamic> json) =>
      _$$ProductModelImplFromJson(json);

  @override
  final String id;
  @override
  @JsonKey(name: 'user_id')
  final String userId;
  @override
  @JsonKey(name: 'area_id')
  final String areaId;
  @override
  final String name;
  @override
  final String? description;
  @override
  final String status;
  @override
  final String lifecycle;
  @override
  @JsonKey(name: 'display_order', defaultValue: 0)
  final int displayOrder;
  @override
  @JsonKey(name: 'created_at')
  final DateTime? createdAt;
  @override
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;
  @override
  @JsonKey(name: 'deleted_at')
  final DateTime? deletedAt;
  // 關聯資料
  final List<ReferenceModel>? _references;
  // 關聯資料
  @override
  List<ReferenceModel>? get references {
    final value = _references;
    if (value == null) return null;
    if (_references is EqualUnmodifiableListView) return _references;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(value);
  }

  @override
  @JsonKey(name: 'total_reference_count')
  final int? totalReferenceCount;
  final List<TaskModel>? _tasks;
  @override
  List<TaskModel>? get tasks {
    final value = _tasks;
    if (value == null) return null;
    if (_tasks is EqualUnmodifiableListView) return _tasks;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(value);
  }

  final List<TaskModel>? _recentTasks;
  @override
  @JsonKey(name: 'recent_tasks')
  List<TaskModel>? get recentTasks {
    final value = _recentTasks;
    if (value == null) return null;
    if (_recentTasks is EqualUnmodifiableListView) return _recentTasks;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(value);
  }

  @override
  String toString() {
    return 'ProductModel(id: $id, userId: $userId, areaId: $areaId, name: $name, description: $description, status: $status, lifecycle: $lifecycle, displayOrder: $displayOrder, createdAt: $createdAt, updatedAt: $updatedAt, deletedAt: $deletedAt, references: $references, totalReferenceCount: $totalReferenceCount, tasks: $tasks, recentTasks: $recentTasks)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ProductModelImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.userId, userId) || other.userId == userId) &&
            (identical(other.areaId, areaId) || other.areaId == areaId) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.description, description) ||
                other.description == description) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.lifecycle, lifecycle) ||
                other.lifecycle == lifecycle) &&
            (identical(other.displayOrder, displayOrder) ||
                other.displayOrder == displayOrder) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            (identical(other.deletedAt, deletedAt) ||
                other.deletedAt == deletedAt) &&
            const DeepCollectionEquality().equals(
              other._references,
              _references,
            ) &&
            (identical(other.totalReferenceCount, totalReferenceCount) ||
                other.totalReferenceCount == totalReferenceCount) &&
            const DeepCollectionEquality().equals(other._tasks, _tasks) &&
            const DeepCollectionEquality().equals(
              other._recentTasks,
              _recentTasks,
            ));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    id,
    userId,
    areaId,
    name,
    description,
    status,
    lifecycle,
    displayOrder,
    createdAt,
    updatedAt,
    deletedAt,
    const DeepCollectionEquality().hash(_references),
    totalReferenceCount,
    const DeepCollectionEquality().hash(_tasks),
    const DeepCollectionEquality().hash(_recentTasks),
  );

  /// Create a copy of ProductModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ProductModelImplCopyWith<_$ProductModelImpl> get copyWith =>
      __$$ProductModelImplCopyWithImpl<_$ProductModelImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ProductModelImplToJson(this);
  }
}

abstract class _ProductModel extends ProductModel {
  const factory _ProductModel({
    required final String id,
    @JsonKey(name: 'user_id') required final String userId,
    @JsonKey(name: 'area_id') required final String areaId,
    required final String name,
    final String? description,
    required final String status,
    required final String lifecycle,
    @JsonKey(name: 'display_order', defaultValue: 0)
    required final int displayOrder,
    @JsonKey(name: 'created_at') final DateTime? createdAt,
    @JsonKey(name: 'updated_at') final DateTime? updatedAt,
    @JsonKey(name: 'deleted_at') final DateTime? deletedAt,
    final List<ReferenceModel>? references,
    @JsonKey(name: 'total_reference_count') final int? totalReferenceCount,
    final List<TaskModel>? tasks,
    @JsonKey(name: 'recent_tasks') final List<TaskModel>? recentTasks,
  }) = _$ProductModelImpl;
  const _ProductModel._() : super._();

  factory _ProductModel.fromJson(Map<String, dynamic> json) =
      _$ProductModelImpl.fromJson;

  @override
  String get id;
  @override
  @JsonKey(name: 'user_id')
  String get userId;
  @override
  @JsonKey(name: 'area_id')
  String get areaId;
  @override
  String get name;
  @override
  String? get description;
  @override
  String get status;
  @override
  String get lifecycle;
  @override
  @JsonKey(name: 'display_order', defaultValue: 0)
  int get displayOrder;
  @override
  @JsonKey(name: 'created_at')
  DateTime? get createdAt;
  @override
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt;
  @override
  @JsonKey(name: 'deleted_at')
  DateTime? get deletedAt; // 關聯資料
  @override
  List<ReferenceModel>? get references;
  @override
  @JsonKey(name: 'total_reference_count')
  int? get totalReferenceCount;
  @override
  List<TaskModel>? get tasks;
  @override
  @JsonKey(name: 'recent_tasks')
  List<TaskModel>? get recentTasks;

  /// Create a copy of ProductModel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ProductModelImplCopyWith<_$ProductModelImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
