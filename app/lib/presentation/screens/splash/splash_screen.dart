import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../providers/auth_provider.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  bool _isSyncing = false;

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authStateProvider);

    // 當認證狀態載入完成且有用戶時，先同步後端再跳轉
    if (!authState.isLoading && !authState.hasError && !_isSyncing) {
      if (authState.valueOrNull != null) {
        _syncAndNavigate();
      } else {
        // 沒有用戶，直接跳轉登入頁
        Future.microtask(() {
          if (!context.mounted) return;
          debugPrint('Splash: No user, going to Sign In');
          context.go('/auth/signin');
        });
      }
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0D1117),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircularProgressIndicator(
              color: Color(0xFF6C63FF),
            ),
            const SizedBox(height: 24),
            Text(
              _isSyncing
                  ? 'Syncing with backend...'
                  : (authState.isLoading
                      ? 'Initializing...'
                      : (authState.hasError
                          ? 'Error: ${authState.error}'
                          : 'Checking Auth...')),
              style: const TextStyle(
                color: Colors.white70,
                fontSize: 16,
              ),
            ),
            if (authState.hasError)
              Padding(
                padding: const EdgeInsets.only(top: 16.0),
                child: ElevatedButton(
                  onPressed: () => ref.refresh(authStateProvider),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF6C63FF),
                  ),
                  child: const Text('Retry'),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _syncAndNavigate() async {
    if (_isSyncing) return;

    setState(() => _isSyncing = true);

    try {
      debugPrint('Splash: User found, syncing with backend...');

      final authRepo = ref.read(authRepositoryProvider);
      final result = await authRepo.ensureBackendSync();

      result.fold(
        (failure) {
          // 同步失敗，登出並跳轉登入頁
          debugPrint('Splash: Backend sync failed: ${failure.message}');
          authRepo.signOut();
          if (mounted && context.mounted) {
            context.go('/auth/signin');
          }
        },
        (_) {
          // 同步成功，跳轉 Dashboard
          debugPrint('Splash: Backend sync successful, going to Dashboard');
          if (mounted && context.mounted) {
            context.go('/dashboard');
          }
        },
      );
    } catch (e) {
      debugPrint('Splash: Unexpected error: $e');
      if (mounted && context.mounted) {
        context.go('/auth/signin');
      }
    } finally {
      if (mounted) {
        setState(() => _isSyncing = false);
      }
    }
  }
}
