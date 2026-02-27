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

  /// 使用 Apple ID 登入
  Future<Either<Failure, User>> signInWithApple();

  /// 使用 Custom Token 登入（debug 用）
  Future<Either<Failure, User>> signInWithCustomToken(String token);

  /// 確保當前用戶已與後端同步
  /// 在 app 啟動時如果發現有 Firebase 會話，應該調用此方法確保資料庫中有用戶記錄
  Future<Either<Failure, void>> ensureBackendSync();

  /// 刪除帳號（後端 soft-delete + Firebase 帳號刪除）
  Future<Either<Failure, void>> deleteAccount();
}
