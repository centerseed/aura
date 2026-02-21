import 'package:flutter/material.dart';
import 'package:app/core/theme/app_colors.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'tabs/today_focus_tab.dart';
import 'tabs/overview_tab.dart';
import 'tabs/load_view_tab.dart';
import 'widgets/tutorial_overlay.dart';
import '../../providers/first_time_tutorial_provider.dart' show hasCompletedTutorialProvider, showTutorialProvider, tutorialStepProvider, TutorialStep;

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
    // 檢查是否需要顯示首次使用引導
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkAndShowTutorial();
    });
  }

  Future<void> _checkAndShowTutorial() async {
    final hasCompleted = await ref.read(hasCompletedTutorialProvider.future);
    if (!hasCompleted && mounted) {
      // 顯示引導
      ref.read(showTutorialProvider.notifier).state = true;
      ref.read(tutorialStepProvider.notifier).state =
          TutorialStep.welcome.index;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Scaffold(
          backgroundColor: AppColors.githubDark, // GitHub dark
          body: IndexedStack(
        index: _currentIndex,
        children: _tabs,
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: AppColors.githubDarkLight,
          border: Border(
            top: BorderSide(
              color: Colors.white.withValues(alpha: 0.08),
              width: 1,
            ),
          ),
        ),
        child: SafeArea(
          child: SizedBox(
            height: 64,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
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
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showQuickCapture(context),
        backgroundColor: AppColors.primary,
        elevation: 4,
        child: const Icon(Icons.add, color: Colors.white, size: 28),
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
    return GestureDetector(
      onTap: () => setState(() => _currentIndex = index),
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: 80,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              isSelected ? activeIcon : icon,
              color: isSelected
                  ? AppColors.primary
                  : Colors.white.withValues(alpha: 0.5),
              size: 24,
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                color: isSelected
                    ? AppColors.primary
                    : Colors.white.withValues(alpha: 0.5),
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
              ),
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
