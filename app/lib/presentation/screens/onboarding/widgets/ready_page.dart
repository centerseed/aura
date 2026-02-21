import 'package:flutter/material.dart';
import 'package:app/core/theme/app_colors.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../providers/onboarding_provider.dart';
import '../../../../core/di/providers.dart';
import '../../../../domain/repositories/area_repository.dart';
import '../models/preset_area.dart';

/// Page 4: 準備開始
class ReadyPage extends ConsumerWidget {
  const ReadyPage({super.key});

  Future<void> _createAreas(BuildContext context, WidgetRef ref) async {
    final isSubmitting = ref.read(isSubmittingAreasProvider);
    if (isSubmitting) return;

    ref.read(isSubmittingAreasProvider.notifier).state = true;

    try {
      final selectedAreas = ref.read(selectedAreasProvider);
      final customArea = ref.read(customAreaProvider);
      final areaRepo = ref.read(areaRepositoryProvider);

      // 建立所有選中的預設身份
      for (final areaName in selectedAreas) {
        final preset = PresetArea.defaults.firstWhere(
          (a) => a.name == areaName,
        );
        await areaRepo.createArea(preset.name, preset.scope);
      }

      // 建立自定義身份（如果有）
      if (customArea.name.trim().isNotEmpty &&
          customArea.scope.trim().isNotEmpty) {
        await areaRepo.createArea(customArea.name, customArea.scope);
      }

      // 成功後導向 dashboard
      if (context.mounted) {
        context.go('/dashboard');
      }
    } catch (e) {
      // 顯示錯誤訊息
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('建立身份失敗：$e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      ref.read(isSubmittingAreasProvider.notifier).state = false;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedAreas = ref.watch(selectedAreasProvider);
    final customArea = ref.watch(customAreaProvider);
    final isSubmitting = ref.watch(isSubmittingAreasProvider);

    final hasCustomArea =
        customArea.name.trim().isNotEmpty && customArea.scope.trim().isNotEmpty;
    final totalAreas = selectedAreas.length + (hasCustomArea ? 1 : 0);

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            const Spacer(),

            // 慶祝圖標
            Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    AppColors.onboardingIndigo.withValues(alpha: 0.3),
                    AppColors.accentEmerald.withValues(alpha: 0.3),
                  ],
                ),
              ),
              child: const Icon(
                Icons.rocket_launch,
                size: 60,
                color: Colors.white,
              ),
            ),

            const SizedBox(height: 32),

            // 標題
            ShaderMask(
              shaderCallback: (bounds) => const LinearGradient(
                colors: [AppColors.onboardingIndigo, AppColors.accentEmerald],
              ).createShader(bounds),
              child: const Text(
                '準備就緒！',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 36,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),

            const SizedBox(height: 16),

            Text(
              '你已經完成設定',
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.7),
                fontSize: 18,
              ),
            ),

            const SizedBox(height: 48),

            // 設定摘要
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.1),
                ),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.check_circle,
                        color: AppColors.accentEmerald,
                        size: 24,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          '已設定 $totalAreas 個身份',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      ...selectedAreas.map((name) => _buildChip(name)),
                      if (hasCustomArea) _buildChip(customArea.name),
                    ],
                  ),
                ],
              ),
            ),

            const Spacer(),

            // 開始按鈕
            SizedBox(
              width: double.infinity,
              height: 56,
              child: FilledButton(
                onPressed: isSubmitting ? null : () => _createAreas(context, ref),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
                child: isSubmitting
                    ? const SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            '開始使用 Zentropy',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          SizedBox(width: 8),
                          Icon(Icons.arrow_forward),
                        ],
                      ),
              ),
            ),

            const SizedBox(height: 48),
          ],
        ),
      ),
    );
  }

  Widget _buildChip(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.onboardingIndigo.withValues(alpha: 0.2),
            AppColors.statusMaintain.withValues(alpha: 0.2),
          ],
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 14,
        ),
      ),
    );
  }
}
