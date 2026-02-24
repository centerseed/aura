import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';

/// 透過 Firebase Auth REST API 取得 ID Token
/// 不依賴 Flutter Firebase SDK，可在純 Dart VM (flutter test) 中使用
class FirebaseTestAuth {
  static String get _apiKey {
    final key = Platform.environment['FIREBASE_API_KEY'];
    if (key == null || key.isEmpty) {
      throw StateError(
        'FIREBASE_API_KEY environment variable is required for integration tests',
      );
    }
    return key;
  }

  static String get testEmail =>
      Platform.environment['TEST_EMAIL'] ?? 'test@zentropy.cc';
  static String get testPassword =>
      Platform.environment['TEST_PASSWORD'] ?? '123456';
  static const testFirebaseUid = 'b1MHYIFidPaJKisUmUk25CXG6c33';

  /// 用 email/password 登入，回傳 ID Token
  static Future<String> signIn({
    String? email,
    String? password,
  }) async {
    final dio = Dio();
    final response = await dio.post(
      'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$_apiKey',
      data: {
        'email': email ?? testEmail,
        'password': password ?? testPassword,
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
