// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'user_statistics_model.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

UserStatisticsModel _$UserStatisticsModelFromJson(Map<String, dynamic> json) {
  return _UserStatisticsModel.fromJson(json);
}

/// @nodoc
mixin _$UserStatisticsModel {
  @JsonKey(name: 'totalTasks')
  int get totalTasks => throw _privateConstructorUsedError;
  @JsonKey(name: 'totalProducts')
  int get totalProducts => throw _privateConstructorUsedError;
  @JsonKey(name: 'totalAreas')
  int get totalAreas => throw _privateConstructorUsedError;
  @JsonKey(name: 'daysActive')
  int get daysActive => throw _privateConstructorUsedError;
  @JsonKey(name: 'activeTasks')
  int get activeTasks => throw _privateConstructorUsedError;
  @JsonKey(name: 'archivedTasks')
  int get archivedTasks => throw _privateConstructorUsedError;
  @JsonKey(name: 'completedToday')
  int get completedToday => throw _privateConstructorUsedError;

  /// Serializes this UserStatisticsModel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of UserStatisticsModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $UserStatisticsModelCopyWith<UserStatisticsModel> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $UserStatisticsModelCopyWith<$Res> {
  factory $UserStatisticsModelCopyWith(
    UserStatisticsModel value,
    $Res Function(UserStatisticsModel) then,
  ) = _$UserStatisticsModelCopyWithImpl<$Res, UserStatisticsModel>;
  @useResult
  $Res call({
    @JsonKey(name: 'totalTasks') int totalTasks,
    @JsonKey(name: 'totalProducts') int totalProducts,
    @JsonKey(name: 'totalAreas') int totalAreas,
    @JsonKey(name: 'daysActive') int daysActive,
    @JsonKey(name: 'activeTasks') int activeTasks,
    @JsonKey(name: 'archivedTasks') int archivedTasks,
    @JsonKey(name: 'completedToday') int completedToday,
  });
}

/// @nodoc
class _$UserStatisticsModelCopyWithImpl<$Res, $Val extends UserStatisticsModel>
    implements $UserStatisticsModelCopyWith<$Res> {
  _$UserStatisticsModelCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of UserStatisticsModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? totalTasks = null,
    Object? totalProducts = null,
    Object? totalAreas = null,
    Object? daysActive = null,
    Object? activeTasks = null,
    Object? archivedTasks = null,
    Object? completedToday = null,
  }) {
    return _then(
      _value.copyWith(
            totalTasks: null == totalTasks
                ? _value.totalTasks
                : totalTasks // ignore: cast_nullable_to_non_nullable
                      as int,
            totalProducts: null == totalProducts
                ? _value.totalProducts
                : totalProducts // ignore: cast_nullable_to_non_nullable
                      as int,
            totalAreas: null == totalAreas
                ? _value.totalAreas
                : totalAreas // ignore: cast_nullable_to_non_nullable
                      as int,
            daysActive: null == daysActive
                ? _value.daysActive
                : daysActive // ignore: cast_nullable_to_non_nullable
                      as int,
            activeTasks: null == activeTasks
                ? _value.activeTasks
                : activeTasks // ignore: cast_nullable_to_non_nullable
                      as int,
            archivedTasks: null == archivedTasks
                ? _value.archivedTasks
                : archivedTasks // ignore: cast_nullable_to_non_nullable
                      as int,
            completedToday: null == completedToday
                ? _value.completedToday
                : completedToday // ignore: cast_nullable_to_non_nullable
                      as int,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$UserStatisticsModelImplCopyWith<$Res>
    implements $UserStatisticsModelCopyWith<$Res> {
  factory _$$UserStatisticsModelImplCopyWith(
    _$UserStatisticsModelImpl value,
    $Res Function(_$UserStatisticsModelImpl) then,
  ) = __$$UserStatisticsModelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    @JsonKey(name: 'totalTasks') int totalTasks,
    @JsonKey(name: 'totalProducts') int totalProducts,
    @JsonKey(name: 'totalAreas') int totalAreas,
    @JsonKey(name: 'daysActive') int daysActive,
    @JsonKey(name: 'activeTasks') int activeTasks,
    @JsonKey(name: 'archivedTasks') int archivedTasks,
    @JsonKey(name: 'completedToday') int completedToday,
  });
}

/// @nodoc
class __$$UserStatisticsModelImplCopyWithImpl<$Res>
    extends _$UserStatisticsModelCopyWithImpl<$Res, _$UserStatisticsModelImpl>
    implements _$$UserStatisticsModelImplCopyWith<$Res> {
  __$$UserStatisticsModelImplCopyWithImpl(
    _$UserStatisticsModelImpl _value,
    $Res Function(_$UserStatisticsModelImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of UserStatisticsModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? totalTasks = null,
    Object? totalProducts = null,
    Object? totalAreas = null,
    Object? daysActive = null,
    Object? activeTasks = null,
    Object? archivedTasks = null,
    Object? completedToday = null,
  }) {
    return _then(
      _$UserStatisticsModelImpl(
        totalTasks: null == totalTasks
            ? _value.totalTasks
            : totalTasks // ignore: cast_nullable_to_non_nullable
                  as int,
        totalProducts: null == totalProducts
            ? _value.totalProducts
            : totalProducts // ignore: cast_nullable_to_non_nullable
                  as int,
        totalAreas: null == totalAreas
            ? _value.totalAreas
            : totalAreas // ignore: cast_nullable_to_non_nullable
                  as int,
        daysActive: null == daysActive
            ? _value.daysActive
            : daysActive // ignore: cast_nullable_to_non_nullable
                  as int,
        activeTasks: null == activeTasks
            ? _value.activeTasks
            : activeTasks // ignore: cast_nullable_to_non_nullable
                  as int,
        archivedTasks: null == archivedTasks
            ? _value.archivedTasks
            : archivedTasks // ignore: cast_nullable_to_non_nullable
                  as int,
        completedToday: null == completedToday
            ? _value.completedToday
            : completedToday // ignore: cast_nullable_to_non_nullable
                  as int,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$UserStatisticsModelImpl extends _UserStatisticsModel {
  const _$UserStatisticsModelImpl({
    @JsonKey(name: 'totalTasks') required this.totalTasks,
    @JsonKey(name: 'totalProducts') required this.totalProducts,
    @JsonKey(name: 'totalAreas') required this.totalAreas,
    @JsonKey(name: 'daysActive') required this.daysActive,
    @JsonKey(name: 'activeTasks') required this.activeTasks,
    @JsonKey(name: 'archivedTasks') required this.archivedTasks,
    @JsonKey(name: 'completedToday') required this.completedToday,
  }) : super._();

  factory _$UserStatisticsModelImpl.fromJson(Map<String, dynamic> json) =>
      _$$UserStatisticsModelImplFromJson(json);

  @override
  @JsonKey(name: 'totalTasks')
  final int totalTasks;
  @override
  @JsonKey(name: 'totalProducts')
  final int totalProducts;
  @override
  @JsonKey(name: 'totalAreas')
  final int totalAreas;
  @override
  @JsonKey(name: 'daysActive')
  final int daysActive;
  @override
  @JsonKey(name: 'activeTasks')
  final int activeTasks;
  @override
  @JsonKey(name: 'archivedTasks')
  final int archivedTasks;
  @override
  @JsonKey(name: 'completedToday')
  final int completedToday;

  @override
  String toString() {
    return 'UserStatisticsModel(totalTasks: $totalTasks, totalProducts: $totalProducts, totalAreas: $totalAreas, daysActive: $daysActive, activeTasks: $activeTasks, archivedTasks: $archivedTasks, completedToday: $completedToday)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$UserStatisticsModelImpl &&
            (identical(other.totalTasks, totalTasks) ||
                other.totalTasks == totalTasks) &&
            (identical(other.totalProducts, totalProducts) ||
                other.totalProducts == totalProducts) &&
            (identical(other.totalAreas, totalAreas) ||
                other.totalAreas == totalAreas) &&
            (identical(other.daysActive, daysActive) ||
                other.daysActive == daysActive) &&
            (identical(other.activeTasks, activeTasks) ||
                other.activeTasks == activeTasks) &&
            (identical(other.archivedTasks, archivedTasks) ||
                other.archivedTasks == archivedTasks) &&
            (identical(other.completedToday, completedToday) ||
                other.completedToday == completedToday));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    totalTasks,
    totalProducts,
    totalAreas,
    daysActive,
    activeTasks,
    archivedTasks,
    completedToday,
  );

  /// Create a copy of UserStatisticsModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$UserStatisticsModelImplCopyWith<_$UserStatisticsModelImpl> get copyWith =>
      __$$UserStatisticsModelImplCopyWithImpl<_$UserStatisticsModelImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$UserStatisticsModelImplToJson(this);
  }
}

abstract class _UserStatisticsModel extends UserStatisticsModel {
  const factory _UserStatisticsModel({
    @JsonKey(name: 'totalTasks') required final int totalTasks,
    @JsonKey(name: 'totalProducts') required final int totalProducts,
    @JsonKey(name: 'totalAreas') required final int totalAreas,
    @JsonKey(name: 'daysActive') required final int daysActive,
    @JsonKey(name: 'activeTasks') required final int activeTasks,
    @JsonKey(name: 'archivedTasks') required final int archivedTasks,
    @JsonKey(name: 'completedToday') required final int completedToday,
  }) = _$UserStatisticsModelImpl;
  const _UserStatisticsModel._() : super._();

  factory _UserStatisticsModel.fromJson(Map<String, dynamic> json) =
      _$UserStatisticsModelImpl.fromJson;

  @override
  @JsonKey(name: 'totalTasks')
  int get totalTasks;
  @override
  @JsonKey(name: 'totalProducts')
  int get totalProducts;
  @override
  @JsonKey(name: 'totalAreas')
  int get totalAreas;
  @override
  @JsonKey(name: 'daysActive')
  int get daysActive;
  @override
  @JsonKey(name: 'activeTasks')
  int get activeTasks;
  @override
  @JsonKey(name: 'archivedTasks')
  int get archivedTasks;
  @override
  @JsonKey(name: 'completedToday')
  int get completedToday;

  /// Create a copy of UserStatisticsModel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$UserStatisticsModelImplCopyWith<_$UserStatisticsModelImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
