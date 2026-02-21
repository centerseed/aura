import 'package:flutter/material.dart';
import 'package:app/core/theme/app_colors.dart';
import 'package:go_router/go_router.dart';

/// 頁面進度指示器
class PageIndicator extends StatelessWidget {
  final int currentPage;
  final int totalPages;
  final VoidCallback onNext;
  final VoidCallback onPrevious;
  final bool canProceed;

  const PageIndicator({
    super.key,
    required this.currentPage,
    required this.totalPages,
    required this.onNext,
    required this.onPrevious,
    required this.canProceed,
  });

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // 進度點
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(totalPages, (index) {
                final isActive = index == currentPage;
                final isPassed = index < currentPage;

                return AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  margin: const EdgeInsets.symmetric(horizontal: 4),
                  width: isActive ? 32 : 8,
                  height: 8,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(4),
                    gradient: isActive
                        ? const LinearGradient(
                            colors: [AppColors.brandTeal, AppColors.brandBlue],
                          )
                        : null,
                    color: isPassed
                        ? AppColors.onboardingIndigo.withValues(alpha: 0.5)
                        : Colors.white.withValues(alpha: 0.2),
                  ),
                );
              }),
            ),

            const SizedBox(height: 24),

            // 導航按鈕
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // 上一步按鈕
                if (currentPage > 0)
                  TextButton.icon(
                    onPressed: onPrevious,
                    icon: const Icon(Icons.arrow_back, size: 20),
                    label: const Text('上一步'),
                    style: TextButton.styleFrom(
                      foregroundColor: Colors.white70,
                    ),
                  )
                else
                  const SizedBox(width: 100),

                // 跳過按鈕
                if (currentPage < totalPages - 1)
                  TextButton(
                    onPressed: () => context.go('/dashboard'),
                    child: const Text('跳過'),
                    style: TextButton.styleFrom(
                      foregroundColor: Colors.white60,
                    ),
                  ),

                // 下一步按鈕
                if (currentPage < totalPages - 1)
                  FilledButton.icon(
                    onPressed: (currentPage == 0 && !canProceed) ? null : onNext,
                    icon: const Icon(Icons.arrow_forward, size: 20),
                    label: const Text('下一步'),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      disabledBackgroundColor: Colors.white.withValues(alpha: 0.1),
                    ),
                  )
                else
                  const SizedBox(width: 100),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
