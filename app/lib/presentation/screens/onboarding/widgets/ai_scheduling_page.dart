import 'package:flutter/material.dart';
import 'package:app/core/theme/app_colors.dart';

/// Page 3: AI 自動排程演示
class AiSchedulingPage extends StatelessWidget {
  const AiSchedulingPage({super.key});

  @override
  Widget build(BuildContext context) {
    final onSurface = Theme.of(context).colorScheme.onSurface;
    final cardBackground = Theme.of(context).colorScheme.surfaceContainerHighest;

    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 標題
            ShaderMask(
              shaderCallback: (bounds) => const LinearGradient(
                colors: [AppColors.brandTeal, AppColors.accentEmerald],
              ).createShader(bounds),
              child: const Text(
                'AI 會自動整理\n並安排時間',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 32,
                  fontWeight: FontWeight.bold,
                  height: 1.2,
                ),
              ),
            ),

            const SizedBox(height: 16),

            Text(
              '你只需記錄想法，分類和時間都交給 AI',
              style: TextStyle(
                color: onSurface.withValues(alpha: 0.8),
                fontSize: 16,
              ),
            ),

            const SizedBox(height: 48),

            // 流程演示
            _buildFlowStep(
              number: '1',
              title: '你輸入',
              content: '完成 OAuth 登入功能',
              icon: Icons.edit_outlined,
              color: AppColors.brandTeal,
              onSurface: onSurface,
              cardBackground: cardBackground,
            ),

            const SizedBox(height: 16),
            _buildArrow(onSurface),
            const SizedBox(height: 16),

            _buildFlowStep(
              number: '2',
              title: 'AI 整理與分析',
              content: '''自動分類: 事業 → Mobile App → 功能開發
識別里程碑: MVP Release (2026-03-01)
評估複雜度: 中等，預留 5 天
計算時間: 2026-02-24''',
              icon: Icons.psychology_outlined,
              color: AppColors.statusMaintain,
              onSurface: onSurface,
              cardBackground: cardBackground,
            ),

            const SizedBox(height: 16),
            _buildArrow(onSurface),
            const SizedBox(height: 16),

            _buildFlowStep(
              number: '3',
              title: '推斷結果',
              content: '''✓ 推斷完成日期：2026-02-24
✓ 已自動排程至合適日期''',
              icon: Icons.check_circle_outline,
              color: AppColors.accentEmerald,
              onSurface: onSurface,
              cardBackground: cardBackground,
              isResult: true,
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
                    AppColors.accentEmerald.withValues(alpha: 0.1),
                    const Color(0xFF06B6D4).withValues(alpha: 0.1),
                  ],
                ),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: AppColors.accentEmerald.withValues(alpha: 0.3),
                ),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.accentEmerald.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.event_available,
                      color: AppColors.accentEmerald,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Text(
                      '不用手動排程，AI 會根據里程碑自動推斷最適合的完成時間',
                      style: TextStyle(
                        color: onSurface.withValues(alpha: 0.9),
                        fontSize: 15,
                        height: 1.5,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 120), // 為底部指示器留空間
          ],
        ),
      ),
    );
  }

  Widget _buildFlowStep({
    required String number,
    required String title,
    required String content,
    required IconData icon,
    required Color color,
    required Color onSurface,
    required Color cardBackground,
    bool isResult = false,
  }) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: isResult
            ? LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  color.withValues(alpha: 0.15),
                  color.withValues(alpha: 0.08),
                ],
              )
            : null,
        color: isResult ? null : cardBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: color.withValues(alpha: 0.3),
          width: isResult ? 2 : 1,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 編號圖標
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.2),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                number,
                style: TextStyle(
                  color: color,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),

          const SizedBox(width: 16),

          // 內容
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(icon, color: color, size: 20),
                    const SizedBox(width: 8),
                    Text(
                      title,
                      style: TextStyle(
                        color: color,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  content,
                  style: TextStyle(
                    color: onSurface.withValues(alpha: 0.8),
                    fontSize: 14,
                    height: 1.5,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildArrow(Color onSurface) {
    return Center(
      child: Icon(
        Icons.arrow_downward,
        color: onSurface.withValues(alpha: 0.3),
        size: 24,
      ),
    );
  }
}
