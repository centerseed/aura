import 'package:dartz/dartz.dart' hide Task;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/errors/failures.dart';

/// AsyncValue<Either<Failure, T>> 的擴展方法
/// 用於簡化在 UI 層處理 Either 類型
extension AsyncEitherX<T> on AsyncValue<Either<Failure, T>> {
  /// 將 Either 展開為標準的 AsyncValue
  /// 成功時返回 data，失敗時返回 error
  AsyncValue<T> unwrap() {
    return when(
      data: (either) => either.fold(
        (failure) => AsyncValue.error(failure, StackTrace.current),
        (value) => AsyncValue.data(value),
      ),
      loading: () => const AsyncValue.loading(),
      error: (error, stackTrace) => AsyncValue.error(error, stackTrace),
    );
  }

  /// 從 Either 中提取值，失敗時返回 null
  T? get valueOrNull {
    return maybeWhen(
      data: (either) => either.fold((l) => null, (r) => r),
      orElse: () => null,
    );
  }

  /// 從 Either 中提取 Failure，成功時返回 null
  Failure? get failureOrNull {
    return maybeWhen(
      data: (either) => either.fold((l) => l, (r) => null),
      orElse: () => null,
    );
  }

  /// 檢查是否有數據（Either 是 Right）
  bool get hasData {
    return maybeWhen(
      data: (either) => either.isRight(),
      orElse: () => false,
    );
  }

  /// 檢查是否有錯誤（Either 是 Left）
  bool get hasFailure {
    return maybeWhen(
      data: (either) => either.isLeft(),
      orElse: () => false,
    );
  }
}

/// Either 的便捷擴展方法
extension EitherX<L, R> on Either<L, R> {
  /// 檢查是否為 Right
  bool isRight() => fold((_) => false, (_) => true);

  /// 檢查是否為 Left
  bool isLeft() => fold((_) => true, (_) => false);
}
