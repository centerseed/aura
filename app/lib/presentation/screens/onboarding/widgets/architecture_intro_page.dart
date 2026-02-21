import 'package:flutter/material.dart';
import 'package:app/core/theme/app_colors.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../providers/onboarding_provider.dart';

/// Page 2: 三層架構介紹
class ArchitectureIntroPage extends ConsumerWidget {
  const ArchitectureIntroPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedAreas = ref.watch(selectedAreasProvider);
    final customArea = ref.watch(customAreaProvider);

    // 取得第一個選中的身份作為範例
    final exampleArea = selectedAreas.isNotEmpty
        ? selectedAreas.first
        : (customArea.name.isNotEmpty ? customArea.name : '事業');

    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 標題
            const Text(
              '剛剛你定義了',
              style: TextStyle(
                color: Colors.white70,
                fontSize: 16,
              ),
            ),

            const SizedBox(height: 8),

            ShaderMask(
              shaderCallback: (bounds) => const LinearGradient(
                colors: [AppColors.brandTeal, AppColors.brandBlue],
              ).createShader(bounds),
              child: const Text(
                '「身份地圖」',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 32,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),

            const SizedBox(height: 16),

            Text(
              '現在看看如何組織一切',
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.7),
                fontSize: 16,
              ),
            ),

            const SizedBox(height: 48),

            // 三層架構視覺化
            _buildLayerCard(
              icon: Icons.folder_outlined,
              title: 'Area (身份)',
              subtitle: '你是誰？',
              example: exampleArea,
              color: AppColors.brandTeal,
              indent: 0,
            ),

            const SizedBox(height: 16),

            _buildLayerCard(
              icon: Icons.inventory_2_outlined,
              title: 'Project (專案)',
              subtitle: '在做什麼？',
              example: exampleArea == '事業' ? 'Mobile App' : '健康計畫',
              color: AppColors.statusActive,
              indent: 24,
            ),

            const SizedBox(height: 16),

            _buildLayerCard(
              icon: Icons.label_outline,
              title: 'Topic (主題)',
              subtitle: '怎麼做？',
              example: '功能開發',
              color: AppColors.statusInbox,
              indent: 48,
            ),

            const SizedBox(height: 48),

            // 核心訊息
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    AppColors.brandTeal.withValues(alpha: 0.1),
                    AppColors.brandBlue.withValues(alpha: 0.1),
                  ],
                ),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: AppColors.brandTeal.withValues(alpha: 0.3),
                ),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.brandTeal.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.auto_awesome,
                      color: AppColors.brandTeal,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Text(
                      'AI 會自動將你的想法分類到對應的身份、專案和主題',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.9),
                        fontSize: 15,
                        height: 1.5,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 100), // 為底部指示器留空間
          ],
        ),
      ),
    );
  }

  Widget _buildLayerCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required String example,
    required Color color,
    required double indent,
  }) {
    return Padding(
      padding: EdgeInsets.only(left: indent),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: color.withValues(alpha: 0.3),
          ),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                icon,
                color: color,
                size: 20,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        subtitle,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.5),
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '例如：$example',
                    style: TextStyle(
                      color: color.withValues(alpha: 0.8),
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
