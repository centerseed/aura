import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../providers/auth_provider.dart';

class SplashScreen extends ConsumerWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);

    // 簡單起見，我們在 build 中檢查狀態並導航
    if (!authState.isLoading && !authState.hasError) {
      Future.microtask(() {
        if (!context.mounted) return;

        if (authState.valueOrNull != null) {
          debugPrint('Splash: User found, going to Dashboard');
          context.go('/dashboard');
        } else {
          debugPrint('Splash: No user, going to Sign In');
          context.go('/auth/signin');
        }
      });
    }

    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: 16),
            Text(
              authState.isLoading
                  ? 'Initializing...'
                  : (authState.hasError
                        ? 'Error: ${authState.error}'
                        : 'Checking Auth...'),
              style: const TextStyle(color: Colors.grey),
            ),
            if (authState.hasError)
              Padding(
                padding: const EdgeInsets.only(top: 16.0),
                child: ElevatedButton(
                  onPressed: () => ref.refresh(authStateProvider),
                  child: const Text('Retry'),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
