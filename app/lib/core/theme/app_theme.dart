import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Zentropy 主題系統（唯一真實來源）
///
/// 所有 ThemeData 在此建構，元件只引用 AppTheme，不直接建立 ThemeData。
class AppTheme {
  AppTheme._();

  static ThemeData get light => ThemeData(
    colorScheme: ColorScheme.fromSeed(
      seedColor: AppColors.primary,
      brightness: Brightness.light,
    ),
    useMaterial3: true,
  );

  static ThemeData get dark => ThemeData(
    colorScheme: ColorScheme.fromSeed(
      seedColor: AppColors.primary,
      brightness: Brightness.dark,
    ).copyWith(
      surface: AppColors.darkBackground,
      surfaceContainerHighest: AppColors.darkCard,
    ),
    useMaterial3: true,
  );
}
