import 'dart:convert';
import 'package:dio/dio.dart';

/// 透過 Firebase Auth REST API 取得 ID Token
/// 不依賴 Flutter Firebase SDK，可在純 Dart VM (flutter test) 中使用
class FirebaseTestAuth {
  static const _apiKey = 'AIzaSyAJYyZ1wfUHyxaCpI11Z2c3SH44Qi7lg-E';
  static const testEmail = 'test@zentropy.cc';
  static const testPassword = '123456';
  static const testFirebaseUid = 'b1MHYIFidPaJKisUmUk25CXG6c33';

  /// 用 email/password 登入，回傳 ID Token
  static Future<String> signIn({
    String email = testEmail,
    String password = testPassword,
  }) async {
    final dio = Dio();
    final response = await dio.post(
      'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$_apiKey',
      data: {
        'email': email,
        'password': password,
        'returnSecureToken': true,
      },
    );

    final idToken = response.data['idToken'] as String;
    if (idToken.isEmpty) {
      throw Exception('Failed to get ID token');
    }
    return idToken;
  }
}
