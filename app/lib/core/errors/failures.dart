import 'package:equatable/equatable.dart';

/// 錯誤基類
abstract class Failure extends Equatable {
  final String message;

  const Failure(this.message);

  @override
  List<Object?> get props => [message];
}

/// 服務器錯誤
class ServerFailure extends Failure {
  const ServerFailure(super.message);
}

/// 快取錯誤
class CacheFailure extends Failure {
  const CacheFailure(super.message);
}

/// 網路錯誤
class NetworkFailure extends Failure {
  const NetworkFailure(super.message);
}

/// 認證錯誤
class AuthFailure extends Failure {
  const AuthFailure(super.message);
}

/// 驗證錯誤
class ValidationFailure extends Failure {
  const ValidationFailure(super.message);
}

/// 未知錯誤
class UnknownFailure extends Failure {
  const UnknownFailure(super.message);
}
