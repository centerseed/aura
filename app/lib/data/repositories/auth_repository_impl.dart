import 'package:dartz/dartz.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../../core/errors/failures.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/remote/api_client.dart';

import 'package:flutter/foundation.dart';
import '../../config/auth_config.dart';

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

  Future<void> _syncWithBackend(User user) async {
    try {
      final response = await _apiClient.signIn({
        'provider': 'google',
        'providerId': user.uid,
        'email': user.email,
        'name': user.displayName ?? user.email?.split('@')[0] ?? 'User',
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
