import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';

/// Firebase Auth 攔截器
/// 自動在每個 API 請求中添加 Bearer Token
class AuthInterceptor extends Interceptor {
  final FirebaseAuth _firebaseAuth;

  AuthInterceptor(this._firebaseAuth);

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    try {
      final user = _firebaseAuth.currentUser;

      if (user != null) {
        // 獲取最新的 ID Token
        final token = await user.getIdToken();

        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
      }

      handler.next(options);
    } catch (e) {
      handler.reject(
        DioException(
          requestOptions: options,
          error: 'Failed to get Firebase ID token: $e',
          type: DioExceptionType.unknown,
        ),
      );
    }
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    // 401 錯誤：Token 過期或無效，自動登出
    if (err.response?.statusCode == 401) {
      _firebaseAuth.signOut();
    }

    handler.next(err);
  }
}
