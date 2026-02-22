import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'tabs/today_focus_tab.dart';
import 'tabs/overview_tab.dart';
import 'tabs/load_view_tab.dart';
import 'widgets/tutorial_overlay.dart';
import '../../providers/first_time_tutorial_provider.dart'
    show
        hasCompletedTutorialProvider,
        showTutorialProvider,
        tutorialStepProvider,
        TutorialStep;

/// 主頁面 - 包含三個分頁
class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  int _currentIndex = 0;

  final List<Widget> _tabs = const [
    TodayFocusTab(),
    OverviewTab(),
    LoadViewTab(),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkAndShowTutorial();
    });
  }

  Future<void> _checkAndShowTutorial() async {
    final hasCompleted = await ref.read(hasCompletedTutorialProvider.future);
    if (!hasCompleted && mounted) {
      ref.read(showTutorialProvider.notifier).state = true;
      ref.read(tutorialStepProvider.notifier).state =
          TutorialStep.welcome.index;
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    return Stack(
      children: [
        Scaffold(
          body: IndexedStack(
            index: _currentIndex,
            children: _tabs,
          ),
        ),

        // iOS 26 風格浮動膠囊 Tab Bar
        Positioned(
          left: 0,
          right: 0,
          bottom: bottomPadding + 6,
          child: Material(
            type: MaterialType.transparency,
            child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // 主 Tab Bar 膠囊
              ClipRRect(
                borderRadius: BorderRadius.circular(28),
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
                  child: Container(
                    height: 62,
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    decoration: BoxDecoration(
                      color: isDark
                          ? colorScheme.surfaceContainer.withValues(alpha: 0.7)
                          : colorScheme.surface.withValues(alpha: 0.75),
                      borderRadius: BorderRadius.circular(28),
                      border: Border.all(
                        color: isDark
                            ? Colors.white.withValues(alpha: 0.12)
                            : Colors.black.withValues(alpha: 0.08),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.12),
                          blurRadius: 20,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _buildNavItem(
                          index: 0,
                          icon: Icons.today_outlined,
                          activeIcon: Icons.today,
                          label: '今日',
                        ),
                        _buildNavItem(
                          index: 1,
                          icon: Icons.dashboard_outlined,
                          activeIcon: Icons.dashboard,
                          label: '總覽',
                        ),
                        _buildNavItem(
                          index: 2,
                          icon: Icons.insights_outlined,
                          activeIcon: Icons.insights,
                          label: '負載',
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              // + 按鈕（獨立圓形，類似 iOS 26 搜尋按鈕）
              ClipOval(
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
                  child: GestureDetector(
                    onTap: () => _showQuickCapture(context),
                    child: Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        color: colorScheme.primary.withValues(alpha: 0.85),
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: colorScheme.primary.withValues(alpha: 0.3),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Icon(
                        Icons.add_rounded,
                        color: colorScheme.onPrimary,
                        size: 26,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
          ),
        ),

        // 首次使用引導 Overlay
        const TutorialOverlay(),
      ],
    );
  }

  Widget _buildNavItem({
    required int index,
    required IconData icon,
    required IconData activeIcon,
    required String label,
  }) {
    final isSelected = _currentIndex == index;
    final colorScheme = Theme.of(context).colorScheme;
    final selectedColor = colorScheme.primary;
    final unselectedColor = colorScheme.onSurfaceVariant;

    return GestureDetector(
      onTap: () => setState(() => _currentIndex = index),
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOutCubic,
        padding: EdgeInsets.symmetric(
          horizontal: isSelected ? 16 : 14,
          vertical: 8,
        ),
        decoration: BoxDecoration(
          color: isSelected
              ? selectedColor.withValues(alpha: 0.12)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(22),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              isSelected ? activeIcon : icon,
              color: isSelected ? selectedColor : unselectedColor,
              size: 22,
            ),
            // 選中時展開顯示 label
            AnimatedSize(
              duration: const Duration(milliseconds: 250),
              curve: Curves.easeOutCubic,
              child: isSelected
                  ? Padding(
                      padding: const EdgeInsets.only(left: 6),
                      child: Text(
                        label,
                        style: TextStyle(
                          color: selectedColor,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    )
                  : const SizedBox.shrink(),
            ),
          ],
        ),
      ),
    );
  }

  void _showQuickCapture(BuildContext context) {
    context.push('/quick-capture');
  }
}
