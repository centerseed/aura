import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:dartz/dartz.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

import '../../config/auth_config.dart';
import '../../core/errors/failures.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/remote/api_client.dart';

class AuthRepositoryImpl implements AuthRepository {
  final FirebaseAuth _firebaseAuth;
  final ApiClient _apiClient;
  late final GoogleSignIn _googleSignIn;

  AuthRepositoryImpl(this._firebaseAuth, this._apiClient) {
    _googleSignIn = GoogleSignIn(
      clientId: kIsWeb ? AuthConfig.webClientId : null,
    );
  }

  @override
  Stream<User?> get authStateChanges => _firebaseAuth.authStateChanges();

  @override
  User? get currentUser => _firebaseAuth.currentUser;

  @override
  Future<Either<Failure, User>> signInWithEmailAndPassword({
    required String email,
    required String password,
  }) async {
    try {
      final credential = await _firebaseAuth.signInWithEmailAndPassword(
        email: email,
        password: password,
      );

      if (credential.user == null) {
        return Left(AuthFailure('Sign in failed'));
      }

      await _syncWithBackend(credential.user!);

      return Right(credential.user!);
    } on FirebaseAuthException catch (e) {
      return Left(AuthFailure(e.message ?? 'Authentication failed'));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, User>> signInWithGoogle() async {
    try {
      // 1. 觸發 Google 登入流程
      final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();

      if (googleUser == null) {
        // 用戶取消登入
        return Left(AuthFailure('Google sign in cancelled'));
      }

      // 2. 獲取認證詳細信息
      final GoogleSignInAuthentication googleAuth =
          await googleUser.authentication;

      // 3. 創建 Firebase 憑證
      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      // 4. 登入 Firebase
      final userCredential = await _firebaseAuth.signInWithCredential(
        credential,
      );

      if (userCredential.user == null) {
        return Left(AuthFailure('Google sign in failed'));
      }

      // 5. 與後端同步
      await _syncWithBackend(userCredential.user!);

      return Right(userCredential.user!);
    } catch (e) {
      String errorMessage = e.toString();
      // 嘗試解析常見的 Google API JSON 錯誤格式
      if (errorMessage.contains('"message":')) {
        try {
          // 簡單的正則提取，避免引入額外的 json Decode 複雜度（因為 e.toString() 通常包含類名）
          final RegExp regExp = RegExp(r'"message":\s*"(.*?)"');
          final match = regExp.firstMatch(errorMessage);
          if (match != null) {
            errorMessage = match.group(1) ?? errorMessage;
          }
        } catch (_) {}
      }
      return Left(AuthFailure(errorMessage));
    }
  }

  @override
  Future<Either<Failure, User>> signInWithApple() async {
    try {
      // 1. 生成 nonce（防重播攻擊）
      final rawNonce = _generateNonce();
      final nonce = _sha256ofString(rawNonce);

      // 2. 觸發 Apple 登入流程
      final appleCredential = await SignInWithApple.getAppleIDCredential(
        scopes: [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
        nonce: nonce,
      );

      // 3. 建立 Firebase OAuthCredential
      final oauthCredential = OAuthProvider('apple.com').credential(
        idToken: appleCredential.identityToken,
        rawNonce: rawNonce,
        accessToken: appleCredential.authorizationCode,
      );

      // 4. 登入 Firebase
      final userCredential = await _firebaseAuth.signInWithCredential(
        oauthCredential,
      );

      if (userCredential.user == null) {
        return Left(AuthFailure('Apple sign in failed'));
      }

      // 5. Apple 只在首次登入時回傳 displayName，更新到 Firebase
      final givenName = appleCredential.givenName;
      final familyName = appleCredential.familyName;
      if (givenName != null && userCredential.user!.displayName == null) {
        final fullName = [givenName, familyName].where((s) => s != null && s.isNotEmpty).join(' ');
        if (fullName.isNotEmpty) {
          await userCredential.user!.updateDisplayName(fullName);
          await userCredential.user!.reload();
        }
      }

      // 6. 與後端同步
      await _syncWithBackend(userCredential.user!, provider: 'apple');

      return Right(userCredential.user!);
    } on SignInWithAppleAuthorizationException catch (e) {
      if (e.code == AuthorizationErrorCode.canceled) {
        return Left(AuthFailure('Apple sign in cancelled'));
      }
      return Left(AuthFailure(e.message));
    } catch (e) {
      return Left(AuthFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, User>> signInWithCustomToken(String token) async {
    try {
      final credential = await _firebaseAuth.signInWithCustomToken(token);
      if (credential.user == null) {
        return Left(AuthFailure('Custom token sign in failed'));
      }
      await _syncWithBackend(credential.user!, provider: 'debug');
      return Right(credential.user!);
    } catch (e) {
      return Left(AuthFailure(e.toString()));
    }
  }

  String _generateNonce([int length = 32]) {
    const charset =
        '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._';
    final random = Random.secure();
    return List.generate(
      length,
      (_) => charset[random.nextInt(charset.length)],
    ).join();
  }

  String _sha256ofString(String input) {
    final bytes = utf8.encode(input);
    final digest = sha256.convert(bytes);
    return digest.toString();
  }

  Future<void> _syncWithBackend(User user, {String? provider}) async {
    try {
      String resolvedProvider;
      if (provider != null) {
        resolvedProvider = provider;
      } else {
        final providerData = user.providerData;
        if (providerData.any((p) => p.providerId == 'apple.com')) {
          resolvedProvider = 'apple';
        } else {
          resolvedProvider = 'google';
        }
      }
      final response = await _apiClient.signIn({
        'provider': resolvedProvider,
        'providerId': user.uid,
        'email': user.email,
        'name': user.displayName ?? user.email?.split('@')[0] ?? '訪客',
        'photo_url': user.photoURL,
      });

      print('✅ Backend sync successful: ${response['data']?['id']}');
    } catch (e) {
      print('❌ Backend sync failed: $e');
      // 必須拋出錯誤，讓登入流程知道同步失敗
      // 否則用戶會以為已登入，但後續所有 API 都會 401
      rethrow;
    }
  }

  @override
  Future<Either<Failure, void>> signOut() async {
    try {
      await _googleSignIn.signOut(); // 確保 Google 也登出
      await _firebaseAuth.signOut();
      return const Right(null);
    } catch (e) {
      return Left(AuthFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, String>> getIdToken() async {
    try {
      final user = _firebaseAuth.currentUser;
      if (user == null) {
        return Left(AuthFailure('No user logged in'));
      }
      final token = await user.getIdToken();
      return Right(token ?? '');
    } catch (e) {
      return Left(AuthFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, void>> deleteAccount() async {
    try {
      // 1. Soft-delete all user data on backend
      await _apiClient.deleteAccount();

      // 2. Delete Firebase account
      try {
        await _firebaseAuth.currentUser?.delete();
      } on FirebaseAuthException catch (e) {
        if (e.code == 'requires-recent-login') {
          // Backend data is already soft-deleted, but Firebase account remains
          // User needs to re-authenticate to complete deletion
          return Left(AuthFailure('requires-recent-login'));
        }
        rethrow;
      }

      // 3. Clear local auth state
      await _googleSignIn.signOut();

      return const Right(null);
    } on FirebaseAuthException catch (e) {
      return Left(AuthFailure(e.message ?? 'Failed to delete account'));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, void>> ensureBackendSync() async {
    try {
      final user = _firebaseAuth.currentUser;
      if (user == null) {
        return Left(AuthFailure('No user logged in'));
      }

      print('🔄 Ensuring backend sync for user: ${user.uid}');
      await _syncWithBackend(user);
      return const Right(null);
    } catch (e) {
      print('❌ Backend sync failed in ensureBackendSync: $e');
      return Left(ServerFailure(e.toString()));
    }
  }
}
