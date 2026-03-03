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

/// AI 速率限制錯誤（今日額度已用完）
class RateLimitFailure extends Failure {
  const RateLimitFailure([
    String message =
        '今日 AI 額度已用完，明天 UTC 00:00（台灣時間 08:00）後將自動重置。',
  ]) : super(message);
}
