import 'package:flutter/material.dart';
import 'package:app/core/theme/app_colors.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../domain/entities/coach_briefing.dart';
import '../../../providers/coach_provider.dart';
import 'coach_briefing_sheet.dart';

/// 教練簡報摘要卡片 - 嵌入「今日」Tab 頂部
class CoachBriefingCard extends ConsumerStatefulWidget {
  const CoachBriefingCard({super.key});

  @override
  ConsumerState<CoachBriefingCard> createState() => _CoachBriefingCardState();
}

class _CoachBriefingCardState extends ConsumerState<CoachBriefingCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _shimmerController;
  int _loadingTextIndex = 0;

  static const _loadingTexts = [
    '教練正在分析你的任務...',
    '分析行事曆...',
    '偵測衝突...',
    '制定今日計畫...',
  ];

  @override
  void initState() {
    super.initState();
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();

    // 載入資料
    Future.microtask(() {
      ref.read(coachBriefingProvider.notifier).loadLatest();
    });

    // 切換 loading 文字
    _startLoadingTextCycle();
  }

  void _startLoadingTextCycle() {
    Future.delayed(const Duration(seconds: 3), () {
      if (mounted) {
        setState(() {
          _loadingTextIndex = (_loadingTextIndex + 1) % _loadingTexts.length;
        });
        _startLoadingTextCycle();
      }
    });
  }

  @override
  void dispose() {
    _shimmerController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(coachBriefingProvider);
    final briefingType = ref.watch(currentBriefingTypeProvider);

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
      child: GestureDetector(
        onTap: state.hasData ? () => _showBriefingSheet(context) : null,
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 300),
          child: (state.isLoading || state.isAutoGenerating) && !state.hasData
              ? _buildSkeletonCard()
              : state.hasData
                  ? _buildContentCard(state, briefingType)
                  : state.error != null
                      ? _buildErrorCard(state.error!)
                      : _buildEmptyCard(briefingType),
        ),
      ),
    );
  }

  Widget _buildContentCard(CoachBriefingState state, BriefingType type) {
    final isMorning = type == BriefingType.morning;
    final briefing = state.briefing;
    final plan = state.plan;
    final accentColor =
        isMorning ? AppColors.statusInbox : AppColors.statusMaintain;

    final overdueCount = briefing?.overdueTasks.length ?? 0;
    final conflictCount = briefing?.conflicts.length ?? 0;
    final todayItems = plan?.items
            .where((i) => i.status == 'today' && !i.completed)
            .toList() ??
        [];
    final planItemCount = todayItems.length;
    final planMinutes =
        todayItems.fold(0, (sum, i) => sum + (i.estimatedMinutes ?? 0));

    return Container(
      key: const ValueKey('content'),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            accentColor.withValues(alpha: 0.12),
            accentColor.withValues(alpha: 0.04),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: accentColor.withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 標題列
          Row(
            children: [
              Text(
                isMorning ? '☀️' : '🌙',
                style: const TextStyle(fontSize: 20),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  isMorning ? '早安，今日重點' : '今日回顧',
                  style: TextStyle(
                    color: accentColor,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              if (state.isGenerating)
                SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: accentColor.withValues(alpha: 0.6),
                  ),
                ),
              Icon(
                Icons.chevron_right,
                color: Colors.white.withValues(alpha: 0.3),
                size: 20,
              ),
            ],
          ),
          // AI 摘要
          if (briefing?.summary != null && briefing!.summary.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              briefing.summary,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.7),
                fontSize: 13,
                height: 1.4,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          // 指標 chips
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              if (planItemCount > 0)
                _buildChip(
                  '📋 今日計畫 ($planItemCount項/$planMinutes分鐘)',
                  AppColors.statusActive,
                ),
              if (conflictCount > 0)
                _buildChip(
                  '⚠️ $conflictCount 個衝突',
                  AppColors.statusInbox,
                ),
              if (overdueCount > 0)
                _buildChip(
                  '🔴 $overdueCount 個逾期',
                  AppColors.error,
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildChip(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }

  Widget _buildSkeletonCard() {
    return Container(
      key: const ValueKey('skeleton'),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Shimmer title
          Row(
            children: [
              _shimmerBox(24, 24, isCircle: true),
              const SizedBox(width: 8),
              _shimmerBox(120, 16),
            ],
          ),
          const SizedBox(height: 12),
          _shimmerBox(double.infinity, 12),
          const SizedBox(height: 6),
          _shimmerBox(200, 12),
          const SizedBox(height: 12),
          Row(
            children: [
              _shimmerBox(100, 24),
              const SizedBox(width: 8),
              _shimmerBox(80, 24),
            ],
          ),
          const SizedBox(height: 12),
          // Loading text with pulse
          AnimatedBuilder(
            animation: _shimmerController,
            builder: (_, __) => Text(
              _loadingTexts[_loadingTextIndex],
              style: TextStyle(
                color: Colors.white.withValues(
                  alpha: 0.3 + (_shimmerController.value * 0.2),
                ),
                fontSize: 12,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _shimmerBox(double width, double height, {bool isCircle = false}) {
    return AnimatedBuilder(
      animation: _shimmerController,
      builder: (_, __) => Container(
        width: width == double.infinity ? null : width,
        height: height,
        decoration: BoxDecoration(
          color: Colors.white.withValues(
            alpha: 0.04 + (_shimmerController.value * 0.04),
          ),
          borderRadius:
              isCircle ? null : BorderRadius.circular(height / 2),
          shape: isCircle ? BoxShape.circle : BoxShape.rectangle,
        ),
      ),
    );
  }

  Widget _buildErrorCard(String error) {
    return Container(
      key: const ValueKey('error'),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.error.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppColors.error.withValues(alpha: 0.15),
        ),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: AppColors.error, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              '簡報載入失敗',
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.6),
                fontSize: 13,
              ),
            ),
          ),
          GestureDetector(
            onTap: () => ref.read(coachBriefingProvider.notifier).loadLatest(),
            child: Text(
              '重試',
              style: TextStyle(
                color: AppColors.onboardingIndigo.withValues(alpha: 0.8),
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyCard(BriefingType type) {
    final isMorning = type == BriefingType.morning;
    final accentColor =
        isMorning ? AppColors.statusInbox : AppColors.statusMaintain;

    return Container(
      key: const ValueKey('empty'),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: accentColor.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: accentColor.withValues(alpha: 0.15)),
      ),
      child: Row(
        children: [
          Text(
            isMorning ? '☀️' : '🌙',
            style: const TextStyle(fontSize: 18),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              isMorning ? '尚未生成今日晨報' : '尚未生成今日晚報',
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.5),
                fontSize: 13,
              ),
            ),
          ),
          GestureDetector(
            onTap: () =>
                ref.read(coachBriefingProvider.notifier).regenerateBriefing(),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: accentColor.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                '生成',
                style: TextStyle(
                  color: accentColor,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showBriefingSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const CoachBriefingSheet(),
    );
  }
}
