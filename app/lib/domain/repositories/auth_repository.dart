import 'package:dartz/dartz.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../core/errors/failures.dart';

abstract class AuthRepository {
  /// 監聽認證狀態變
  Stream<User?> get authStateChanges;

  /// 獲取當前用戶
  User? get currentUser;

  /// 使用 Email 和密碼登入
  Future<Either<Failure, User>> signInWithEmailAndPassword({
    required String email,
    required String password,
  });

  /// 登出
  Future<Either<Failure, void>> signOut();

  /// 獲取當前用戶的 ID Token
  Future<Either<Failure, String>> getIdToken();

  /// 使用 Google 登入
  Future<Either<Failure, User>> signInWithGoogle();
}
