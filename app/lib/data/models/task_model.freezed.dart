// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'task_model.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

TaskModel _$TaskModelFromJson(Map<String, dynamic> json) {
  return _TaskModel.fromJson(json);
}

/// @nodoc
mixin _$TaskModel {
  String get id => throw _privateConstructorUsedError;
  @JsonKey(name: 'user_id')
  String get userId => throw _privateConstructorUsedError;
  @JsonKey(name: 'product_id')
  String? get productId => throw _privateConstructorUsedError;
  @JsonKey(name: 'topic_id')
  String? get topicId => throw _privateConstructorUsedError;
  String get content => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  @JsonKey(name: 'due_date')
  DateTime? get dueDate => throw _privateConstructorUsedError;
  @JsonKey(name: 'start_date')
  DateTime? get startDate => throw _privateConstructorUsedError;
  @JsonKey(name: 'time_confidence')
  double? get timeConfidence => throw _privateConstructorUsedError;
  @JsonKey(name: 'inferred_from_milestone')
  String? get inferredFromMilestone => throw _privateConstructorUsedError;
  @JsonKey(name: 'ai_analysis')
  Map<String, dynamic>? get aiAnalysis => throw _privateConstructorUsedError;
  @JsonKey(name: 'sub_items')
  List<SubItemModel>? get subItems => throw _privateConstructorUsedError;
  @JsonKey(name: 'tag')
  Map<String, dynamic>? get tag => throw _privateConstructorUsedError;
  @JsonKey(name: 'tags')
  List<String>? get tags => throw _privateConstructorUsedError;
  @JsonKey(name: 'created_at')
  DateTime? get createdAt => throw _privateConstructorUsedError;
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt => throw _privateConstructorUsedError;
  @JsonKey(name: 'deleted_at')
  DateTime? get deletedAt => throw _privateConstructorUsedError;

  /// Serializes this TaskModel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of TaskModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $TaskModelCopyWith<TaskModel> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $TaskModelCopyWith<$Res> {
  factory $TaskModelCopyWith(TaskModel value, $Res Function(TaskModel) then) =
      _$TaskModelCopyWithImpl<$Res, TaskModel>;
  @useResult
  $Res call({
    String id,
    @JsonKey(name: 'user_id') String userId,
    @JsonKey(name: 'product_id') String? productId,
    @JsonKey(name: 'topic_id') String? topicId,
    String content,
    String status,
    @JsonKey(name: 'due_date') DateTime? dueDate,
    @JsonKey(name: 'start_date') DateTime? startDate,
    @JsonKey(name: 'time_confidence') double? timeConfidence,
    @JsonKey(name: 'inferred_from_milestone') String? inferredFromMilestone,
    @JsonKey(name: 'ai_analysis') Map<String, dynamic>? aiAnalysis,
    @JsonKey(name: 'sub_items') List<SubItemModel>? subItems,
    @JsonKey(name: 'tag') Map<String, dynamic>? tag,
    @JsonKey(name: 'tags') List<String>? tags,
    @JsonKey(name: 'created_at') DateTime? createdAt,
    @JsonKey(name: 'updated_at') DateTime? updatedAt,
    @JsonKey(name: 'deleted_at') DateTime? deletedAt,
  });
}

/// @nodoc
class _$TaskModelCopyWithImpl<$Res, $Val extends TaskModel>
    implements $TaskModelCopyWith<$Res> {
  _$TaskModelCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of TaskModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? userId = null,
    Object? productId = freezed,
    Object? topicId = freezed,
    Object? content = null,
    Object? status = null,
    Object? dueDate = freezed,
    Object? startDate = freezed,
    Object? timeConfidence = freezed,
    Object? inferredFromMilestone = freezed,
    Object? aiAnalysis = freezed,
    Object? subItems = freezed,
    Object? tag = freezed,
    Object? tags = freezed,
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
            productId: freezed == productId
                ? _value.productId
                : productId // ignore: cast_nullable_to_non_nullable
                      as String?,
            topicId: freezed == topicId
                ? _value.topicId
                : topicId // ignore: cast_nullable_to_non_nullable
                      as String?,
            content: null == content
                ? _value.content
                : content // ignore: cast_nullable_to_non_nullable
                      as String,
            status: null == status
                ? _value.status
                : status // ignore: cast_nullable_to_non_nullable
                      as String,
            dueDate: freezed == dueDate
                ? _value.dueDate
                : dueDate // ignore: cast_nullable_to_non_nullable
                      as DateTime?,
            startDate: freezed == startDate
                ? _value.startDate
                : startDate // ignore: cast_nullable_to_non_nullable
                      as DateTime?,
            timeConfidence: freezed == timeConfidence
                ? _value.timeConfidence
                : timeConfidence // ignore: cast_nullable_to_non_nullable
                      as double?,
            inferredFromMilestone: freezed == inferredFromMilestone
                ? _value.inferredFromMilestone
                : inferredFromMilestone // ignore: cast_nullable_to_non_nullable
                      as String?,
            aiAnalysis: freezed == aiAnalysis
                ? _value.aiAnalysis
                : aiAnalysis // ignore: cast_nullable_to_non_nullable
                      as Map<String, dynamic>?,
            subItems: freezed == subItems
                ? _value.subItems
                : subItems // ignore: cast_nullable_to_non_nullable
                      as List<SubItemModel>?,
            tag: freezed == tag
                ? _value.tag
                : tag // ignore: cast_nullable_to_non_nullable
                      as Map<String, dynamic>?,
            tags: freezed == tags
                ? _value.tags
                : tags // ignore: cast_nullable_to_non_nullable
                      as List<String>?,
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
abstract class _$$TaskModelImplCopyWith<$Res>
    implements $TaskModelCopyWith<$Res> {
  factory _$$TaskModelImplCopyWith(
    _$TaskModelImpl value,
    $Res Function(_$TaskModelImpl) then,
  ) = __$$TaskModelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    @JsonKey(name: 'user_id') String userId,
    @JsonKey(name: 'product_id') String? productId,
    @JsonKey(name: 'topic_id') String? topicId,
    String content,
    String status,
    @JsonKey(name: 'due_date') DateTime? dueDate,
    @JsonKey(name: 'start_date') DateTime? startDate,
    @JsonKey(name: 'time_confidence') double? timeConfidence,
    @JsonKey(name: 'inferred_from_milestone') String? inferredFromMilestone,
    @JsonKey(name: 'ai_analysis') Map<String, dynamic>? aiAnalysis,
    @JsonKey(name: 'sub_items') List<SubItemModel>? subItems,
    @JsonKey(name: 'tag') Map<String, dynamic>? tag,
    @JsonKey(name: 'tags') List<String>? tags,
    @JsonKey(name: 'created_at') DateTime? createdAt,
    @JsonKey(name: 'updated_at') DateTime? updatedAt,
    @JsonKey(name: 'deleted_at') DateTime? deletedAt,
  });
}

/// @nodoc
class __$$TaskModelImplCopyWithImpl<$Res>
    extends _$TaskModelCopyWithImpl<$Res, _$TaskModelImpl>
    implements _$$TaskModelImplCopyWith<$Res> {
  __$$TaskModelImplCopyWithImpl(
    _$TaskModelImpl _value,
    $Res Function(_$TaskModelImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of TaskModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? userId = null,
    Object? productId = freezed,
    Object? topicId = freezed,
    Object? content = null,
    Object? status = null,
    Object? dueDate = freezed,
    Object? startDate = freezed,
    Object? timeConfidence = freezed,
    Object? inferredFromMilestone = freezed,
    Object? aiAnalysis = freezed,
    Object? subItems = freezed,
    Object? tag = freezed,
    Object? tags = freezed,
    Object? createdAt = freezed,
    Object? updatedAt = freezed,
    Object? deletedAt = freezed,
  }) {
    return _then(
      _$TaskModelImpl(
        id: null == id
            ? _value.id
            : id // ignore: cast_nullable_to_non_nullable
                  as String,
        userId: null == userId
            ? _value.userId
            : userId // ignore: cast_nullable_to_non_nullable
                  as String,
        productId: freezed == productId
            ? _value.productId
            : productId // ignore: cast_nullable_to_non_nullable
                  as String?,
        topicId: freezed == topicId
            ? _value.topicId
            : topicId // ignore: cast_nullable_to_non_nullable
                  as String?,
        content: null == content
            ? _value.content
            : content // ignore: cast_nullable_to_non_nullable
                  as String,
        status: null == status
            ? _value.status
            : status // ignore: cast_nullable_to_non_nullable
                  as String,
        dueDate: freezed == dueDate
            ? _value.dueDate
            : dueDate // ignore: cast_nullable_to_non_nullable
                  as DateTime?,
        startDate: freezed == startDate
            ? _value.startDate
            : startDate // ignore: cast_nullable_to_non_nullable
                  as DateTime?,
        timeConfidence: freezed == timeConfidence
            ? _value.timeConfidence
            : timeConfidence // ignore: cast_nullable_to_non_nullable
                  as double?,
        inferredFromMilestone: freezed == inferredFromMilestone
            ? _value.inferredFromMilestone
            : inferredFromMilestone // ignore: cast_nullable_to_non_nullable
                  as String?,
        aiAnalysis: freezed == aiAnalysis
            ? _value._aiAnalysis
            : aiAnalysis // ignore: cast_nullable_to_non_nullable
                  as Map<String, dynamic>?,
        subItems: freezed == subItems
            ? _value._subItems
            : subItems // ignore: cast_nullable_to_non_nullable
                  as List<SubItemModel>?,
        tag: freezed == tag
            ? _value._tag
            : tag // ignore: cast_nullable_to_non_nullable
                  as Map<String, dynamic>?,
        tags: freezed == tags
            ? _value._tags
            : tags // ignore: cast_nullable_to_non_nullable
                  as List<String>?,
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
class _$TaskModelImpl extends _TaskModel {
  const _$TaskModelImpl({
    required this.id,
    @JsonKey(name: 'user_id') required this.userId,
    @JsonKey(name: 'product_id') this.productId,
    @JsonKey(name: 'topic_id') this.topicId,
    required this.content,
    required this.status,
    @JsonKey(name: 'due_date') this.dueDate,
    @JsonKey(name: 'start_date') this.startDate,
    @JsonKey(name: 'time_confidence') this.timeConfidence,
    @JsonKey(name: 'inferred_from_milestone') this.inferredFromMilestone,
    @JsonKey(name: 'ai_analysis') final Map<String, dynamic>? aiAnalysis,
    @JsonKey(name: 'sub_items') final List<SubItemModel>? subItems,
    @JsonKey(name: 'tag') final Map<String, dynamic>? tag,
    @JsonKey(name: 'tags') final List<String>? tags,
    @JsonKey(name: 'created_at') this.createdAt,
    @JsonKey(name: 'updated_at') this.updatedAt,
    @JsonKey(name: 'deleted_at') this.deletedAt,
  }) : _aiAnalysis = aiAnalysis,
       _subItems = subItems,
       _tag = tag,
       _tags = tags,
       super._();

  factory _$TaskModelImpl.fromJson(Map<String, dynamic> json) =>
      _$$TaskModelImplFromJson(json);

  @override
  final String id;
  @override
  @JsonKey(name: 'user_id')
  final String userId;
  @override
  @JsonKey(name: 'product_id')
  final String? productId;
  @override
  @JsonKey(name: 'topic_id')
  final String? topicId;
  @override
  final String content;
  @override
  final String status;
  @override
  @JsonKey(name: 'due_date')
  final DateTime? dueDate;
  @override
  @JsonKey(name: 'start_date')
  final DateTime? startDate;
  @override
  @JsonKey(name: 'time_confidence')
  final double? timeConfidence;
  @override
  @JsonKey(name: 'inferred_from_milestone')
  final String? inferredFromMilestone;
  final Map<String, dynamic>? _aiAnalysis;
  @override
  @JsonKey(name: 'ai_analysis')
  Map<String, dynamic>? get aiAnalysis {
    final value = _aiAnalysis;
    if (value == null) return null;
    if (_aiAnalysis is EqualUnmodifiableMapView) return _aiAnalysis;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(value);
  }

  final List<SubItemModel>? _subItems;
  @override
  @JsonKey(name: 'sub_items')
  List<SubItemModel>? get subItems {
    final value = _subItems;
    if (value == null) return null;
    if (_subItems is EqualUnmodifiableListView) return _subItems;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(value);
  }

  final Map<String, dynamic>? _tag;
  @override
  @JsonKey(name: 'tag')
  Map<String, dynamic>? get tag {
    final value = _tag;
    if (value == null) return null;
    if (_tag is EqualUnmodifiableMapView) return _tag;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(value);
  }

  final List<String>? _tags;
  @override
  @JsonKey(name: 'tags')
  List<String>? get tags {
    final value = _tags;
    if (value == null) return null;
    if (_tags is EqualUnmodifiableListView) return _tags;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(value);
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
    return 'TaskModel(id: $id, userId: $userId, productId: $productId, topicId: $topicId, content: $content, status: $status, dueDate: $dueDate, startDate: $startDate, timeConfidence: $timeConfidence, inferredFromMilestone: $inferredFromMilestone, aiAnalysis: $aiAnalysis, subItems: $subItems, tag: $tag, tags: $tags, createdAt: $createdAt, updatedAt: $updatedAt, deletedAt: $deletedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$TaskModelImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.userId, userId) || other.userId == userId) &&
            (identical(other.productId, productId) ||
                other.productId == productId) &&
            (identical(other.topicId, topicId) || other.topicId == topicId) &&
            (identical(other.content, content) || other.content == content) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.dueDate, dueDate) || other.dueDate == dueDate) &&
            (identical(other.startDate, startDate) ||
                other.startDate == startDate) &&
            (identical(other.timeConfidence, timeConfidence) ||
                other.timeConfidence == timeConfidence) &&
            (identical(other.inferredFromMilestone, inferredFromMilestone) ||
                other.inferredFromMilestone == inferredFromMilestone) &&
            const DeepCollectionEquality().equals(
              other._aiAnalysis,
              _aiAnalysis,
            ) &&
            const DeepCollectionEquality().equals(other._subItems, _subItems) &&
            const DeepCollectionEquality().equals(other._tag, _tag) &&
            const DeepCollectionEquality().equals(other._tags, _tags) &&
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
    productId,
    topicId,
    content,
    status,
    dueDate,
    startDate,
    timeConfidence,
    inferredFromMilestone,
    const DeepCollectionEquality().hash(_aiAnalysis),
    const DeepCollectionEquality().hash(_subItems),
    const DeepCollectionEquality().hash(_tag),
    const DeepCollectionEquality().hash(_tags),
    createdAt,
    updatedAt,
    deletedAt,
  );

  /// Create a copy of TaskModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$TaskModelImplCopyWith<_$TaskModelImpl> get copyWith =>
      __$$TaskModelImplCopyWithImpl<_$TaskModelImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$TaskModelImplToJson(this);
  }
}

abstract class _TaskModel extends TaskModel {
  const factory _TaskModel({
    required final String id,
    @JsonKey(name: 'user_id') required final String userId,
    @JsonKey(name: 'product_id') final String? productId,
    @JsonKey(name: 'topic_id') final String? topicId,
    required final String content,
    required final String status,
    @JsonKey(name: 'due_date') final DateTime? dueDate,
    @JsonKey(name: 'start_date') final DateTime? startDate,
    @JsonKey(name: 'time_confidence') final double? timeConfidence,
    @JsonKey(name: 'inferred_from_milestone')
    final String? inferredFromMilestone,
    @JsonKey(name: 'ai_analysis') final Map<String, dynamic>? aiAnalysis,
    @JsonKey(name: 'sub_items') final List<SubItemModel>? subItems,
    @JsonKey(name: 'tag') final Map<String, dynamic>? tag,
    @JsonKey(name: 'tags') final List<String>? tags,
    @JsonKey(name: 'created_at') final DateTime? createdAt,
    @JsonKey(name: 'updated_at') final DateTime? updatedAt,
    @JsonKey(name: 'deleted_at') final DateTime? deletedAt,
  }) = _$TaskModelImpl;
  const _TaskModel._() : super._();

  factory _TaskModel.fromJson(Map<String, dynamic> json) =
      _$TaskModelImpl.fromJson;

  @override
  String get id;
  @override
  @JsonKey(name: 'user_id')
  String get userId;
  @override
  @JsonKey(name: 'product_id')
  String? get productId;
  @override
  @JsonKey(name: 'topic_id')
  String? get topicId;
  @override
  String get content;
  @override
  String get status;
  @override
  @JsonKey(name: 'due_date')
  DateTime? get dueDate;
  @override
  @JsonKey(name: 'start_date')
  DateTime? get startDate;
  @override
  @JsonKey(name: 'time_confidence')
  double? get timeConfidence;
  @override
  @JsonKey(name: 'inferred_from_milestone')
  String? get inferredFromMilestone;
  @override
  @JsonKey(name: 'ai_analysis')
  Map<String, dynamic>? get aiAnalysis;
  @override
  @JsonKey(name: 'sub_items')
  List<SubItemModel>? get subItems;
  @override
  @JsonKey(name: 'tag')
  Map<String, dynamic>? get tag;
  @override
  @JsonKey(name: 'tags')
  List<String>? get tags;
  @override
  @JsonKey(name: 'created_at')
  DateTime? get createdAt;
  @override
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt;
  @override
  @JsonKey(name: 'deleted_at')
  DateTime? get deletedAt;

  /// Create a copy of TaskModel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$TaskModelImplCopyWith<_$TaskModelImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

SubItemModel _$SubItemModelFromJson(Map<String, dynamic> json) {
  return _SubItemModel.fromJson(json);
}

/// @nodoc
mixin _$SubItemModel {
  String get id => throw _privateConstructorUsedError;
  String get content => throw _privateConstructorUsedError;
  bool get completed => throw _privateConstructorUsedError;
  @JsonKey(name: 'completed_at')
  DateTime? get completedAt => throw _privateConstructorUsedError;

  /// Serializes this SubItemModel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SubItemModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SubItemModelCopyWith<SubItemModel> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SubItemModelCopyWith<$Res> {
  factory $SubItemModelCopyWith(
    SubItemModel value,
    $Res Function(SubItemModel) then,
  ) = _$SubItemModelCopyWithImpl<$Res, SubItemModel>;
  @useResult
  $Res call({
    String id,
    String content,
    bool completed,
    @JsonKey(name: 'completed_at') DateTime? completedAt,
  });
}

/// @nodoc
class _$SubItemModelCopyWithImpl<$Res, $Val extends SubItemModel>
    implements $SubItemModelCopyWith<$Res> {
  _$SubItemModelCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SubItemModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? content = null,
    Object? completed = null,
    Object? completedAt = freezed,
  }) {
    return _then(
      _value.copyWith(
            id: null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                      as String,
            content: null == content
                ? _value.content
                : content // ignore: cast_nullable_to_non_nullable
                      as String,
            completed: null == completed
                ? _value.completed
                : completed // ignore: cast_nullable_to_non_nullable
                      as bool,
            completedAt: freezed == completedAt
                ? _value.completedAt
                : completedAt // ignore: cast_nullable_to_non_nullable
                      as DateTime?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$SubItemModelImplCopyWith<$Res>
    implements $SubItemModelCopyWith<$Res> {
  factory _$$SubItemModelImplCopyWith(
    _$SubItemModelImpl value,
    $Res Function(_$SubItemModelImpl) then,
  ) = __$$SubItemModelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String content,
    bool completed,
    @JsonKey(name: 'completed_at') DateTime? completedAt,
  });
}

/// @nodoc
class __$$SubItemModelImplCopyWithImpl<$Res>
    extends _$SubItemModelCopyWithImpl<$Res, _$SubItemModelImpl>
    implements _$$SubItemModelImplCopyWith<$Res> {
  __$$SubItemModelImplCopyWithImpl(
    _$SubItemModelImpl _value,
    $Res Function(_$SubItemModelImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of SubItemModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? content = null,
    Object? completed = null,
    Object? completedAt = freezed,
  }) {
    return _then(
      _$SubItemModelImpl(
        id: null == id
            ? _value.id
            : id // ignore: cast_nullable_to_non_nullable
                  as String,
        content: null == content
            ? _value.content
            : content // ignore: cast_nullable_to_non_nullable
                  as String,
        completed: null == completed
            ? _value.completed
            : completed // ignore: cast_nullable_to_non_nullable
                  as bool,
        completedAt: freezed == completedAt
            ? _value.completedAt
            : completedAt // ignore: cast_nullable_to_non_nullable
                  as DateTime?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$SubItemModelImpl extends _SubItemModel {
  const _$SubItemModelImpl({
    required this.id,
    required this.content,
    required this.completed,
    @JsonKey(name: 'completed_at') this.completedAt,
  }) : super._();

  factory _$SubItemModelImpl.fromJson(Map<String, dynamic> json) =>
      _$$SubItemModelImplFromJson(json);

  @override
  final String id;
  @override
  final String content;
  @override
  final bool completed;
  @override
  @JsonKey(name: 'completed_at')
  final DateTime? completedAt;

  @override
  String toString() {
    return 'SubItemModel(id: $id, content: $content, completed: $completed, completedAt: $completedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SubItemModelImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.content, content) || other.content == content) &&
            (identical(other.completed, completed) ||
                other.completed == completed) &&
            (identical(other.completedAt, completedAt) ||
                other.completedAt == completedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, id, content, completed, completedAt);

  /// Create a copy of SubItemModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SubItemModelImplCopyWith<_$SubItemModelImpl> get copyWith =>
      __$$SubItemModelImplCopyWithImpl<_$SubItemModelImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SubItemModelImplToJson(this);
  }
}

abstract class _SubItemModel extends SubItemModel {
  const factory _SubItemModel({
    required final String id,
    required final String content,
    required final bool completed,
    @JsonKey(name: 'completed_at') final DateTime? completedAt,
  }) = _$SubItemModelImpl;
  const _SubItemModel._() : super._();

  factory _SubItemModel.fromJson(Map<String, dynamic> json) =
      _$SubItemModelImpl.fromJson;

  @override
  String get id;
  @override
  String get content;
  @override
  bool get completed;
  @override
  @JsonKey(name: 'completed_at')
  DateTime? get completedAt;

  /// Create a copy of SubItemModel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SubItemModelImplCopyWith<_$SubItemModelImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
