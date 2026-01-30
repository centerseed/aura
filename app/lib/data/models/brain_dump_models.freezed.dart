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

BrainDumpResponse _$BrainDumpResponseFromJson(Map<String, dynamic> json) {
  return _BrainDumpResponse.fromJson(json);
}

/// @nodoc
mixin _$BrainDumpResponse {
  bool get success => throw _privateConstructorUsedError;
  List<BrainDumpItem> get items => throw _privateConstructorUsedError;

  /// Serializes this BrainDumpResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

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
  $Res call({bool success, List<BrainDumpItem> items});
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
  $Res call({Object? success = null, Object? items = null}) {
    return _then(
      _value.copyWith(
            success: null == success
                ? _value.success
                : success // ignore: cast_nullable_to_non_nullable
                      as bool,
            items: null == items
                ? _value.items
                : items // ignore: cast_nullable_to_non_nullable
                      as List<BrainDumpItem>,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$BrainDumpResponseImplCopyWith<$Res>
    implements $BrainDumpResponseCopyWith<$Res> {
  factory _$$BrainDumpResponseImplCopyWith(
    _$BrainDumpResponseImpl value,
    $Res Function(_$BrainDumpResponseImpl) then,
  ) = __$$BrainDumpResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({bool success, List<BrainDumpItem> items});
}

/// @nodoc
class __$$BrainDumpResponseImplCopyWithImpl<$Res>
    extends _$BrainDumpResponseCopyWithImpl<$Res, _$BrainDumpResponseImpl>
    implements _$$BrainDumpResponseImplCopyWith<$Res> {
  __$$BrainDumpResponseImplCopyWithImpl(
    _$BrainDumpResponseImpl _value,
    $Res Function(_$BrainDumpResponseImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of BrainDumpResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? success = null, Object? items = null}) {
    return _then(
      _$BrainDumpResponseImpl(
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
@JsonSerializable()
class _$BrainDumpResponseImpl implements _BrainDumpResponse {
  const _$BrainDumpResponseImpl({
    required this.success,
    required final List<BrainDumpItem> items,
  }) : _items = items;

  factory _$BrainDumpResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$BrainDumpResponseImplFromJson(json);

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
    return 'BrainDumpResponse(success: $success, items: $items)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$BrainDumpResponseImpl &&
            (identical(other.success, success) || other.success == success) &&
            const DeepCollectionEquality().equals(other._items, _items));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
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
  _$$BrainDumpResponseImplCopyWith<_$BrainDumpResponseImpl> get copyWith =>
      __$$BrainDumpResponseImplCopyWithImpl<_$BrainDumpResponseImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$BrainDumpResponseImplToJson(this);
  }
}

abstract class _BrainDumpResponse implements BrainDumpResponse {
  const factory _BrainDumpResponse({
    required final bool success,
    required final List<BrainDumpItem> items,
  }) = _$BrainDumpResponseImpl;

  factory _BrainDumpResponse.fromJson(Map<String, dynamic> json) =
      _$BrainDumpResponseImpl.fromJson;

  @override
  bool get success;
  @override
  List<BrainDumpItem> get items;

  /// Create a copy of BrainDumpResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$BrainDumpResponseImplCopyWith<_$BrainDumpResponseImpl> get copyWith =>
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
  @JsonKey(name: 'due_date')
  String? get dueDate => throw _privateConstructorUsedError;
  @JsonKey(name: 'time_confidence')
  double? get timeConfidence => throw _privateConstructorUsedError;
  @JsonKey(name: 'time_reasoning')
  String? get timeReasoning => throw _privateConstructorUsedError;
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
    @JsonKey(name: 'due_date') String? dueDate,
    @JsonKey(name: 'time_confidence') double? timeConfidence,
    @JsonKey(name: 'time_reasoning') String? timeReasoning,
    @JsonKey(name: 'inferred_from_milestone') String? inferredFromMilestone,
  });

  $BrainDumpTagCopyWith<$Res> get tag;
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
    Object? dueDate = freezed,
    Object? timeConfidence = freezed,
    Object? timeReasoning = freezed,
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
            dueDate: freezed == dueDate
                ? _value.dueDate
                : dueDate // ignore: cast_nullable_to_non_nullable
                      as String?,
            timeConfidence: freezed == timeConfidence
                ? _value.timeConfidence
                : timeConfidence // ignore: cast_nullable_to_non_nullable
                      as double?,
            timeReasoning: freezed == timeReasoning
                ? _value.timeReasoning
                : timeReasoning // ignore: cast_nullable_to_non_nullable
                      as String?,
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
    @JsonKey(name: 'due_date') String? dueDate,
    @JsonKey(name: 'time_confidence') double? timeConfidence,
    @JsonKey(name: 'time_reasoning') String? timeReasoning,
    @JsonKey(name: 'inferred_from_milestone') String? inferredFromMilestone,
  });

  @override
  $BrainDumpTagCopyWith<$Res> get tag;
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
    Object? dueDate = freezed,
    Object? timeConfidence = freezed,
    Object? timeReasoning = freezed,
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
        dueDate: freezed == dueDate
            ? _value.dueDate
            : dueDate // ignore: cast_nullable_to_non_nullable
                  as String?,
        timeConfidence: freezed == timeConfidence
            ? _value.timeConfidence
            : timeConfidence // ignore: cast_nullable_to_non_nullable
                  as double?,
        timeReasoning: freezed == timeReasoning
            ? _value.timeReasoning
            : timeReasoning // ignore: cast_nullable_to_non_nullable
                  as String?,
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
    @JsonKey(name: 'due_date') this.dueDate,
    @JsonKey(name: 'time_confidence') this.timeConfidence,
    @JsonKey(name: 'time_reasoning') this.timeReasoning,
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
  @JsonKey(name: 'due_date')
  final String? dueDate;
  @override
  @JsonKey(name: 'time_confidence')
  final double? timeConfidence;
  @override
  @JsonKey(name: 'time_reasoning')
  final String? timeReasoning;
  @override
  @JsonKey(name: 'inferred_from_milestone')
  final String? inferredFromMilestone;

  @override
  String toString() {
    return 'BrainDumpItem(id: $id, title: $title, narrative: $narrative, drawer: $drawer, tag: $tag, dueDate: $dueDate, timeConfidence: $timeConfidence, timeReasoning: $timeReasoning, inferredFromMilestone: $inferredFromMilestone)';
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
            (identical(other.dueDate, dueDate) || other.dueDate == dueDate) &&
            (identical(other.timeConfidence, timeConfidence) ||
                other.timeConfidence == timeConfidence) &&
            (identical(other.timeReasoning, timeReasoning) ||
                other.timeReasoning == timeReasoning) &&
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
    dueDate,
    timeConfidence,
    timeReasoning,
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
    @JsonKey(name: 'due_date') final String? dueDate,
    @JsonKey(name: 'time_confidence') final double? timeConfidence,
    @JsonKey(name: 'time_reasoning') final String? timeReasoning,
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
  @JsonKey(name: 'due_date')
  String? get dueDate;
  @override
  @JsonKey(name: 'time_confidence')
  double? get timeConfidence;
  @override
  @JsonKey(name: 'time_reasoning')
  String? get timeReasoning;
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
