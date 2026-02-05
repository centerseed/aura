import 'package:flutter/foundation.dart';
import 'package:firebase_auth/firebase_auth.dart'; // Add implicit import for Persistence/FirebaseAuth
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/di/providers.dart';
import 'firebase_options.dart';
import 'presentation/providers/app_lifecycle_provider.dart';
import 'presentation/routes/app_router.dart';

void main() async {
  try {
    // 確保 Flutter 綁定初始化
    WidgetsFlutterBinding.ensureInitialized();

    // 初始化 Firebase
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );

    // 只有 Web 需要設定持久化，Mobile 預設就是本地持久化且調用此 API 可能出錯
    if (kIsWeb) {
      await FirebaseAuth.instance.setPersistence(Persistence.LOCAL);
    }

    // 初始化依賴注入 (Hive boxes)
    final overrides = await initializeDependencies();

    // 啟動應用並注入 Hive box overrides
    runApp(
      ProviderScope(
        overrides: overrides,
        child: const ZentropyApp(),
      ),
    );
  } catch (e, stack) {
    debugPrint('Fatal error during initialization: $e');
    debugPrint(stack.toString());

    // 如果發生錯誤，仍然嘗試啟動一個顯示錯誤的 App，而不是就此空白
    runApp(
      MaterialApp(
        home: Scaffold(
          body: Center(
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Text('App 啟動失敗: $e\n\n如果持續發生，請嘗試重新安裝。'),
            ),
          ),
        ),
      ),
    );
  }
}

class ZentropyApp extends ConsumerWidget {
  const ZentropyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // 初始化 App 生命週期監聽（從背景回前景時自動刷新資料）
    ref.watch(appLifecycleProvider);

    final router = ref.watch(appRouterProvider);

    return MaterialApp.router(
      title: 'Zentropy',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF667eea),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
      ),
      darkTheme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF667eea),
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      themeMode: ThemeMode.system,
      locale: const Locale('zh', 'TW'),
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [
        Locale('zh', 'TW'),
        Locale('en', 'US'),
      ],
      localeResolutionCallback: (locale, supportedLocales) {
        for (final supportedLocale in supportedLocales) {
          if (supportedLocale.languageCode == locale?.languageCode &&
              supportedLocale.countryCode == locale?.countryCode) {
            return supportedLocale;
          }
        }
        return const Locale('zh', 'TW');
      },
      routerConfig: router,
    );
  }
}
