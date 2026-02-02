// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'brain_dump_models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

BrainDumpRequest _$BrainDumpRequestFromJson(Map<String, dynamic> json) {
  return _BrainDumpRequest.fromJson(json);
}

/// @nodoc
mixin _$BrainDumpRequest {
  String get text => throw _privateConstructorUsedError;

  /// Serializes this BrainDumpRequest to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of BrainDumpRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $BrainDumpRequestCopyWith<BrainDumpRequest> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $BrainDumpRequestCopyWith<$Res> {
  factory $BrainDumpRequestCopyWith(
    BrainDumpRequest value,
    $Res Function(BrainDumpRequest) then,
  ) = _$BrainDumpRequestCopyWithImpl<$Res, BrainDumpRequest>;
  @useResult
  $Res call({String text});
}

/// @nodoc
class _$BrainDumpRequestCopyWithImpl<$Res, $Val extends BrainDumpRequest>
    implements $BrainDumpRequestCopyWith<$Res> {
  _$BrainDumpRequestCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of BrainDumpRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? text = null}) {
    return _then(
      _value.copyWith(
            text: null == text
                ? _value.text
                : text // ignore: cast_nullable_to_non_nullable
                      as String,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$BrainDumpRequestImplCopyWith<$Res>
    implements $BrainDumpRequestCopyWith<$Res> {
  factory _$$BrainDumpRequestImplCopyWith(
    _$BrainDumpRequestImpl value,
    $Res Function(_$BrainDumpRequestImpl) then,
  ) = __$$BrainDumpRequestImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String text});
}

/// @nodoc
class __$$BrainDumpRequestImplCopyWithImpl<$Res>
    extends _$BrainDumpRequestCopyWithImpl<$Res, _$BrainDumpRequestImpl>
    implements _$$BrainDumpRequestImplCopyWith<$Res> {
  __$$BrainDumpRequestImplCopyWithImpl(
    _$BrainDumpRequestImpl _value,
    $Res Function(_$BrainDumpRequestImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of BrainDumpRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? text = null}) {
    return _then(
      _$BrainDumpRequestImpl(
        text: null == text
            ? _value.text
            : text // ignore: cast_nullable_to_non_nullable
                  as String,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$BrainDumpRequestImpl implements _BrainDumpRequest {
  const _$BrainDumpRequestImpl({required this.text});

  factory _$BrainDumpRequestImpl.fromJson(Map<String, dynamic> json) =>
      _$$BrainDumpRequestImplFromJson(json);

  @override
  final String text;

  @override
  String toString() {
    return 'BrainDumpRequest(text: $text)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$BrainDumpRequestImpl &&
            (identical(other.text, text) || other.text == text));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, text);

  /// Create a copy of BrainDumpRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$BrainDumpRequestImplCopyWith<_$BrainDumpRequestImpl> get copyWith =>
      __$$BrainDumpRequestImplCopyWithImpl<_$BrainDumpRequestImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$BrainDumpRequestImplToJson(this);
  }
}

abstract class _BrainDumpRequest implements BrainDumpRequest {
  const factory _BrainDumpRequest({required final String text}) =
      _$BrainDumpRequestImpl;

  factory _BrainDumpRequest.fromJson(Map<String, dynamic> json) =
      _$BrainDumpRequestImpl.fromJson;

  @override
  String get text;

  /// Create a copy of BrainDumpRequest
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$BrainDumpRequestImplCopyWith<_$BrainDumpRequestImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
mixin _$BrainDumpResponse {
  bool get success => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(bool success, List<BrainDumpItem> items)
    createNewTasks,
    required TResult Function(
      bool success,
      @JsonKey(name: 'target_task') BrainDumpTargetTask targetTask,
      @JsonKey(name: 'appended_sub_items')
      List<BrainDumpAppendedSubItem> appendedSubItems,
      String reasoning,
    )
    appendSubItem,
  }) => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(bool success, List<BrainDumpItem> items)? createNewTasks,
    TResult? Function(
      bool success,
      @JsonKey(name: 'target_task') BrainDumpTargetTask targetTask,
      @JsonKey(name: 'appended_sub_items')
      List<BrainDumpAppendedSubItem> appendedSubItems,
      String reasoning,
    )?
    appendSubItem,
  }) => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(bool success, List<BrainDumpItem> items)? createNewTasks,
    TResult Function(
      bool success,
      @JsonKey(name: 'target_task') BrainDumpTargetTask targetTask,
      @JsonKey(name: 'appended_sub_items')
      List<BrainDumpAppendedSubItem> appendedSubItems,
      String reasoning,
    )?
    appendSubItem,
    required TResult orElse(),
  }) => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(BrainDumpCreateNewTasksResponse value)
    createNewTasks,
    required TResult Function(BrainDumpAppendSubItemResponse value)
    appendSubItem,
  }) => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(BrainDumpCreateNewTasksResponse value)? createNewTasks,
    TResult? Function(BrainDumpAppendSubItemResponse value)? appendSubItem,
  }) => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(BrainDumpCreateNewTasksResponse value)? createNewTasks,
    TResult Function(BrainDumpAppendSubItemResponse value)? appendSubItem,
    required TResult orElse(),
  }) => throw _privateConstructorUsedError;

  /// Create a copy of BrainDumpResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $BrainDumpResponseCopyWith<BrainDumpResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $BrainDumpResponseCopyWith<$Res> {
  factory $BrainDumpResponseCopyWith(
    BrainDumpResponse value,
    $Res Function(BrainDumpResponse) then,
  ) = _$BrainDumpResponseCopyWithImpl<$Res, BrainDumpResponse>;
  @useResult
  $Res call({bool success});
}

/// @nodoc
class _$BrainDumpResponseCopyWithImpl<$Res, $Val extends BrainDumpResponse>
    implements $BrainDumpResponseCopyWith<$Res> {
  _$BrainDumpResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of BrainDumpResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? success = null}) {
    return _then(
      _value.copyWith(
            success: null == success
                ? _value.success
                : success // ignore: cast_nullable_to_non_nullable
                      as bool,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$BrainDumpCreateNewTasksResponseImplCopyWith<$Res>
    implements $BrainDumpResponseCopyWith<$Res> {
  factory _$$BrainDumpCreateNewTasksResponseImplCopyWith(
    _$BrainDumpCreateNewTasksResponseImpl value,
    $Res Function(_$BrainDumpCreateNewTasksResponseImpl) then,
  ) = __$$BrainDumpCreateNewTasksResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({bool success, List<BrainDumpItem> items});
}

/// @nodoc
class __$$BrainDumpCreateNewTasksResponseImplCopyWithImpl<$Res>
    extends
        _$BrainDumpResponseCopyWithImpl<
          $Res,
          _$BrainDumpCreateNewTasksResponseImpl
        >
    implements _$$BrainDumpCreateNewTasksResponseImplCopyWith<$Res> {
  __$$BrainDumpCreateNewTasksResponseImplCopyWithImpl(
    _$BrainDumpCreateNewTasksResponseImpl _value,
    $Res Function(_$BrainDumpCreateNewTasksResponseImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of BrainDumpResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? success = null, Object? items = null}) {
    return _then(
      _$BrainDumpCreateNewTasksResponseImpl(
        success: null == success
            ? _value.success
            : success // ignore: cast_nullable_to_non_nullable
                  as bool,
        items: null == items
            ? _value._items
            : items // ignore: cast_nullable_to_non_nullable
                  as List<BrainDumpItem>,
      ),
    );
  }
}

/// @nodoc

class _$BrainDumpCreateNewTasksResponseImpl
    implements BrainDumpCreateNewTasksResponse {
  const _$BrainDumpCreateNewTasksResponseImpl({
    required this.success,
    required final List<BrainDumpItem> items,
  }) : _items = items;

  @override
  final bool success;
  final List<BrainDumpItem> _items;
  @override
  List<BrainDumpItem> get items {
    if (_items is EqualUnmodifiableListView) return _items;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_items);
  }

  @override
  String toString() {
    return 'BrainDumpResponse.createNewTasks(success: $success, items: $items)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$BrainDumpCreateNewTasksResponseImpl &&
            (identical(other.success, success) || other.success == success) &&
            const DeepCollectionEquality().equals(other._items, _items));
  }

  @override
  int get hashCode => Object.hash(
    runtimeType,
    success,
    const DeepCollectionEquality().hash(_items),
  );

  /// Create a copy of BrainDumpResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$BrainDumpCreateNewTasksResponseImplCopyWith<
    _$BrainDumpCreateNewTasksResponseImpl
  >
  get copyWith =>
      __$$BrainDumpCreateNewTasksResponseImplCopyWithImpl<
        _$BrainDumpCreateNewTasksResponseImpl
      >(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(bool success, List<BrainDumpItem> items)
    createNewTasks,
    required TResult Function(
      bool success,
      @JsonKey(name: 'target_task') BrainDumpTargetTask targetTask,
      @JsonKey(name: 'appended_sub_items')
      List<BrainDumpAppendedSubItem> appendedSubItems,
      String reasoning,
    )
    appendSubItem,
  }) {
    return createNewTasks(success, items);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(bool success, List<BrainDumpItem> items)? createNewTasks,
    TResult? Function(
      bool success,
      @JsonKey(name: 'target_task') BrainDumpTargetTask targetTask,
      @JsonKey(name: 'appended_sub_items')
      List<BrainDumpAppendedSubItem> appendedSubItems,
      String reasoning,
    )?
    appendSubItem,
  }) {
    return createNewTasks?.call(success, items);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(bool success, List<BrainDumpItem> items)? createNewTasks,
    TResult Function(
      bool success,
      @JsonKey(name: 'target_task') BrainDumpTargetTask targetTask,
      @JsonKey(name: 'appended_sub_items')
      List<BrainDumpAppendedSubItem> appendedSubItems,
      String reasoning,
    )?
    appendSubItem,
    required TResult orElse(),
  }) {
    if (createNewTasks != null) {
      return createNewTasks(success, items);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(BrainDumpCreateNewTasksResponse value)
    createNewTasks,
    required TResult Function(BrainDumpAppendSubItemResponse value)
    appendSubItem,
  }) {
    return createNewTasks(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(BrainDumpCreateNewTasksResponse value)? createNewTasks,
    TResult? Function(BrainDumpAppendSubItemResponse value)? appendSubItem,
  }) {
    return createNewTasks?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(BrainDumpCreateNewTasksResponse value)? createNewTasks,
    TResult Function(BrainDumpAppendSubItemResponse value)? appendSubItem,
    required TResult orElse(),
  }) {
    if (createNewTasks != null) {
      return createNewTasks(this);
    }
    return orElse();
  }
}

abstract class BrainDumpCreateNewTasksResponse implements BrainDumpResponse {
  const factory BrainDumpCreateNewTasksResponse({
    required final bool success,
    required final List<BrainDumpItem> items,
  }) = _$BrainDumpCreateNewTasksResponseImpl;

  @override
  bool get success;
  List<BrainDumpItem> get items;

  /// Create a copy of BrainDumpResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$BrainDumpCreateNewTasksResponseImplCopyWith<
    _$BrainDumpCreateNewTasksResponseImpl
  >
  get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$BrainDumpAppendSubItemResponseImplCopyWith<$Res>
    implements $BrainDumpResponseCopyWith<$Res> {
  factory _$$BrainDumpAppendSubItemResponseImplCopyWith(
    _$BrainDumpAppendSubItemResponseImpl value,
    $Res Function(_$BrainDumpAppendSubItemResponseImpl) then,
  ) = __$$BrainDumpAppendSubItemResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    bool success,
    @JsonKey(name: 'target_task') BrainDumpTargetTask targetTask,
    @JsonKey(name: 'appended_sub_items')
    List<BrainDumpAppendedSubItem> appendedSubItems,
    String reasoning,
  });

  $BrainDumpTargetTaskCopyWith<$Res> get targetTask;
}

/// @nodoc
class __$$BrainDumpAppendSubItemResponseImplCopyWithImpl<$Res>
    extends
        _$BrainDumpResponseCopyWithImpl<
          $Res,
          _$BrainDumpAppendSubItemResponseImpl
        >
    implements _$$BrainDumpAppendSubItemResponseImplCopyWith<$Res> {
  __$$BrainDumpAppendSubItemResponseImplCopyWithImpl(
    _$BrainDumpAppendSubItemResponseImpl _value,
    $Res Function(_$BrainDumpAppendSubItemResponseImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of BrainDumpResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? success = null,
    Object? targetTask = null,
    Object? appendedSubItems = null,
    Object? reasoning = null,
  }) {
    return _then(
      _$BrainDumpAppendSubItemResponseImpl(
        success: null == success
            ? _value.success
            : success // ignore: cast_nullable_to_non_nullable
                  as bool,
        targetTask: null == targetTask
            ? _value.targetTask
            : targetTask // ignore: cast_nullable_to_non_nullable
                  as BrainDumpTargetTask,
        appendedSubItems: null == appendedSubItems
            ? _value._appendedSubItems
            : appendedSubItems // ignore: cast_nullable_to_non_nullable
                  as List<BrainDumpAppendedSubItem>,
        reasoning: null == reasoning
            ? _value.reasoning
            : reasoning // ignore: cast_nullable_to_non_nullable
                  as String,
      ),
    );
  }

  /// Create a copy of BrainDumpResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $BrainDumpTargetTaskCopyWith<$Res> get targetTask {
    return $BrainDumpTargetTaskCopyWith<$Res>(_value.targetTask, (value) {
      return _then(_value.copyWith(targetTask: value));
    });
  }
}

/// @nodoc

class _$BrainDumpAppendSubItemResponseImpl
    implements BrainDumpAppendSubItemResponse {
  const _$BrainDumpAppendSubItemResponseImpl({
    required this.success,
    @JsonKey(name: 'target_task') required this.targetTask,
    @JsonKey(name: 'appended_sub_items')
    required final List<BrainDumpAppendedSubItem> appendedSubItems,
    required this.reasoning,
  }) : _appendedSubItems = appendedSubItems;

  @override
  final bool success;
  @override
  @JsonKey(name: 'target_task')
  final BrainDumpTargetTask targetTask;
  final List<BrainDumpAppendedSubItem> _appendedSubItems;
  @override
  @JsonKey(name: 'appended_sub_items')
  List<BrainDumpAppendedSubItem> get appendedSubItems {
    if (_appendedSubItems is EqualUnmodifiableListView)
      return _appendedSubItems;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_appendedSubItems);
  }

  @override
  final String reasoning;

  @override
  String toString() {
    return 'BrainDumpResponse.appendSubItem(success: $success, targetTask: $targetTask, appendedSubItems: $appendedSubItems, reasoning: $reasoning)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$BrainDumpAppendSubItemResponseImpl &&
            (identical(other.success, success) || other.success == success) &&
            (identical(other.targetTask, targetTask) ||
                other.targetTask == targetTask) &&
            const DeepCollectionEquality().equals(
              other._appendedSubItems,
              _appendedSubItems,
            ) &&
            (identical(other.reasoning, reasoning) ||
                other.reasoning == reasoning));
  }

  @override
  int get hashCode => Object.hash(
    runtimeType,
    success,
    targetTask,
    const DeepCollectionEquality().hash(_appendedSubItems),
    reasoning,
  );

  /// Create a copy of BrainDumpResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$BrainDumpAppendSubItemResponseImplCopyWith<
    _$BrainDumpAppendSubItemResponseImpl
  >
  get copyWith =>
      __$$BrainDumpAppendSubItemResponseImplCopyWithImpl<
        _$BrainDumpAppendSubItemResponseImpl
      >(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(bool success, List<BrainDumpItem> items)
    createNewTasks,
    required TResult Function(
      bool success,
      @JsonKey(name: 'target_task') BrainDumpTargetTask targetTask,
      @JsonKey(name: 'appended_sub_items')
      List<BrainDumpAppendedSubItem> appendedSubItems,
      String reasoning,
    )
    appendSubItem,
  }) {
    return appendSubItem(success, targetTask, appendedSubItems, reasoning);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(bool success, List<BrainDumpItem> items)? createNewTasks,
    TResult? Function(
      bool success,
      @JsonKey(name: 'target_task') BrainDumpTargetTask targetTask,
      @JsonKey(name: 'appended_sub_items')
      List<BrainDumpAppendedSubItem> appendedSubItems,
      String reasoning,
    )?
    appendSubItem,
  }) {
    return appendSubItem?.call(
      success,
      targetTask,
      appendedSubItems,
      reasoning,
    );
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(bool success, List<BrainDumpItem> items)? createNewTasks,
    TResult Function(
      bool success,
      @JsonKey(name: 'target_task') BrainDumpTargetTask targetTask,
      @JsonKey(name: 'appended_sub_items')
      List<BrainDumpAppendedSubItem> appendedSubItems,
      String reasoning,
    )?
    appendSubItem,
    required TResult orElse(),
  }) {
    if (appendSubItem != null) {
      return appendSubItem(success, targetTask, appendedSubItems, reasoning);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(BrainDumpCreateNewTasksResponse value)
    createNewTasks,
    required TResult Function(BrainDumpAppendSubItemResponse value)
    appendSubItem,
  }) {
    return appendSubItem(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(BrainDumpCreateNewTasksResponse value)? createNewTasks,
    TResult? Function(BrainDumpAppendSubItemResponse value)? appendSubItem,
  }) {
    return appendSubItem?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(BrainDumpCreateNewTasksResponse value)? createNewTasks,
    TResult Function(BrainDumpAppendSubItemResponse value)? appendSubItem,
    required TResult orElse(),
  }) {
    if (appendSubItem != null) {
      return appendSubItem(this);
    }
    return orElse();
  }
}

abstract class BrainDumpAppendSubItemResponse implements BrainDumpResponse {
  const factory BrainDumpAppendSubItemResponse({
    required final bool success,
    @JsonKey(name: 'target_task') required final BrainDumpTargetTask targetTask,
    @JsonKey(name: 'appended_sub_items')
    required final List<BrainDumpAppendedSubItem> appendedSubItems,
    required final String reasoning,
  }) = _$BrainDumpAppendSubItemResponseImpl;

  @override
  bool get success;
  @JsonKey(name: 'target_task')
  BrainDumpTargetTask get targetTask;
  @JsonKey(name: 'appended_sub_items')
  List<BrainDumpAppendedSubItem> get appendedSubItems;
  String get reasoning;

  /// Create a copy of BrainDumpResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$BrainDumpAppendSubItemResponseImplCopyWith<
    _$BrainDumpAppendSubItemResponseImpl
  >
  get copyWith => throw _privateConstructorUsedError;
}

BrainDumpTargetTask _$BrainDumpTargetTaskFromJson(Map<String, dynamic> json) {
  return _BrainDumpTargetTask.fromJson(json);
}

/// @nodoc
mixin _$BrainDumpTargetTask {
  String get id => throw _privateConstructorUsedError;
  String get content => throw _privateConstructorUsedError;
  String get product => throw _privateConstructorUsedError;

  /// Serializes this BrainDumpTargetTask to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of BrainDumpTargetTask
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $BrainDumpTargetTaskCopyWith<BrainDumpTargetTask> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $BrainDumpTargetTaskCopyWith<$Res> {
  factory $BrainDumpTargetTaskCopyWith(
    BrainDumpTargetTask value,
    $Res Function(BrainDumpTargetTask) then,
  ) = _$BrainDumpTargetTaskCopyWithImpl<$Res, BrainDumpTargetTask>;
  @useResult
  $Res call({String id, String content, String product});
}

/// @nodoc
class _$BrainDumpTargetTaskCopyWithImpl<$Res, $Val extends BrainDumpTargetTask>
    implements $BrainDumpTargetTaskCopyWith<$Res> {
  _$BrainDumpTargetTaskCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of BrainDumpTargetTask
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? content = null,
    Object? product = null,
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
            product: null == product
                ? _value.product
                : product // ignore: cast_nullable_to_non_nullable
                      as String,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$BrainDumpTargetTaskImplCopyWith<$Res>
    implements $BrainDumpTargetTaskCopyWith<$Res> {
  factory _$$BrainDumpTargetTaskImplCopyWith(
    _$BrainDumpTargetTaskImpl value,
    $Res Function(_$BrainDumpTargetTaskImpl) then,
  ) = __$$BrainDumpTargetTaskImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String id, String content, String product});
}

/// @nodoc
class __$$BrainDumpTargetTaskImplCopyWithImpl<$Res>
    extends _$BrainDumpTargetTaskCopyWithImpl<$Res, _$BrainDumpTargetTaskImpl>
    implements _$$BrainDumpTargetTaskImplCopyWith<$Res> {
  __$$BrainDumpTargetTaskImplCopyWithImpl(
    _$BrainDumpTargetTaskImpl _value,
    $Res Function(_$BrainDumpTargetTaskImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of BrainDumpTargetTask
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? content = null,
    Object? product = null,
  }) {
    return _then(
      _$BrainDumpTargetTaskImpl(
        id: null == id
            ? _value.id
            : id // ignore: cast_nullable_to_non_nullable
                  as String,
        content: null == content
            ? _value.content
            : content // ignore: cast_nullable_to_non_nullable
                  as String,
        product: null == product
            ? _value.product
            : product // ignore: cast_nullable_to_non_nullable
                  as String,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$BrainDumpTargetTaskImpl implements _BrainDumpTargetTask {
  const _$BrainDumpTargetTaskImpl({
    required this.id,
    required this.content,
    required this.product,
  });

  factory _$BrainDumpTargetTaskImpl.fromJson(Map<String, dynamic> json) =>
      _$$BrainDumpTargetTaskImplFromJson(json);

  @override
  final String id;
  @override
  final String content;
  @override
  final String product;

  @override
  String toString() {
    return 'BrainDumpTargetTask(id: $id, content: $content, product: $product)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$BrainDumpTargetTaskImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.content, content) || other.content == content) &&
            (identical(other.product, product) || other.product == product));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, content, product);

  /// Create a copy of BrainDumpTargetTask
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$BrainDumpTargetTaskImplCopyWith<_$BrainDumpTargetTaskImpl> get copyWith =>
      __$$BrainDumpTargetTaskImplCopyWithImpl<_$BrainDumpTargetTaskImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$BrainDumpTargetTaskImplToJson(this);
  }
}

abstract class _BrainDumpTargetTask implements BrainDumpTargetTask {
  const factory _BrainDumpTargetTask({
    required final String id,
    required final String content,
    required final String product,
  }) = _$BrainDumpTargetTaskImpl;

  factory _BrainDumpTargetTask.fromJson(Map<String, dynamic> json) =
      _$BrainDumpTargetTaskImpl.fromJson;

  @override
  String get id;
  @override
  String get content;
  @override
  String get product;

  /// Create a copy of BrainDumpTargetTask
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$BrainDumpTargetTaskImplCopyWith<_$BrainDumpTargetTaskImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

BrainDumpAppendedSubItem _$BrainDumpAppendedSubItemFromJson(
  Map<String, dynamic> json,
) {
  return _BrainDumpAppendedSubItem.fromJson(json);
}

/// @nodoc
mixin _$BrainDumpAppendedSubItem {
  String get id => throw _privateConstructorUsedError;
  String get content => throw _privateConstructorUsedError;
  bool get completed => throw _privateConstructorUsedError;
  @JsonKey(name: 'created_at')
  String get createdAt => throw _privateConstructorUsedError;
  @JsonKey(name: 'completed_at')
  String? get completedAt => throw _privateConstructorUsedError;
  int get order => throw _privateConstructorUsedError;

  /// Serializes this BrainDumpAppendedSubItem to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of BrainDumpAppendedSubItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $BrainDumpAppendedSubItemCopyWith<BrainDumpAppendedSubItem> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $BrainDumpAppendedSubItemCopyWith<$Res> {
  factory $BrainDumpAppendedSubItemCopyWith(
    BrainDumpAppendedSubItem value,
    $Res Function(BrainDumpAppendedSubItem) then,
  ) = _$BrainDumpAppendedSubItemCopyWithImpl<$Res, BrainDumpAppendedSubItem>;
  @useResult
  $Res call({
    String id,
    String content,
    bool completed,
    @JsonKey(name: 'created_at') String createdAt,
    @JsonKey(name: 'completed_at') String? completedAt,
    int order,
  });
}

/// @nodoc
class _$BrainDumpAppendedSubItemCopyWithImpl<
  $Res,
  $Val extends BrainDumpAppendedSubItem
>
    implements $BrainDumpAppendedSubItemCopyWith<$Res> {
  _$BrainDumpAppendedSubItemCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of BrainDumpAppendedSubItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? content = null,
    Object? completed = null,
    Object? createdAt = null,
    Object? completedAt = freezed,
    Object? order = null,
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
            createdAt: null == createdAt
                ? _value.createdAt
                : createdAt // ignore: cast_nullable_to_non_nullable
                      as String,
            completedAt: freezed == completedAt
                ? _value.completedAt
                : completedAt // ignore: cast_nullable_to_non_nullable
                      as String?,
            order: null == order
                ? _value.order
                : order // ignore: cast_nullable_to_non_nullable
                      as int,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$BrainDumpAppendedSubItemImplCopyWith<$Res>
    implements $BrainDumpAppendedSubItemCopyWith<$Res> {
  factory _$$BrainDumpAppendedSubItemImplCopyWith(
    _$BrainDumpAppendedSubItemImpl value,
    $Res Function(_$BrainDumpAppendedSubItemImpl) then,
  ) = __$$BrainDumpAppendedSubItemImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String content,
    bool completed,
    @JsonKey(name: 'created_at') String createdAt,
    @JsonKey(name: 'completed_at') String? completedAt,
    int order,
  });
}

/// @nodoc
class __$$BrainDumpAppendedSubItemImplCopyWithImpl<$Res>
    extends
        _$BrainDumpAppendedSubItemCopyWithImpl<
          $Res,
          _$BrainDumpAppendedSubItemImpl
        >
    implements _$$BrainDumpAppendedSubItemImplCopyWith<$Res> {
  __$$BrainDumpAppendedSubItemImplCopyWithImpl(
    _$BrainDumpAppendedSubItemImpl _value,
    $Res Function(_$BrainDumpAppendedSubItemImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of BrainDumpAppendedSubItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? content = null,
    Object? completed = null,
    Object? createdAt = null,
    Object? completedAt = freezed,
    Object? order = null,
  }) {
    return _then(
      _$BrainDumpAppendedSubItemImpl(
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
        createdAt: null == createdAt
            ? _value.createdAt
            : createdAt // ignore: cast_nullable_to_non_nullable
                  as String,
        completedAt: freezed == completedAt
            ? _value.completedAt
            : completedAt // ignore: cast_nullable_to_non_nullable
                  as String?,
        order: null == order
            ? _value.order
            : order // ignore: cast_nullable_to_non_nullable
                  as int,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$BrainDumpAppendedSubItemImpl implements _BrainDumpAppendedSubItem {
  const _$BrainDumpAppendedSubItemImpl({
    required this.id,
    required this.content,
    required this.completed,
    @JsonKey(name: 'created_at') required this.createdAt,
    @JsonKey(name: 'completed_at') this.completedAt,
    required this.order,
  });

  factory _$BrainDumpAppendedSubItemImpl.fromJson(Map<String, dynamic> json) =>
      _$$BrainDumpAppendedSubItemImplFromJson(json);

  @override
  final String id;
  @override
  final String content;
  @override
  final bool completed;
  @override
  @JsonKey(name: 'created_at')
  final String createdAt;
  @override
  @JsonKey(name: 'completed_at')
  final String? completedAt;
  @override
  final int order;

  @override
  String toString() {
    return 'BrainDumpAppendedSubItem(id: $id, content: $content, completed: $completed, createdAt: $createdAt, completedAt: $completedAt, order: $order)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$BrainDumpAppendedSubItemImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.content, content) || other.content == content) &&
            (identical(other.completed, completed) ||
                other.completed == completed) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.completedAt, completedAt) ||
                other.completedAt == completedAt) &&
            (identical(other.order, order) || other.order == order));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    id,
    content,
    completed,
    createdAt,
    completedAt,
    order,
  );

  /// Create a copy of BrainDumpAppendedSubItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$BrainDumpAppendedSubItemImplCopyWith<_$BrainDumpAppendedSubItemImpl>
  get copyWith =>
      __$$BrainDumpAppendedSubItemImplCopyWithImpl<
        _$BrainDumpAppendedSubItemImpl
      >(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$BrainDumpAppendedSubItemImplToJson(this);
  }
}

abstract class _BrainDumpAppendedSubItem implements BrainDumpAppendedSubItem {
  const factory _BrainDumpAppendedSubItem({
    required final String id,
    required final String content,
    required final bool completed,
    @JsonKey(name: 'created_at') required final String createdAt,
    @JsonKey(name: 'completed_at') final String? completedAt,
    required final int order,
  }) = _$BrainDumpAppendedSubItemImpl;

  factory _BrainDumpAppendedSubItem.fromJson(Map<String, dynamic> json) =
      _$BrainDumpAppendedSubItemImpl.fromJson;

  @override
  String get id;
  @override
  String get content;
  @override
  bool get completed;
  @override
  @JsonKey(name: 'created_at')
  String get createdAt;
  @override
  @JsonKey(name: 'completed_at')
  String? get completedAt;
  @override
  int get order;

  /// Create a copy of BrainDumpAppendedSubItem
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$BrainDumpAppendedSubItemImplCopyWith<_$BrainDumpAppendedSubItemImpl>
  get copyWith => throw _privateConstructorUsedError;
}

SourceAttribution _$SourceAttributionFromJson(Map<String, dynamic> json) {
  return _SourceAttribution.fromJson(json);
}

/// @nodoc
mixin _$SourceAttribution {
  @JsonKey(name: 'source_type')
  String get sourceType => throw _privateConstructorUsedError;
  double get confidence => throw _privateConstructorUsedError;
  String get reasoning => throw _privateConstructorUsedError;

  /// Serializes this SourceAttribution to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SourceAttribution
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SourceAttributionCopyWith<SourceAttribution> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SourceAttributionCopyWith<$Res> {
  factory $SourceAttributionCopyWith(
    SourceAttribution value,
    $Res Function(SourceAttribution) then,
  ) = _$SourceAttributionCopyWithImpl<$Res, SourceAttribution>;
  @useResult
  $Res call({
    @JsonKey(name: 'source_type') String sourceType,
    double confidence,
    String reasoning,
  });
}

/// @nodoc
class _$SourceAttributionCopyWithImpl<$Res, $Val extends SourceAttribution>
    implements $SourceAttributionCopyWith<$Res> {
  _$SourceAttributionCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SourceAttribution
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? sourceType = null,
    Object? confidence = null,
    Object? reasoning = null,
  }) {
    return _then(
      _value.copyWith(
            sourceType: null == sourceType
                ? _value.sourceType
                : sourceType // ignore: cast_nullable_to_non_nullable
                      as String,
            confidence: null == confidence
                ? _value.confidence
                : confidence // ignore: cast_nullable_to_non_nullable
                      as double,
            reasoning: null == reasoning
                ? _value.reasoning
                : reasoning // ignore: cast_nullable_to_non_nullable
                      as String,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$SourceAttributionImplCopyWith<$Res>
    implements $SourceAttributionCopyWith<$Res> {
  factory _$$SourceAttributionImplCopyWith(
    _$SourceAttributionImpl value,
    $Res Function(_$SourceAttributionImpl) then,
  ) = __$$SourceAttributionImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    @JsonKey(name: 'source_type') String sourceType,
    double confidence,
    String reasoning,
  });
}

/// @nodoc
class __$$SourceAttributionImplCopyWithImpl<$Res>
    extends _$SourceAttributionCopyWithImpl<$Res, _$SourceAttributionImpl>
    implements _$$SourceAttributionImplCopyWith<$Res> {
  __$$SourceAttributionImplCopyWithImpl(
    _$SourceAttributionImpl _value,
    $Res Function(_$SourceAttributionImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of SourceAttribution
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? sourceType = null,
    Object? confidence = null,
    Object? reasoning = null,
  }) {
    return _then(
      _$SourceAttributionImpl(
        sourceType: null == sourceType
            ? _value.sourceType
            : sourceType // ignore: cast_nullable_to_non_nullable
                  as String,
        confidence: null == confidence
            ? _value.confidence
            : confidence // ignore: cast_nullable_to_non_nullable
                  as double,
        reasoning: null == reasoning
            ? _value.reasoning
            : reasoning // ignore: cast_nullable_to_non_nullable
                  as String,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$SourceAttributionImpl implements _SourceAttribution {
  const _$SourceAttributionImpl({
    @JsonKey(name: 'source_type') required this.sourceType,
    required this.confidence,
    required this.reasoning,
  });

  factory _$SourceAttributionImpl.fromJson(Map<String, dynamic> json) =>
      _$$SourceAttributionImplFromJson(json);

  @override
  @JsonKey(name: 'source_type')
  final String sourceType;
  @override
  final double confidence;
  @override
  final String reasoning;

  @override
  String toString() {
    return 'SourceAttribution(sourceType: $sourceType, confidence: $confidence, reasoning: $reasoning)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SourceAttributionImpl &&
            (identical(other.sourceType, sourceType) ||
                other.sourceType == sourceType) &&
            (identical(other.confidence, confidence) ||
                other.confidence == confidence) &&
            (identical(other.reasoning, reasoning) ||
                other.reasoning == reasoning));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, sourceType, confidence, reasoning);

  /// Create a copy of SourceAttribution
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SourceAttributionImplCopyWith<_$SourceAttributionImpl> get copyWith =>
      __$$SourceAttributionImplCopyWithImpl<_$SourceAttributionImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$SourceAttributionImplToJson(this);
  }
}

abstract class _SourceAttribution implements SourceAttribution {
  const factory _SourceAttribution({
    @JsonKey(name: 'source_type') required final String sourceType,
    required final double confidence,
    required final String reasoning,
  }) = _$SourceAttributionImpl;

  factory _SourceAttribution.fromJson(Map<String, dynamic> json) =
      _$SourceAttributionImpl.fromJson;

  @override
  @JsonKey(name: 'source_type')
  String get sourceType;
  @override
  double get confidence;
  @override
  String get reasoning;

  /// Create a copy of SourceAttribution
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SourceAttributionImplCopyWith<_$SourceAttributionImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

BrainDumpItem _$BrainDumpItemFromJson(Map<String, dynamic> json) {
  return _BrainDumpItem.fromJson(json);
}

/// @nodoc
mixin _$BrainDumpItem {
  String get id => throw _privateConstructorUsedError;
  String get title => throw _privateConstructorUsedError;
  String get narrative => throw _privateConstructorUsedError;
  String get drawer => throw _privateConstructorUsedError;
  BrainDumpTag get tag => throw _privateConstructorUsedError;
  @JsonKey(name: 'strategy_used')
  String? get strategyUsed => throw _privateConstructorUsedError;
  String? get reasoning => throw _privateConstructorUsedError;
  @JsonKey(name: 'due_date')
  String? get dueDate => throw _privateConstructorUsedError;
  @JsonKey(name: 'time_confidence')
  double? get timeConfidence => throw _privateConstructorUsedError;
  @JsonKey(name: 'due_date_source')
  SourceAttribution? get dueDateSource => throw _privateConstructorUsedError;
  @JsonKey(name: 'inferred_from_milestone')
  String? get inferredFromMilestone => throw _privateConstructorUsedError;

  /// Serializes this BrainDumpItem to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of BrainDumpItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $BrainDumpItemCopyWith<BrainDumpItem> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $BrainDumpItemCopyWith<$Res> {
  factory $BrainDumpItemCopyWith(
    BrainDumpItem value,
    $Res Function(BrainDumpItem) then,
  ) = _$BrainDumpItemCopyWithImpl<$Res, BrainDumpItem>;
  @useResult
  $Res call({
    String id,
    String title,
    String narrative,
    String drawer,
    BrainDumpTag tag,
    @JsonKey(name: 'strategy_used') String? strategyUsed,
    String? reasoning,
    @JsonKey(name: 'due_date') String? dueDate,
    @JsonKey(name: 'time_confidence') double? timeConfidence,
    @JsonKey(name: 'due_date_source') SourceAttribution? dueDateSource,
    @JsonKey(name: 'inferred_from_milestone') String? inferredFromMilestone,
  });

  $BrainDumpTagCopyWith<$Res> get tag;
  $SourceAttributionCopyWith<$Res>? get dueDateSource;
}

/// @nodoc
class _$BrainDumpItemCopyWithImpl<$Res, $Val extends BrainDumpItem>
    implements $BrainDumpItemCopyWith<$Res> {
  _$BrainDumpItemCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of BrainDumpItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? narrative = null,
    Object? drawer = null,
    Object? tag = null,
    Object? strategyUsed = freezed,
    Object? reasoning = freezed,
    Object? dueDate = freezed,
    Object? timeConfidence = freezed,
    Object? dueDateSource = freezed,
    Object? inferredFromMilestone = freezed,
  }) {
    return _then(
      _value.copyWith(
            id: null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                      as String,
            title: null == title
                ? _value.title
                : title // ignore: cast_nullable_to_non_nullable
                      as String,
            narrative: null == narrative
                ? _value.narrative
                : narrative // ignore: cast_nullable_to_non_nullable
                      as String,
            drawer: null == drawer
                ? _value.drawer
                : drawer // ignore: cast_nullable_to_non_nullable
                      as String,
            tag: null == tag
                ? _value.tag
                : tag // ignore: cast_nullable_to_non_nullable
                      as BrainDumpTag,
            strategyUsed: freezed == strategyUsed
                ? _value.strategyUsed
                : strategyUsed // ignore: cast_nullable_to_non_nullable
                      as String?,
            reasoning: freezed == reasoning
                ? _value.reasoning
                : reasoning // ignore: cast_nullable_to_non_nullable
                      as String?,
            dueDate: freezed == dueDate
                ? _value.dueDate
                : dueDate // ignore: cast_nullable_to_non_nullable
                      as String?,
            timeConfidence: freezed == timeConfidence
                ? _value.timeConfidence
                : timeConfidence // ignore: cast_nullable_to_non_nullable
                      as double?,
            dueDateSource: freezed == dueDateSource
                ? _value.dueDateSource
                : dueDateSource // ignore: cast_nullable_to_non_nullable
                      as SourceAttribution?,
            inferredFromMilestone: freezed == inferredFromMilestone
                ? _value.inferredFromMilestone
                : inferredFromMilestone // ignore: cast_nullable_to_non_nullable
                      as String?,
          )
          as $Val,
    );
  }

  /// Create a copy of BrainDumpItem
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $BrainDumpTagCopyWith<$Res> get tag {
    return $BrainDumpTagCopyWith<$Res>(_value.tag, (value) {
      return _then(_value.copyWith(tag: value) as $Val);
    });
  }

  /// Create a copy of BrainDumpItem
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $SourceAttributionCopyWith<$Res>? get dueDateSource {
    if (_value.dueDateSource == null) {
      return null;
    }

    return $SourceAttributionCopyWith<$Res>(_value.dueDateSource!, (value) {
      return _then(_value.copyWith(dueDateSource: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$BrainDumpItemImplCopyWith<$Res>
    implements $BrainDumpItemCopyWith<$Res> {
  factory _$$BrainDumpItemImplCopyWith(
    _$BrainDumpItemImpl value,
    $Res Function(_$BrainDumpItemImpl) then,
  ) = __$$BrainDumpItemImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String title,
    String narrative,
    String drawer,
    BrainDumpTag tag,
    @JsonKey(name: 'strategy_used') String? strategyUsed,
    String? reasoning,
    @JsonKey(name: 'due_date') String? dueDate,
    @JsonKey(name: 'time_confidence') double? timeConfidence,
    @JsonKey(name: 'due_date_source') SourceAttribution? dueDateSource,
    @JsonKey(name: 'inferred_from_milestone') String? inferredFromMilestone,
  });

  @override
  $BrainDumpTagCopyWith<$Res> get tag;
  @override
  $SourceAttributionCopyWith<$Res>? get dueDateSource;
}

/// @nodoc
class __$$BrainDumpItemImplCopyWithImpl<$Res>
    extends _$BrainDumpItemCopyWithImpl<$Res, _$BrainDumpItemImpl>
    implements _$$BrainDumpItemImplCopyWith<$Res> {
  __$$BrainDumpItemImplCopyWithImpl(
    _$BrainDumpItemImpl _value,
    $Res Function(_$BrainDumpItemImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of BrainDumpItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? narrative = null,
    Object? drawer = null,
    Object? tag = null,
    Object? strategyUsed = freezed,
    Object? reasoning = freezed,
    Object? dueDate = freezed,
    Object? timeConfidence = freezed,
    Object? dueDateSource = freezed,
    Object? inferredFromMilestone = freezed,
  }) {
    return _then(
      _$BrainDumpItemImpl(
        id: null == id
            ? _value.id
            : id // ignore: cast_nullable_to_non_nullable
                  as String,
        title: null == title
            ? _value.title
            : title // ignore: cast_nullable_to_non_nullable
                  as String,
        narrative: null == narrative
            ? _value.narrative
            : narrative // ignore: cast_nullable_to_non_nullable
                  as String,
        drawer: null == drawer
            ? _value.drawer
            : drawer // ignore: cast_nullable_to_non_nullable
                  as String,
        tag: null == tag
            ? _value.tag
            : tag // ignore: cast_nullable_to_non_nullable
                  as BrainDumpTag,
        strategyUsed: freezed == strategyUsed
            ? _value.strategyUsed
            : strategyUsed // ignore: cast_nullable_to_non_nullable
                  as String?,
        reasoning: freezed == reasoning
            ? _value.reasoning
            : reasoning // ignore: cast_nullable_to_non_nullable
                  as String?,
        dueDate: freezed == dueDate
            ? _value.dueDate
            : dueDate // ignore: cast_nullable_to_non_nullable
                  as String?,
        timeConfidence: freezed == timeConfidence
            ? _value.timeConfidence
            : timeConfidence // ignore: cast_nullable_to_non_nullable
                  as double?,
        dueDateSource: freezed == dueDateSource
            ? _value.dueDateSource
            : dueDateSource // ignore: cast_nullable_to_non_nullable
                  as SourceAttribution?,
        inferredFromMilestone: freezed == inferredFromMilestone
            ? _value.inferredFromMilestone
            : inferredFromMilestone // ignore: cast_nullable_to_non_nullable
                  as String?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$BrainDumpItemImpl implements _BrainDumpItem {
  const _$BrainDumpItemImpl({
    required this.id,
    required this.title,
    required this.narrative,
    required this.drawer,
    required this.tag,
    @JsonKey(name: 'strategy_used') this.strategyUsed,
    this.reasoning,
    @JsonKey(name: 'due_date') this.dueDate,
    @JsonKey(name: 'time_confidence') this.timeConfidence,
    @JsonKey(name: 'due_date_source') this.dueDateSource,
    @JsonKey(name: 'inferred_from_milestone') this.inferredFromMilestone,
  });

  factory _$BrainDumpItemImpl.fromJson(Map<String, dynamic> json) =>
      _$$BrainDumpItemImplFromJson(json);

  @override
  final String id;
  @override
  final String title;
  @override
  final String narrative;
  @override
  final String drawer;
  @override
  final BrainDumpTag tag;
  @override
  @JsonKey(name: 'strategy_used')
  final String? strategyUsed;
  @override
  final String? reasoning;
  @override
  @JsonKey(name: 'due_date')
  final String? dueDate;
  @override
  @JsonKey(name: 'time_confidence')
  final double? timeConfidence;
  @override
  @JsonKey(name: 'due_date_source')
  final SourceAttribution? dueDateSource;
  @override
  @JsonKey(name: 'inferred_from_milestone')
  final String? inferredFromMilestone;

  @override
  String toString() {
    return 'BrainDumpItem(id: $id, title: $title, narrative: $narrative, drawer: $drawer, tag: $tag, strategyUsed: $strategyUsed, reasoning: $reasoning, dueDate: $dueDate, timeConfidence: $timeConfidence, dueDateSource: $dueDateSource, inferredFromMilestone: $inferredFromMilestone)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$BrainDumpItemImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.narrative, narrative) ||
                other.narrative == narrative) &&
            (identical(other.drawer, drawer) || other.drawer == drawer) &&
            (identical(other.tag, tag) || other.tag == tag) &&
            (identical(other.strategyUsed, strategyUsed) ||
                other.strategyUsed == strategyUsed) &&
            (identical(other.reasoning, reasoning) ||
                other.reasoning == reasoning) &&
            (identical(other.dueDate, dueDate) || other.dueDate == dueDate) &&
            (identical(other.timeConfidence, timeConfidence) ||
                other.timeConfidence == timeConfidence) &&
            (identical(other.dueDateSource, dueDateSource) ||
                other.dueDateSource == dueDateSource) &&
            (identical(other.inferredFromMilestone, inferredFromMilestone) ||
                other.inferredFromMilestone == inferredFromMilestone));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    id,
    title,
    narrative,
    drawer,
    tag,
    strategyUsed,
    reasoning,
    dueDate,
    timeConfidence,
    dueDateSource,
    inferredFromMilestone,
  );

  /// Create a copy of BrainDumpItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$BrainDumpItemImplCopyWith<_$BrainDumpItemImpl> get copyWith =>
      __$$BrainDumpItemImplCopyWithImpl<_$BrainDumpItemImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$BrainDumpItemImplToJson(this);
  }
}

abstract class _BrainDumpItem implements BrainDumpItem {
  const factory _BrainDumpItem({
    required final String id,
    required final String title,
    required final String narrative,
    required final String drawer,
    required final BrainDumpTag tag,
    @JsonKey(name: 'strategy_used') final String? strategyUsed,
    final String? reasoning,
    @JsonKey(name: 'due_date') final String? dueDate,
    @JsonKey(name: 'time_confidence') final double? timeConfidence,
    @JsonKey(name: 'due_date_source') final SourceAttribution? dueDateSource,
    @JsonKey(name: 'inferred_from_milestone')
    final String? inferredFromMilestone,
  }) = _$BrainDumpItemImpl;

  factory _BrainDumpItem.fromJson(Map<String, dynamic> json) =
      _$BrainDumpItemImpl.fromJson;

  @override
  String get id;
  @override
  String get title;
  @override
  String get narrative;
  @override
  String get drawer;
  @override
  BrainDumpTag get tag;
  @override
  @JsonKey(name: 'strategy_used')
  String? get strategyUsed;
  @override
  String? get reasoning;
  @override
  @JsonKey(name: 'due_date')
  String? get dueDate;
  @override
  @JsonKey(name: 'time_confidence')
  double? get timeConfidence;
  @override
  @JsonKey(name: 'due_date_source')
  SourceAttribution? get dueDateSource;
  @override
  @JsonKey(name: 'inferred_from_milestone')
  String? get inferredFromMilestone;

  /// Create a copy of BrainDumpItem
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$BrainDumpItemImplCopyWith<_$BrainDumpItemImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

BrainDumpTag _$BrainDumpTagFromJson(Map<String, dynamic> json) {
  return _BrainDumpTag.fromJson(json);
}

/// @nodoc
mixin _$BrainDumpTag {
  String get area => throw _privateConstructorUsedError;
  String get product => throw _privateConstructorUsedError;
  String? get topic => throw _privateConstructorUsedError;

  /// Serializes this BrainDumpTag to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of BrainDumpTag
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $BrainDumpTagCopyWith<BrainDumpTag> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $BrainDumpTagCopyWith<$Res> {
  factory $BrainDumpTagCopyWith(
    BrainDumpTag value,
    $Res Function(BrainDumpTag) then,
  ) = _$BrainDumpTagCopyWithImpl<$Res, BrainDumpTag>;
  @useResult
  $Res call({String area, String product, String? topic});
}

/// @nodoc
class _$BrainDumpTagCopyWithImpl<$Res, $Val extends BrainDumpTag>
    implements $BrainDumpTagCopyWith<$Res> {
  _$BrainDumpTagCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of BrainDumpTag
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? area = null,
    Object? product = null,
    Object? topic = freezed,
  }) {
    return _then(
      _value.copyWith(
            area: null == area
                ? _value.area
                : area // ignore: cast_nullable_to_non_nullable
                      as String,
            product: null == product
                ? _value.product
                : product // ignore: cast_nullable_to_non_nullable
                      as String,
            topic: freezed == topic
                ? _value.topic
                : topic // ignore: cast_nullable_to_non_nullable
                      as String?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$BrainDumpTagImplCopyWith<$Res>
    implements $BrainDumpTagCopyWith<$Res> {
  factory _$$BrainDumpTagImplCopyWith(
    _$BrainDumpTagImpl value,
    $Res Function(_$BrainDumpTagImpl) then,
  ) = __$$BrainDumpTagImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String area, String product, String? topic});
}

/// @nodoc
class __$$BrainDumpTagImplCopyWithImpl<$Res>
    extends _$BrainDumpTagCopyWithImpl<$Res, _$BrainDumpTagImpl>
    implements _$$BrainDumpTagImplCopyWith<$Res> {
  __$$BrainDumpTagImplCopyWithImpl(
    _$BrainDumpTagImpl _value,
    $Res Function(_$BrainDumpTagImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of BrainDumpTag
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? area = null,
    Object? product = null,
    Object? topic = freezed,
  }) {
    return _then(
      _$BrainDumpTagImpl(
        area: null == area
            ? _value.area
            : area // ignore: cast_nullable_to_non_nullable
                  as String,
        product: null == product
            ? _value.product
            : product // ignore: cast_nullable_to_non_nullable
                  as String,
        topic: freezed == topic
            ? _value.topic
            : topic // ignore: cast_nullable_to_non_nullable
                  as String?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$BrainDumpTagImpl implements _BrainDumpTag {
  const _$BrainDumpTagImpl({
    required this.area,
    required this.product,
    this.topic,
  });

  factory _$BrainDumpTagImpl.fromJson(Map<String, dynamic> json) =>
      _$$BrainDumpTagImplFromJson(json);

  @override
  final String area;
  @override
  final String product;
  @override
  final String? topic;

  @override
  String toString() {
    return 'BrainDumpTag(area: $area, product: $product, topic: $topic)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$BrainDumpTagImpl &&
            (identical(other.area, area) || other.area == area) &&
            (identical(other.product, product) || other.product == product) &&
            (identical(other.topic, topic) || other.topic == topic));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, area, product, topic);

  /// Create a copy of BrainDumpTag
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$BrainDumpTagImplCopyWith<_$BrainDumpTagImpl> get copyWith =>
      __$$BrainDumpTagImplCopyWithImpl<_$BrainDumpTagImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$BrainDumpTagImplToJson(this);
  }
}

abstract class _BrainDumpTag implements BrainDumpTag {
  const factory _BrainDumpTag({
    required final String area,
    required final String product,
    final String? topic,
  }) = _$BrainDumpTagImpl;

  factory _BrainDumpTag.fromJson(Map<String, dynamic> json) =
      _$BrainDumpTagImpl.fromJson;

  @override
  String get area;
  @override
  String get product;
  @override
  String? get topic;

  /// Create a copy of BrainDumpTag
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$BrainDumpTagImplCopyWith<_$BrainDumpTagImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
