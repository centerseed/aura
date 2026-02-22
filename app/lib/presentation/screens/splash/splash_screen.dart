import 'package:flutter/material.dart';
import 'package:app/core/theme/app_colors.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../providers/auth_provider.dart';
import '../../../core/di/providers.dart' show areaRepositoryProvider;

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
      backgroundColor: Theme.of(context).colorScheme.surfaceContainerLow,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircularProgressIndicator(
              color: AppColors.primary,
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
                    backgroundColor: AppColors.primary,
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

      await result.fold(
        (failure) async {
          // 同步失敗，登出並跳轉登入頁
          debugPrint('Splash: Backend sync failed: ${failure.message}');
          authRepo.signOut();
          if (mounted && context.mounted) {
            context.go('/auth/signin');
          }
        },
        (_) async {
          // 同步成功，檢查是否有 Areas
          debugPrint('Splash: Backend sync successful, checking areas...');

          final areaRepo = ref.read(areaRepositoryProvider);
          final areasResult = await areaRepo.getAreas();

          final hasAreas = areasResult.fold(
            (failure) {
              debugPrint('Splash: Failed to get areas: ${failure.message}');
              return false;
            },
            (areas) {
              debugPrint('Splash: Found ${areas.length} areas');
              return areas.isNotEmpty;
            },
          );

          if (mounted && context.mounted) {
            if (hasAreas) {
              debugPrint('Splash: User has areas, going to Dashboard');
              context.go('/dashboard');
            } else {
              debugPrint('Splash: User has no areas, going to Onboarding');
              context.go('/onboarding');
            }
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
