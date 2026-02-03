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
        // 強制刷新 Token 確保有效性
        final token = await user.getIdToken(true);

        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
          print('🔑 Token attached (${token.length} chars) for ${options.uri}');
        } else {
          print('⚠️ Token is null/empty for user: ${user.uid}');
        }
      } else {
        print('⚠️ No authenticated user for ${options.uri}');
      }

      handler.next(options);
    } catch (e) {
      print('❌ Auth interceptor error: $e');
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
      print('❌ 401 Unauthorized - Signing out');
      _firebaseAuth.signOut();
    }

    handler.next(err);
  }
}
