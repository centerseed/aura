import 'package:flutter/material.dart';
import 'package:app/core/theme/app_colors.dart';

/// Page 3: 里程碑介紹
class MilestoneIntroPage extends StatelessWidget {
  const MilestoneIntroPage({super.key});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 標題
            ShaderMask(
              shaderCallback: (bounds) => const LinearGradient(
                colors: [AppColors.onboardingIndigo, AppColors.statusMaintain],
              ).createShader(bounds),
              child: const Text(
                '什麼是里程碑？',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 32,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),

            const SizedBox(height: 24),

            // 說明文字
            Text(
              '里程碑是你為重要目標設定的截止日期',
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.9),
                fontSize: 18,
                fontWeight: FontWeight.w500,
                height: 1.5,
              ),
            ),

            const SizedBox(height: 48),

            // 三個重點說明
            _buildKeyPoint(
              number: '1',
              title: '你需要自己設定里程碑',
              description: '為重要的事情設定明確的完成日期',
              icon: Icons.edit_calendar,
              color: AppColors.onboardingIndigo,
            ),

            const SizedBox(height: 20),

            _buildKeyPoint(
              number: '2',
              title: '里程碑是時間錨點',
              description: '讓系統知道什麼時候必須完成',
              icon: Icons.anchor,
              color: AppColors.statusMaintain,
            ),

            const SizedBox(height: 20),

            _buildKeyPoint(
              number: '3',
              title: 'AI 會自動安排任務',
              description: '根據你的里程碑倒推任務時間',
              icon: Icons.auto_awesome,
              color: AppColors.accentEmerald,
            ),

            const SizedBox(height: 48),

            // 範例說明
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    AppColors.statusInbox.withValues(alpha: 0.15),
                    const Color(0xFFF97316).withValues(alpha: 0.15),
                  ],
                ),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: AppColors.statusInbox.withValues(alpha: 0.4),
                  width: 2,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: AppColors.statusInbox.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(
                          Icons.lightbulb_outline,
                          color: AppColors.statusInbox,
                          size: 24,
                        ),
                      ),
                      const SizedBox(width: 12),
                      const Text(
                        '舉例',
                        style: TextStyle(
                          color: AppColors.statusInbox,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Text(
                    '你設定：「3 月 1 日要完成 MVP Release」\n\nAI 會自動：為相關任務安排合適的完成時間，確保在 3 月 1 日前都能完成',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.9),
                      fontSize: 15,
                      height: 1.6,
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

  Widget _buildKeyPoint({
    required String number,
    required String title,
    required String description,
    required IconData icon,
    required Color color,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // 編號
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.2),
            shape: BoxShape.circle,
            border: Border.all(
              color: color.withValues(alpha: 0.4),
              width: 2,
            ),
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
                  Expanded(
                    child: Text(
                      title,
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                description,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.7),
                  fontSize: 14,
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
