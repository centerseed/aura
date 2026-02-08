import 'package:dio/dio.dart';

/// 重試攔截器
/// 針對 timeout 和網路錯誤自動重試，避免偶發性錯誤直接顯示給用戶
class RetryInterceptor extends Interceptor {
  final Dio dio;
  final int maxRetries;
  final Duration retryDelay;

  RetryInterceptor({
    required this.dio,
    this.maxRetries = 2,
    this.retryDelay = const Duration(seconds: 1),
  });

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    if (!_shouldRetry(err)) {
      return handler.next(err);
    }

    final retryCount = err.requestOptions.extra['retryCount'] ?? 0;
    if (retryCount >= maxRetries) {
      return handler.next(err);
    }

    await Future.delayed(retryDelay * (retryCount + 1));

    try {
      final options = err.requestOptions;
      options.extra['retryCount'] = retryCount + 1;

      final response = await dio.fetch(options);
      return handler.resolve(response);
    } on DioException catch (e) {
      return handler.next(e);
    }
  }

  bool _shouldRetry(DioException err) {
    return err.type == DioExceptionType.connectionTimeout ||
        err.type == DioExceptionType.receiveTimeout ||
        err.type == DioExceptionType.sendTimeout ||
        err.type == DioExceptionType.connectionError;
  }
}
