import 'package:flutter/material.dart';

/// Zentropy 應用的統一顏色系統
class AppColors {
  AppColors._(); // 私有構造函數，防止實例化

  // ==================== Logo 品牌色 ====================

  /// Logo 上方 Z 左端 — 青藍色
  static const Color brandTeal   = Color(0xFF2DD4BF);

  /// Logo 上方 Z 右端 — 藍色
  static const Color brandBlue   = Color(0xFF3B82F6);

  /// Logo 下方 Z 左端 — 活力紫（非 AI 平板紫）
  static const Color brandPurple = Color(0xFFA855F7);

  /// Logo 下方 Z 右端 — 熱粉紅
  static const Color brandPink   = Color(0xFFF43F5E);

  // ==================== 品牌主色（來自 Logo）====================

  /// 主色 — Blue（Logo 上方 Z 右端藍色）
  static const Color primary = Color(0xFF5B7FF0);

  /// 主色亮版 — Blue（Logo 上方 Z 右端）
  static const Color primaryLight = Color(0xFF60A5FA);

  /// 深藍 - 用於深色漸變（保留舊名，改為藍色系）
  static const Color primaryDeep = Color(0xFF2563EB);
  static const Color primaryDark = Color(0xFF1D4ED8);

  /// 粉紅色系 - 用於漸變
  static const Color accentPink = Color(0xFFEC4899);
  static const Color accentPinkDark = Color(0xFFBE185D);

  // ==================== 背景色 ====================

  /// 深色背景 - 主要背景色
  static const Color darkBackground = Color(0xFF1c1c1e);

  /// 極深背景 - 用於模態框、全屏頁面
  static const Color deepBlack = Color(0xFF000000);

  /// GitHub 風格的深色系列
  static const Color githubDark = Color(0xFF0D1117);
  static const Color githubDarkLight = Color(0xFF161B22);

  /// 帶紫色調的深色
  static const Color purpleTinted = Color(0xFF1A1F2E);

  /// 靛藍藍色 - 柔和深色
  static const Color indigoBlue = Color(0xFF4B4B99);

  // ==================== 功能色 ====================

  /// 成功 / 完成 - 綠色
  static const Color success = Color(0xFF16A34A);
  static const Color successDark = Color(0xFF15803D);

  /// 錯誤 / 危險 - 紅色
  static const Color error = Color(0xFFEF4444);
  static const Color errorLight = Color(0xFFFF6B6B);

  /// 警告 - 黃色/橙色
  static const Color warning = Color(0xFFFBBF24);
  static const Color warningOrange = Color(0xFFF59E0B);

  /// 資訊 - 藍色
  static const Color info = Color(0xFF3B82F6);
  static const Color infoLight = Color(0xFF60A5FA);

  // ==================== Drawer / Task Status 顏色 ====================

  /// 規劃中 (Inbox) - Amber
  static const Color statusInbox = Color(0xFFF59E0B);

  /// 進行中 (Active) - Blue
  static const Color statusActive = Color(0xFF3B82F6);

  /// 維護中 (Maintain) - Violet/Purple
  static const Color statusMaintain = Color(0xFF8B5CF6);

  /// 參考資料 (Reference) - Green
  static const Color statusReference = Color(0xFF22C55E);

  /// 已歸檔 (Archive) - Slate
  static const Color statusArchive = Color(0xFF64748B);

  // ==================== Accent 擴充 ====================

  /// Emerald - 用於成功/完成動作
  static const Color accentEmerald = Color(0xFF10B981);

  // ==================== Onboarding 專用 ====================

  /// Onboarding 主色 — Blue（與 Logo 一致）
  static const Color onboardingIndigo = Color(0xFF5B7FF0);

  // ==================== 卡片 / 表面色 ====================

  /// 深色卡片背景 (iOS 風格)
  static const Color darkCard = Color(0xFF2C2C2E);

  // ==================== Pomodoro 計時器色彩 ====================

  /// 專注模式 - 紅橙色
  static const Color pomodoroFocus = Color(0xFFFF6B6B);

  /// 短休息 - 青色
  static const Color pomodoroShortBreak = Color(0xFF4ECDC4);

  /// 長休息 - 深青藍色
  static const Color pomodoroLongBreak = Color(0xFF1A535C);

  // ==================== 文字顏色 ====================

  /// 主要文字色 (根據主題自動調整)
  static Color textPrimary(BuildContext context) {
    return Theme.of(context).colorScheme.onSurface;
  }

  /// 次要文字色 (60% 透明度)
  static Color textSecondary(BuildContext context) {
    return Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6);
  }

  /// 提示文字色 (50% 透明度)
  static Color textHint(BuildContext context) {
    return Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5);
  }

  /// 禁用文字色 (45% 透明度)
  static Color textDisabled(BuildContext context) {
    return Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45);
  }

  // ==================== 卡片樣式顏色 ====================

  /// 緊急任務卡片背景色
  static Color urgentCardBackground(BuildContext context) {
    return Theme.of(context)
        .colorScheme
        .errorContainer
        .withValues(alpha: 0.1);
  }

  /// 緊急任務卡片邊框色
  static Color urgentCardBorder(BuildContext context) {
    return Theme.of(context).colorScheme.error.withValues(alpha: 0.3);
  }

  /// 進行中任務卡片背景色
  static Color ongoingCardBackground(BuildContext context) {
    return Theme.of(context)
        .colorScheme
        .primaryContainer
        .withValues(alpha: 0.1);
  }

  /// 進行中任務卡片邊框色
  static Color ongoingCardBorder(BuildContext context) {
    return Theme.of(context).colorScheme.primary.withValues(alpha: 0.3);
  }

  /// 普通任務卡片背景色
  static Color normalCardBackground(BuildContext context) {
    return Theme.of(context).colorScheme.surfaceContainer;
  }

  /// 普通任務卡片邊框色
  static Color normalCardBorder(BuildContext context) {
    return Theme.of(context)
        .colorScheme
        .outlineVariant
        .withValues(alpha: 0.3);
  }

  // ==================== 半透明覆蓋層 ====================

  /// 模態背景遮罩
  static Color modalOverlay(BuildContext context) {
    return purpleTinted.withValues(alpha: 0.8);
  }

  /// 輕度遮罩
  static const Color lightOverlay = Colors.black38;

  /// 中度遮罩
  static const Color mediumOverlay = Colors.black54;

  /// 重度遮罩
  static const Color heavyOverlay = Colors.black87;

  // ==================== 漸變色 ====================

  /// 主要漸變（Logo：Blue → Magenta）
  static const Gradient primaryGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF5B7FF0), Color(0xFFD946EF)],
  );

  /// 強調漸變 (紫色到粉色)
  static const Gradient accentGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [accentPink, accentPinkDark],
  );

  /// 深色背景漸變 (GitHub 風格)
  static const Gradient darkBackgroundGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [githubDark, githubDarkLight, purpleTinted],
  );
}
