import 'package:flutter/material.dart';
import 'package:app/core/theme/app_colors.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/di/providers.dart';
import '../../../../core/utils/date_utils.dart' as utils;
import '../../../../domain/entities/daily_plan.dart';
import '../../../../domain/entities/task.dart';
import '../../../../application/use_cases/update_sub_item_use_case.dart';
import '../../../../application/use_cases/update_task_details_use_case.dart';
import '../../../providers/coach_provider.dart';
import '../../../providers/task_provider.dart';
import '../widgets/coach_briefing_card.dart';
import '../widgets/task_detail_bottom_sheet.dart';

/// 今日焦點分頁 - 顯示最近 10 個任務並預設展開 subitems
class TodayFocusTab extends ConsumerStatefulWidget {
  const TodayFocusTab({super.key});

  @override
  ConsumerState<TodayFocusTab> createState() => _TodayFocusTabState();
}

class _TodayFocusTabState extends ConsumerState<TodayFocusTab> {
  // 追蹤樂觀更新的 subitem 狀態 (taskId:subItemId -> completed)
  final Map<String, bool> _optimisticSubItemStates = {};

  // 追蹤已完成的任務 ID（樂觀更新）
  final Set<String> _completedTaskIds = {};

  // 追蹤 loading 中的 subitem
  final Set<String> _loadingSubItemIds = {};

  // 追蹤 loading 中的 plan item
  final Set<String> _loadingPlanItemIds = {};

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final taskState = ref.watch(activeTasksProvider);
    final completedTodayAsync = ref.watch(completedTodayTasksProvider);
    final dailyProgress = ref.watch(dailyProgressProvider);

    return SafeArea(
      child: RefreshIndicator(
        onRefresh: () async {
          await refreshTasks(ref);
          ref.invalidate(completedTodayTasksProvider);
          ref.read(coachBriefingProvider.notifier).loadLatest();
        },
        color: AppColors.primary,
        backgroundColor: colorScheme.surfaceContainer,
        child: CustomScrollView(
          slivers: [
            // Header with refresh indicator
            SliverToBoxAdapter(
              child: _buildHeader(dailyProgress, isRefreshing: taskState.isRefreshing),
            ),
            // 教練簡報卡片
            const SliverToBoxAdapter(
              child: CoachBriefingCard(),
            ),
            // 根據是否有 plan 決定顯示內容
            ..._buildPlanOrFallback(taskState, completedTodayAsync),
            // 底部留白
            const SliverToBoxAdapter(
              child: SizedBox(height: 100),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(DailyProgress progress, {bool isRefreshing = false}) {
    final colorScheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      decoration: isDark
          ? null
          : BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  AppColors.brandTeal.withValues(alpha: 0.07),
                  AppColors.brandBlue.withValues(alpha: 0.04),
                  colorScheme.surface.withValues(alpha: 0.0),
                ],
                stops: const [0.0, 0.5, 1.0],
              ),
              borderRadius: const BorderRadius.only(
                bottomLeft: Radius.circular(24),
                bottomRight: Radius.circular(24),
              ),
            ),
      child: Padding(
      padding: const EdgeInsets.all(20.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  ShaderMask(
                    blendMode: BlendMode.srcIn,
                    shaderCallback: (bounds) => LinearGradient(
                      colors: isDark
                          ? [AppColors.brandTeal, AppColors.brandBlue]
                          : [AppColors.primaryDeep, AppColors.brandBlue],
                    ).createShader(bounds),
                    child: const Text(
                      'Zentropy',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  if (isRefreshing) ...[
                    const SizedBox(width: 12),
                    SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: colorScheme.onSurface.withValues(alpha: 0.54),
                      ),
                    ),
                  ],
                ],
              ),
              Container(
                decoration: BoxDecoration(
                  color: colorScheme.onSurface.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: colorScheme.onSurface.withValues(alpha: 0.1),
                  ),
                ),
                child: IconButton(
                  icon: Icon(Icons.person_outline, color: colorScheme.onSurfaceVariant),
                  onPressed: () => context.push('/profile'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          // 今日進度卡片
          _buildProgressCard(progress),
        ],
      ),
      ),
    );
  }

  Widget _buildProgressCard(DailyProgress progress) {
    final colorScheme = Theme.of(context).colorScheme;
    final percentage = progress.total > 0
        ? (progress.completed / progress.total * 100).round()
        : 0;
    final progressValue = progress.total > 0
        ? progress.completed / progress.total
        : 0.0;

    // 根據進度選色
    final progressColor = progressValue >= 1.0
        ? AppColors.accentEmerald // 完成：翠綠
        : progressValue >= 0.5
            ? AppColors.success // 過半：淺綠
            : AppColors.onboardingIndigo; // 未過半：靛藍

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            progressColor.withValues(alpha: 0.15),
            progressColor.withValues(alpha: 0.05),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: progressColor.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: progressColor.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(
                        progressValue >= 1.0
                            ? Icons.celebration
                            : Icons.trending_up,
                        color: progressColor,
                        size: 16,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      '今日進度',
                      style: TextStyle(
                        color: colorScheme.onSurface.withValues(alpha: 0.7),
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      '${progress.completed}/${progress.total}',
                      style: TextStyle(
                        color: progressColor,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                // 進度條
                ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: LinearProgressIndicator(
                    value: progressValue,
                    minHeight: 8,
                    backgroundColor: colorScheme.onSurface.withValues(alpha: 0.08),
                    valueColor: AlwaysStoppedAnimation<Color>(progressColor),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 20),
          // 百分比圓圈
          SizedBox(
            width: 60,
            height: 60,
            child: Stack(
              children: [
                SizedBox(
                  width: 60,
                  height: 60,
                  child: CircularProgressIndicator(
                    value: progressValue,
                    strokeWidth: 5,
                    strokeCap: StrokeCap.round,
                    backgroundColor: colorScheme.onSurface.withValues(alpha: 0.08),
                    valueColor: AlwaysStoppedAnimation<Color>(progressColor),
                  ),
                ),
                Center(
                  child: Text(
                    '$percentage%',
                    style: TextStyle(
                      color: colorScheme.onSurface,
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildPlanOrFallback(
    TaskDataState taskState,
    AsyncValue<TaskDataState> completedTodayAsync,
  ) {
    final colorScheme = Theme.of(context).colorScheme;
    final coachState = ref.watch(coachBriefingProvider);
    final plan = coachState.plan;

    if (plan != null && plan.items.isNotEmpty) {
      return [
        // 昨日快取提示條
        if (coachState.isStale)
          SliverToBoxAdapter(
            child: _buildStaleUpdateBanner(),
          ),
        ..._buildPlanBasedContent(plan, completedTodayAsync),
      ];
    }

    // 背景自動生成中（無快取）→ 顯示 plan 骨架屏
    if (coachState.isAutoGenerating) {
      return [
        SliverToBoxAdapter(
          child: _buildPlanSkeleton(),
        ),
      ];
    }

    // Fallback: 無 plan 時顯示原本的 active tasks
    return [
      // 標題
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 4,
                    height: 20,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [AppColors.brandTeal, AppColors.brandBlue],
                      ),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    '最近任務',
                    style: TextStyle(
                      color: colorScheme.onSurface,
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.onboardingIndigo.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: AppColors.onboardingIndigo.withValues(alpha: 0.15),
                  ),
                ),
                child: Text(
                  '💡 生成今日計畫以獲得 AI 排序建議',
                  style: TextStyle(
                    color: colorScheme.onSurface.withValues(alpha: 0.5),
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
      if (taskState.showLoading)
        const SliverToBoxAdapter(
          child: Center(
            child: Padding(
              padding: EdgeInsets.all(48.0),
              child: CircularProgressIndicator(color: AppColors.primary),
            ),
          ),
        )
      else if (taskState.hasError)
        SliverToBoxAdapter(child: _buildErrorState(taskState.error!))
      else if (taskState.showContent)
        _buildRecentTasks(taskState.tasks!),
      completedTodayAsync.when(
        data: (state) => state.hasData
            ? _buildCompletedSection(state.tasks!)
            : const SliverToBoxAdapter(child: SizedBox.shrink()),
        loading: () => const SliverToBoxAdapter(child: SizedBox.shrink()),
        error: (_, __) => const SliverToBoxAdapter(child: SizedBox.shrink()),
      ),
    ];
  }

  List<Widget> _buildPlanBasedContent(
    DailyPlan plan,
    AsyncValue<TaskDataState> completedTodayAsync,
  ) {
    final colorScheme = Theme.of(context).colorScheme;
    final todayItems = plan.items
        .where((i) => i.status == 'today' && !i.completed && !i.deferred)
        .toList();
    final overflowItems = plan.items
        .where((i) => i.status == 'overflow' && !i.completed && !i.deferred)
        .toList();
    final completedPlanItems = plan.items.where((i) => i.completed).toList();

    final todayMinutes =
        todayItems.fold(0, (sum, i) => sum + (i.estimatedMinutes ?? 0));

    return [
      // 今日計畫標題 + capacity chips
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 4,
                    height: 20,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [AppColors.statusActive, AppColors.onboardingIndigo],
                      ),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    '今日計畫',
                    style: TextStyle(
                      color: colorScheme.onSurface,
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const Spacer(),
                  if (todayItems.isNotEmpty)
                    Text(
                      '${todayItems.length}項 · $todayMinutes分鐘',
                      style: TextStyle(
                        color: colorScheme.onSurface.withValues(alpha: 0.4),
                        fontSize: 12,
                      ),
                    ),
                ],
              ),
              if (plan.availableMinutes != null) ...[
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  children: [
                    _buildCapacityChip(
                      '可用 ${plan.availableMinutes}分',
                      AppColors.accentEmerald,
                    ),
                    if (plan.meetingMinutes != null && plan.meetingMinutes! > 0)
                      _buildCapacityChip(
                        '會議 ${plan.meetingMinutes}分',
                        AppColors.statusInbox,
                      ),
                    _buildCapacityChip(
                      '已排 ${plan.plannedMinutes ?? plan.totalEstimatedMinutes}分',
                      AppColors.statusActive,
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
      // Today plan items
      if (todayItems.isNotEmpty)
        SliverList(
          delegate: SliverChildBuilderDelegate(
            (context, index) =>
                _buildPlanItemCard(todayItems[index]),
            childCount: todayItems.length,
          ),
        ),
      if (todayItems.isEmpty)
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            child: Text(
              '今日計畫已全數完成！',
              style: TextStyle(
                color: colorScheme.onSurface.withValues(alpha: 0.4),
                fontSize: 14,
              ),
              textAlign: TextAlign.center,
            ),
          ),
        ),
      // Overflow divider + items
      if (overflowItems.isNotEmpty) ...[
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 4),
            child: Row(
              children: [
                Expanded(
                  child: Container(
                    height: 1,
                    color: colorScheme.onSurface.withValues(alpha: 0.08),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  child: Text(
                    '明後天代辦',
                    style: TextStyle(
                      color: colorScheme.onSurface.withValues(alpha: 0.35),
                      fontSize: 12,
                    ),
                  ),
                ),
                Expanded(
                  child: Container(
                    height: 1,
                    color: colorScheme.onSurface.withValues(alpha: 0.08),
                  ),
                ),
              ],
            ),
          ),
        ),
        SliverList(
          delegate: SliverChildBuilderDelegate(
            (context, index) =>
                _buildPlanItemCard(overflowItems[index]),
            childCount: overflowItems.length,
          ),
        ),
      ],
      // 今日完成（plan completed + completed tasks）
      if (completedPlanItems.isNotEmpty)
        SliverToBoxAdapter(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 8),
                child: Row(
                  children: [
                    const Icon(
                      Icons.check_circle,
                      color: AppColors.success,
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '今日完成 (${completedPlanItems.length})',
                      style: const TextStyle(
                        color: AppColors.success,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              ...completedPlanItems
                  .map((item) => _buildCompletedPlanItemCard(item)),
            ],
          ),
        ),
    ];
  }

  Widget _buildCapacityChip(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        text,
        style:
            TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w500),
      ),
    );
  }

  Widget _buildPlanItemCard(DailyPlanItem item) {
    final colorScheme = Theme.of(context).colorScheme;
    final isOverflow = item.status == 'overflow';
    final accentColor =
        isOverflow ? AppColors.statusArchive : AppColors.onboardingIndigo;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 3),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: accentColor.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: accentColor.withValues(alpha: 0.12)),
        ),
        child: Row(
          children: [
            // 完成勾選圈
            GestureDetector(
              onTap: _loadingPlanItemIds.contains(item.id)
                  ? null
                  : () {
                      HapticFeedback.lightImpact();
                      _confirmCompletePlanItem(item);
                    },
              child: _loadingPlanItemIds.contains(item.id)
                  ? SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: accentColor,
                      ),
                    )
                  : Container(
                      width: 22,
                      height: 22,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: accentColor.withValues(alpha: 0.4),
                          width: 1.5,
                        ),
                      ),
                    ),
            ),
            const SizedBox(width: 10),
            // 內容（點擊開啟詳情）
            Expanded(
              child: GestureDetector(
                onTap: () => _openPlanItemDetail(item),
                behavior: HitTestBehavior.opaque,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        if (item.itemType == 'subtask') ...[
                          Text(
                            '↳ ',
                            style: TextStyle(
                              color: colorScheme.onSurface.withValues(alpha: 0.35),
                              fontSize: 14,
                            ),
                          ),
                        ],
                        Expanded(
                          child: Text(
                            item.content,
                            style: TextStyle(
                              color: item.itemType == 'subtask'
                                  ? colorScheme.onSurface.withValues(alpha: 0.65)
                                  : colorScheme.onSurface.withValues(alpha: 0.85),
                              fontSize: 14,
                              fontWeight: FontWeight.w400,
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (item.areaName != null || item.productName != null || (item.itemType == 'subtask' && item.taskName != null))
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          [
                            item.areaName,
                            item.productName,
                            if (item.itemType == 'subtask')
                              item.taskName,
                          ].whereType<String>().join(' > '),
                          style: TextStyle(
                            color: colorScheme.onSurface.withValues(alpha: 0.3),
                            fontSize: 11,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            // 預估時間
            if (item.estimatedMinutes != null)
              Text(
                '${item.estimatedMinutes}分',
                style: TextStyle(
                  color: colorScheme.onSurface.withValues(alpha: 0.35),
                  fontSize: 11,
                ),
              ),
            const SizedBox(width: 4),
            // Today/Overflow 切換按鈕
            GestureDetector(
              onTap: () {
                HapticFeedback.lightImpact();
                final newStatus = isOverflow ? 'today' : 'overflow';
                ref.read(coachBriefingProvider.notifier).updatePlanItem(
                      itemId: item.id,
                      status: newStatus,
                    );
              },
              child: Icon(
                isOverflow ? Icons.north : Icons.south,
                size: 18,
                color: isOverflow
                    ? AppColors.statusActive
                    : colorScheme.onSurface.withValues(alpha: 0.35),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCompletedPlanItemCard(DailyPlanItem item) {
    final colorScheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 2),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          children: [
            Icon(
              Icons.check_circle,
              color: AppColors.success.withValues(alpha: 0.6),
              size: 18,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: GestureDetector(
                onTap: () => _openPlanItemDetail(item),
                behavior: HitTestBehavior.opaque,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        if (item.itemType == 'subtask')
                          Text(
                            '↳ ',
                            style: TextStyle(
                              color: colorScheme.onSurface.withValues(alpha: 0.2),
                              fontSize: 14,
                            ),
                          ),
                        Expanded(
                          child: Text(
                            item.content,
                            style: TextStyle(
                              color: colorScheme.onSurface.withValues(alpha: 0.4),
                              fontSize: 14,
                              decoration: TextDecoration.lineThrough,
                              decorationColor: colorScheme.onSurface.withValues(alpha: 0.3),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    if (item.itemType == 'subtask' && item.taskName != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 1),
                        child: Text(
                          [item.areaName, item.productName, item.taskName].whereType<String>().join(' > '),
                          style: TextStyle(
                            color: colorScheme.onSurface.withValues(alpha: 0.2),
                            fontSize: 11,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStaleUpdateBanner() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.statusInbox.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: AppColors.statusInbox.withValues(alpha: 0.15),
          ),
        ),
        child: Row(
          children: [
            SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppColors.statusInbox.withValues(alpha: 0.7),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              '正在更新今日計畫...',
              style: TextStyle(
                color: AppColors.statusInbox.withValues(alpha: 0.8),
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlanSkeleton() {
    final colorScheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 標題骨架
          Row(
            children: [
              Container(
                width: 4,
                height: 20,
                decoration: BoxDecoration(
                  color: colorScheme.onSurface.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 10),
              Container(
                width: 80,
                height: 18,
                decoration: BoxDecoration(
                  color: colorScheme.onSurface.withValues(alpha: 0.06),
                  borderRadius: BorderRadius.circular(9),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          // 模擬 plan item 列表（5 個骨架項）
          for (int i = 0; i < 5; i++) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              margin: const EdgeInsets.only(bottom: 6),
              decoration: BoxDecoration(
                color: colorScheme.onSurface.withValues(alpha: 0.03),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: colorScheme.onSurface.withValues(alpha: 0.06),
                ),
              ),
              child: Row(
                children: [
                  // 圓圈骨架
                  Container(
                    width: 22,
                    height: 22,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: colorScheme.onSurface.withValues(alpha: 0.08),
                        width: 1.5,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  // 文字骨架（寬度隨機感）
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: double.infinity,
                          height: 14,
                          margin: EdgeInsets.only(right: (i * 30.0 + 20) % 100),
                          decoration: BoxDecoration(
                            color: colorScheme.onSurface.withValues(alpha: 0.06),
                            borderRadius: BorderRadius.circular(7),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Container(
                          width: 80,
                          height: 11,
                          decoration: BoxDecoration(
                            color: colorScheme.onSurface.withValues(alpha: 0.04),
                            borderRadius: BorderRadius.circular(5),
                          ),
                        ),
                      ],
                    ),
                  ),
                  // 時間骨架
                  Container(
                    width: 30,
                    height: 11,
                    decoration: BoxDecoration(
                      color: colorScheme.onSurface.withValues(alpha: 0.04),
                      borderRadius: BorderRadius.circular(5),
                    ),
                  ),
                ],
              ),
            ),
          ],
          // 生成中提示
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.onboardingIndigo.withValues(alpha: 0.5),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  '正在生成今日計畫...',
                  style: TextStyle(
                    color: colorScheme.onSurface.withValues(alpha: 0.4),
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRecentTasks(List<Task> tasks) {
    // 樂觀更新：過濾掉已完成的任務
    final activeTasks = tasks.where((t) => !_completedTaskIds.contains(t.id)).toList();

    if (activeTasks.isEmpty) {
      return SliverToBoxAdapter(
        child: _buildEmptyState(),
      );
    }

    // 按 due date 排序：無日期的排最前面，有日期的按日期升序
    final sortedTasks = List<Task>.from(activeTasks)
      ..sort((a, b) {
        if (a.dueDate == null && b.dueDate == null) return 0;
        if (a.dueDate == null) return -1; // 無日期排前面
        if (b.dueDate == null) return 1;
        return a.dueDate!.compareTo(b.dueDate!);
      });

    final recentTasks = sortedTasks.take(10).toList();

    return SliverList(
      delegate: SliverChildBuilderDelegate(
        (context, index) => _buildTaskCard(recentTasks[index], expanded: true),
        childCount: recentTasks.length,
      ),
    );
  }

  Widget _buildTaskCard(Task task, {bool expanded = false}) {
    final colorScheme = Theme.of(context).colorScheme;
    final accentColor = task.isOverdue
        ? AppColors.error
        : task.isToday
            ? AppColors.statusInbox
            : AppColors.onboardingIndigo;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 5),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => _showTaskDetails(task),
          borderRadius: BorderRadius.circular(16),
          child: Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  accentColor.withValues(alpha: 0.08),
                  colorScheme.onSurface.withValues(alpha: 0.03),
                ],
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: accentColor.withValues(alpha: 0.2),
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 左側色條
                Container(
                  width: 4,
                  height: expanded && task.subItems != null && task.subItems!.isNotEmpty
                      ? null : 64,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        accentColor,
                        accentColor.withValues(alpha: 0.3),
                      ],
                    ),
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(16),
                      bottomLeft: Radius.circular(16),
                    ),
                  ),
                ),
                // 內容區域
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            // 完成按鈕
                            GestureDetector(
                              onTap: () => _completeTask(task),
                              child: Container(
                                width: 22,
                                height: 22,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: accentColor.withValues(alpha: 0.5),
                                    width: 2,
                                  ),
                                ),
                                child: Center(
                                  child: Container(
                                    width: 8,
                                    height: 8,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: accentColor.withValues(alpha: 0.3),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            // 任務內容
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    task.content,
                                    style: TextStyle(
                                      color: colorScheme.onSurface,
                                      fontSize: 16,
                                      fontWeight: FontWeight.w500,
                                    ),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  if (task.areaName != null || task.productName != null)
                                    Padding(
                                      padding: const EdgeInsets.only(top: 4),
                                      child: Row(
                                        children: [
                                          Icon(
                                            Icons.folder_outlined,
                                            size: 12,
                                            color: colorScheme.onSurface.withValues(alpha: 0.35),
                                          ),
                                          const SizedBox(width: 4),
                                          Expanded(
                                            child: Text(
                                              [task.areaName, task.productName]
                                                  .whereType<String>()
                                                  .join(' > '),
                                              style: TextStyle(
                                                color: colorScheme.onSurface.withValues(alpha: 0.4),
                                                fontSize: 12,
                                              ),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                ],
                              ),
                            ),
                            // 日期標籤
                            task.dueDate != null
                              ? Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: _getDueDateColor(task).withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(
                                      color: _getDueDateColor(task).withValues(alpha: 0.2),
                                    ),
                                  ),
                                  child: Text(
                                    _formatDueDate(task.dueDate!),
                                    style: TextStyle(
                                      color: _getDueDateColor(task),
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                )
                              : Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: colorScheme.onSurface.withValues(alpha: 0.06),
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(
                                      color: colorScheme.onSurface.withValues(alpha: 0.1),
                                    ),
                                  ),
                                  child: Text(
                                    '未排程',
                                    style: TextStyle(
                                      color: colorScheme.onSurface.withValues(alpha: 0.35),
                                      fontSize: 11,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ),
                          ],
                        ),
                        // Sub-items (展開顯示)
                        if (expanded &&
                            task.subItems != null &&
                            task.subItems!.isNotEmpty)
                          _buildSubItems(task),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSubItems(Task task) {
    final colorScheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(top: 12, left: 34),
      child: Container(
        padding: const EdgeInsets.only(left: 12),
        decoration: BoxDecoration(
          border: Border(
            left: BorderSide(
              color: colorScheme.outlineVariant.withValues(alpha: 0.3),
              width: 1,
            ),
          ),
        ),
        child: Column(
          children: task.subItems!.map((subItem) {
            final key = '${task.id}:${subItem.id}';
            final isCompleted = _optimisticSubItemStates[key] ?? subItem.completed;

            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  _loadingSubItemIds.contains(key)
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : GestureDetector(
                        onTap: () => _toggleSubItem(task, subItem),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          curve: Curves.easeInOut,
                          width: 18,
                          height: 18,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(5),
                            color: isCompleted
                                ? AppColors.accentEmerald
                                : Colors.transparent,
                            border: Border.all(
                              color: isCompleted
                                  ? AppColors.accentEmerald
                                  : colorScheme.onSurface.withValues(alpha: 0.2),
                              width: 1.5,
                            ),
                          ),
                          child: AnimatedSwitcher(
                            duration: const Duration(milliseconds: 200),
                            child: isCompleted
                                ? const Icon(
                                    Icons.check,
                                    key: ValueKey('check'),
                                    size: 12,
                                    color: Colors.white,
                                  )
                                : const SizedBox.shrink(key: ValueKey('empty')),
                          ),
                        ),
                      ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: AnimatedDefaultTextStyle(
                      duration: const Duration(milliseconds: 200),
                      style: TextStyle(
                        color: isCompleted
                            ? colorScheme.onSurface.withValues(alpha: 0.35)
                            : colorScheme.onSurface.withValues(alpha: 0.8),
                        fontSize: 14,
                        decoration:
                            isCompleted ? TextDecoration.lineThrough : null,
                        decorationColor: colorScheme.onSurface.withValues(alpha: 0.3),
                      ),
                      child: Text(subItem.content),
                    ),
                  ),
                ],
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildCompletedSection(List<Task> completedTasks) {
    if (completedTasks.isEmpty) {
      return const SliverToBoxAdapter(child: SizedBox.shrink());
    }

    return SliverToBoxAdapter(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(20, 24, 20, 12),
            child: Row(
              children: [
                Icon(
                  Icons.check_circle,
                  color: AppColors.success,
                  size: 20,
                ),
                SizedBox(width: 8),
                Text(
                  '今日完成',
                  style: TextStyle(
                    color: AppColors.success,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          ...completedTasks.map((task) => _buildCompletedTaskCard(task)),
        ],
      ),
    );
  }

  Widget _buildCompletedTaskCard(Task task) {
    final colorScheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            Icon(
              Icons.check_circle,
              color: AppColors.success.withValues(alpha: 0.6),
              size: 18,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                task.content,
                style: TextStyle(
                  color: colorScheme.onSurface.withValues(alpha: 0.4),
                  fontSize: 14,
                  decoration: TextDecoration.lineThrough,
                  decorationColor: colorScheme.onSurface.withValues(alpha: 0.3),
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    final colorScheme = Theme.of(context).colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(48.0),
        child: Column(
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  colors: [
                    AppColors.accentEmerald.withValues(alpha: 0.2),
                    AppColors.onboardingIndigo.withValues(alpha: 0.2),
                  ],
                ),
              ),
              child: const Icon(
                Icons.check_circle_outline,
                size: 40,
                color: AppColors.accentEmerald,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              '太棒了！沒有待辦事項',
              style: TextStyle(
                color: colorScheme.onSurface.withValues(alpha: 0.6),
                fontSize: 16,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorState(String message) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(48.0),
        child: Column(
          children: [
            const Icon(
              Icons.error_outline,
              size: 64,
              color: Colors.red,
            ),
            const SizedBox(height: 16),
            Text(
              message,
              style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => refreshTasks(ref),
              child: const Text('重試'),
            ),
          ],
        ),
      ),
    );
  }

  Color _getDueDateColor(Task task) {
    if (task.isOverdue) return AppColors.error;
    if (task.isToday) return AppColors.statusInbox;
    return AppColors.statusActive;
  }

  String _formatDueDate(DateTime date) {
    return utils.DateUtils.formatDueDate(date);
  }

  Future<void> _confirmCompletePlanItem(DailyPlanItem item) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Theme.of(ctx).colorScheme.surfaceContainerHighest,
        title: Text('完成項目', style: TextStyle(color: Theme.of(ctx).colorScheme.onSurface)),
        content: Text(item.content, style: TextStyle(color: Theme.of(ctx).colorScheme.onSurfaceVariant)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('完成'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _loadingPlanItemIds.add(item.id));
    try {
      await ref.read(coachBriefingProvider.notifier).updatePlanItem(
            itemId: item.id,
            completed: true,
          );
    } finally {
      if (mounted) setState(() => _loadingPlanItemIds.remove(item.id));
    }
  }

  void _openPlanItemDetail(DailyPlanItem item) {
    final tasks = ref.read(activeTasksProvider).tasks;
    if (tasks == null) return;
    final task = tasks.where((t) => t.id == item.taskId).firstOrNull;
    if (task != null) {
      _showTaskDetails(task);
    }
  }

  void _showTaskDetails(Task task) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: TaskDetailBottomSheet(task: task),
      ),
    );
  }

  Future<void> _completeTask(Task task) async {
    // 顯示確認對話框
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        title: Text(
          '完成任務',
          style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontWeight: FontWeight.w600),
        ),
        content: Text(
          '確定要完成「${task.content}」嗎？',
          style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 15),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(
              '取消',
              style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.54)),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(
              backgroundColor: AppColors.success.withValues(alpha: 0.15),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            child: const Text(
              '完成',
              style: TextStyle(color: AppColors.success, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );

    // 如果用戶取消，直接返回
    if (confirmed != true) return;

    // 觸覺回饋
    HapticFeedback.mediumImpact();

    // 【樂觀更新】立即從 UI 移除任務
    setState(() {
      _completedTaskIds.add(task.id);
    });

    // 顯示成功動畫（立即反饋）
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  color: AppColors.success,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check, size: 16, color: Colors.white),
              ),
              const SizedBox(width: 12),
              const Text('🎉 任務已完成！'),
            ],
          ),
          duration: const Duration(seconds: 2),
          backgroundColor: AppColors.success.withValues(alpha: 0.2),
          behavior: SnackBarBehavior.floating,
        ),
      );
      HapticFeedback.heavyImpact();
    }

    // 背景執行 API 請求
    final useCase = ref.read(updateTaskDetailsUseCaseProvider);
    final result = await useCase(UpdateTaskDetailsParams(
      taskId: task.id,
      status: TaskStatus.archive,
    ));

    // 檢查結果
    result.fold(
      // 失敗：回滾樂觀更新
      (failure) {
        if (mounted) {
          setState(() {
            _completedTaskIds.remove(task.id);
          });

          ScaffoldMessenger.of(context).clearSnackBars();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Row(
                children: [
                  const Icon(Icons.error_outline, color: Colors.white),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text('完成失敗：${failure.message}'),
                  ),
                ],
              ),
              duration: const Duration(seconds: 3),
              backgroundColor: Colors.red.shade700,
              action: SnackBarAction(
                label: '重試',
                textColor: Colors.white,
                onPressed: () => _completeTask(task),
              ),
            ),
          );
        }
      },
      // 成功：立即刷新快取確保所有頁面同步
      (_) async {
        // 刷新今日完成列表
        ref.invalidate(completedTodayTasksProvider);
        // 立即刷新 dashboard 確保全視圖也更新
        await silentRefreshTasks(ref);
      },
    );
  }

  Future<void> _toggleSubItem(Task task, SubItem subItem) async {
    HapticFeedback.lightImpact();

    final key = '${task.id}:${subItem.id}';
    final currentState = _optimisticSubItemStates[key] ?? subItem.completed;
    final newCompleted = !currentState;

    // 彈確認對話框
    final confirmMessage = newCompleted ? '確定要標記為完成？' : '確定要取消完成？';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest,
        title: Text(
          newCompleted ? '完成子任務' : '取消完成',
          style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
        ),
        content: Text(confirmMessage, style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text('取消', style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.54))),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('確定', style: TextStyle(color: AppColors.primary)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    // 設為 loading 狀態
    setState(() {
      _loadingSubItemIds.add(key);
    });

    // 發送 API 請求
    final useCase = ref.read(updateSubItemUseCaseProvider);
    final result = await useCase(UpdateSubItemParams(
      taskId: task.id,
      subItemId: subItem.id,
      completed: newCompleted,
    ));

    result.fold(
      (failure) {
        if (mounted) {
          setState(() {
            _loadingSubItemIds.remove(key);
          });
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('更新失敗: ${failure.message}')),
          );
        }
      },
      (_) async {
        if (mounted) {
          setState(() {
            _loadingSubItemIds.remove(key);
            _optimisticSubItemStates[key] = newCompleted;
          });
        }
        // 成功：檢查是否所有 sub-items 都已完成
        if (mounted && (task.subItems?.isNotEmpty ?? false)) {
          final allCompleted = task.subItems!.every((s) {
            final key2 = '${task.id}:${s.id}';
            return _optimisticSubItemStates[key2] ?? s.completed;
          });
          if (allCompleted) {
            final confirmed2 = await showDialog<bool>(
              context: context,
              builder: (ctx) => AlertDialog(
                title: const Text('完成任務'),
                content: const Text('所有子任務都已完成，是否要將此任務標記為完成？'),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.of(ctx).pop(false),
                    child: const Text('稍後再說'),
                  ),
                  TextButton(
                    onPressed: () => Navigator.of(ctx).pop(true),
                    child: const Text('完成'),
                  ),
                ],
              ),
            );
            if (confirmed2 == true && mounted) {
              await _completeTask(task);
            }
          }
        }
      },
    );
  }
}
