import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/di/providers.dart' show analyticsServiceProvider;
import '../providers/auth_provider.dart';
import '../screens/auth/signin_screen.dart';
import '../screens/home/home_screen.dart';
import '../screens/focus/focus_screen.dart';
import '../screens/profile/profile_screen.dart';
import '../screens/splash/splash_screen.dart';
import '../screens/onboarding/onboarding_screen.dart';
import '../screens/home/widgets/quick_capture_sheet.dart';
import '../../domain/entities/task.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final authRepository = ref.watch(authRepositoryProvider);
  final analyticsService = ref.watch(analyticsServiceProvider);

  return GoRouter(
    initialLocation: '/splash',
    observers: [analyticsService.observer],
    refreshListenable: GoRouterRefreshStream(authRepository.authStateChanges),
    redirect: (context, state) {
      final authState = ref.read(authStateProvider);

      // 0. 如果正在初始加載中，強制留在 Splash 頁面等待
      if (authState.isLoading) {
        if (state.matchedLocation != '/splash') {
          return '/splash';
        }
        return null;
      }

      final isAuthenticated = authState.valueOrNull != null;
      final isGoingToAuth = state.matchedLocation.startsWith('/auth');
      final isOnboarding = state.matchedLocation == '/onboarding';
      final isSecureRoute =
          state.matchedLocation.startsWith('/dashboard') ||
          state.matchedLocation.startsWith('/quick-capture');
      final isSplash = state.matchedLocation == '/splash';

      // 1. 已登入
      if (isAuthenticated) {
        // 允許訪問 onboarding（由 splash screen 決定是否需要）
        if (isOnboarding) {
          return null;
        }
        // 如果在 Auth 頁面或 Splash 頁面，交由 splash screen 處理導向
        if (isGoingToAuth || isSplash) {
          return '/splash';
        }
      }

      // 2. 未登入
      if (!isAuthenticated) {
        // 如果要去安全頁面或 onboarding，跳轉 Login
        if (isSecureRoute || isOnboarding) {
          return '/auth/signin';
        }
        // 如果自 Splash 醒來發現沒登入，也去 Login
        if (isSplash) {
          return '/auth/signin';
        }
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/auth/signin',
        builder: (context, state) => const SignInScreen(),
      ),
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => const OnboardingScreen(),
      ),
      GoRoute(
        path: '/dashboard',
        builder: (context, state) => const HomeScreen(),
      ),
      GoRoute(
        path: '/profile',
        builder: (context, state) => const ProfileScreen(),
      ),
      GoRoute(
        path: '/quick-capture',
        builder: (context, state) => const QuickCaptureSheet(),
      ),
      GoRoute(
        path: '/focus/:taskId',
        builder: (context, state) {
          final task = state.extra as Task;
          return FocusScreen(task: task);
        },
      ),
    ],
  );
});

/// 將 Stream 轉換為 Listenable 以供 GoRouter 監聽刷新
class GoRouterRefreshStream extends ChangeNotifier {
  GoRouterRefreshStream(Stream<dynamic> stream) {
    notifyListeners();
    _subscription = stream.asBroadcastStream().listen(
      (dynamic _) => notifyListeners(),
    );
  }

  late final StreamSubscription<dynamic> _subscription;

  @override
  void dispose() {
    _subscription.cancel();
    super.dispose();
  }
}
