import 'package:dartz/dartz.dart';
import '../../core/errors/failures.dart';

/// Base UseCase 抽象類
/// T: 返回值類型
/// Params: 輸入參數類型
abstract class UseCase<T, Params> {
  Future<Either<Failure, T>> call(Params params);
}

/// 無參數的 UseCase
abstract class NoParamsUseCase<T> {
  Future<Either<Failure, T>> call();
}
