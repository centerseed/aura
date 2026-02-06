import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import '../../../core/di/providers.dart' show analyticsServiceProvider, taskUnifiedRepositoryProvider, areaRepositoryProvider, productRepositoryProvider;
import '../../../data/repositories/unified/unified_repositories.dart';
import '../../providers/auth_provider.dart';

class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({super.key});

  @override
  ConsumerState<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends ConsumerState<SignInScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    super.dispose();
  }

  /// 刷新所有快取，清除之前可能的錯誤狀態
  void _refreshAllCaches() {
    // Task cache
    final taskRepo = ref.read(taskUnifiedRepositoryProvider);
    taskRepo.refresh();

    // Area cache
    final areaRepo = ref.read(areaRepositoryProvider) as AreaUnifiedRepository;
    areaRepo.refresh();

    // Product cache
    final productRepo = ref.read(productRepositoryProvider) as ProductUnifiedRepository;
    productRepo.refresh();
  }

  Future<void> _signInAnonymously() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final authRepo = ref.read(authRepositoryProvider);
    final result = await authRepo.signInAnonymously();

    if (mounted) {
      setState(() {
        _isLoading = false;
      });

      result.fold(
        (failure) {
          setState(() {
            _errorMessage = failure.message;
          });
        },
        (user) {
          final analytics = ref.read(analyticsServiceProvider);
          analytics.setUserId(user.uid);
          analytics.logLogin(method: 'anonymous');

          _refreshAllCaches();

          if (mounted) {
            context.go('/dashboard');
          }
        },
      );
    }
  }

  Future<void> _signInWithGoogle() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final authRepo = ref.read(authRepositoryProvider);
    final result = await authRepo.signInWithGoogle();

    if (mounted) {
      setState(() {
        _isLoading = false;
      });

      result.fold(
        (failure) {
          setState(() {
            _errorMessage = failure.message;
          });
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(failure.message),
              backgroundColor: Theme.of(context).colorScheme.error,
              behavior: SnackBarBehavior.floating,
            ),
          );
        },
        (user) {
          // Success! 記錄登入事件
          final analytics = ref.read(analyticsServiceProvider);
          analytics.setUserId(user.uid);
          analytics.logLogin(method: 'google');

          // 刷新所有快取，清除之前可能的 401 錯誤狀態
          _refreshAllCaches();

          if (mounted) {
            context.go('/dashboard');
          }
        },
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [colorScheme.primaryContainer, colorScheme.surface],
          ),
        ),
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Card(
              elevation: 8,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
              child: Padding(
                padding: const EdgeInsets.all(32.0),
                child: Form(
                  key: _formKey,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(24.0),
                        child: SvgPicture.asset(
                          'assets/icon.svg',
                          height: 100,
                          width: 100,
                        ),
                      ),
                      const SizedBox(height: 24),
                      Text(
                        'Zentropy',
                        style: theme.textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: colorScheme.onSurface,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '讓一切井然有序',
                        style: theme.textTheme.bodyLarge?.copyWith(
                          color: colorScheme.onSurfaceVariant,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 48),
                      if (_errorMessage != null)
                        Container(
                          padding: const EdgeInsets.all(12),
                          margin: const EdgeInsets.only(bottom: 16),
                          decoration: BoxDecoration(
                            color: colorScheme.errorContainer,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            _errorMessage!,
                            style: TextStyle(
                              color: colorScheme.onErrorContainer,
                            ),
                          ),
                        ),
                      _isLoading
                          ? const Center(child: CircularProgressIndicator())
                          : Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                FilledButton.icon(
                                  onPressed: _signInWithGoogle,
                                  style: FilledButton.styleFrom(
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 16,
                                    ),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                  ),
                                  icon: const Icon(Icons.login),
                                  label: const Text(
                                    'Sign in with Google',
                                    style: TextStyle(fontSize: 16),
                                  ),
                                ),
                                const SizedBox(height: 12),
                                TextButton(
                                  onPressed: _signInAnonymously,
                                  child: Text(
                                    '稍後再說，先逛逛',
                                    style: TextStyle(
                                      fontSize: 14,
                                      color: colorScheme.onSurfaceVariant,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                      const SizedBox(height: 24),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
