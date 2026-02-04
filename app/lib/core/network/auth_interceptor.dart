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
    // 401 錯誤：只有在用戶已登入狀態下才登出
    // 避免在認證初始化階段（token 還沒準備好）收到 401 就誤登出
    if (err.response?.statusCode == 401) {
      final user = _firebaseAuth.currentUser;
      if (user != null) {
        // 用戶已登入但收到 401，表示 token 真的過期或無效
        print('❌ 401 Unauthorized - User was logged in, signing out');
        _firebaseAuth.signOut();
      } else {
        // 用戶未登入就收到 401，這是正常的（認證尚未完成）
        print('⚠️ 401 Unauthorized - User not logged in, ignoring');
      }
    }

    handler.next(err);
  }
}
