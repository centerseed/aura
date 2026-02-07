import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/di/providers.dart';
import '../../../../core/utils/date_utils.dart' as utils;
import '../../../../domain/entities/task.dart';
import '../../../../application/use_cases/update_sub_item_use_case.dart';
import '../../../../application/use_cases/update_task_details_use_case.dart';
import '../../../providers/task_provider.dart';
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

  @override
  Widget build(BuildContext context) {
    final taskState = ref.watch(activeTasksProvider);
    final completedTodayAsync = ref.watch(completedTodayTasksProvider);
    final dailyProgress = ref.watch(dailyProgressProvider);

    return SafeArea(
      child: RefreshIndicator(
        onRefresh: () async {
          await refreshTasks(ref);
          ref.invalidate(completedTodayTasksProvider);
        },
        color: const Color(0xFF6C63FF),
        backgroundColor: const Color(0xFF161B22),
        child: CustomScrollView(
          slivers: [
            // Header with refresh indicator
            SliverToBoxAdapter(
              child: _buildHeader(dailyProgress, isRefreshing: taskState.isRefreshing),
            ),
            // 最近任務標題
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
                child: Row(
                  children: [
                    Container(
                      width: 4,
                      height: 20,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                        ),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    const SizedBox(width: 10),
                    const Text(
                      '最近任務',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            // 最近 10 個任務 - 使用 TaskDataState
            if (taskState.showLoading)
              const SliverToBoxAdapter(
                child: Center(
                  child: Padding(
                    padding: EdgeInsets.all(48.0),
                    child: CircularProgressIndicator(color: Color(0xFF6C63FF)),
                  ),
                ),
              )
            else if (taskState.hasError)
              SliverToBoxAdapter(
                child: _buildErrorState(taskState.error!),
              )
            else if (taskState.showContent)
              _buildRecentTasks(taskState.tasks!),
            // 今日完成區塊 (FutureProvider<TaskDataState>)
            completedTodayAsync.when(
              data: (state) => state.hasData
                  ? _buildCompletedSection(state.tasks!)
                  : const SliverToBoxAdapter(child: SizedBox.shrink()),
              loading: () => const SliverToBoxAdapter(child: SizedBox.shrink()),
              error: (_, __) => const SliverToBoxAdapter(child: SizedBox.shrink()),
            ),
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
    return Padding(
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
                    shaderCallback: (bounds) => const LinearGradient(
                      colors: [Color(0xFF6366F1), Color(0xFF10B981)],
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
                    const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white54,
                      ),
                    ),
                  ],
                ],
              ),
              Container(
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.1),
                  ),
                ),
                child: IconButton(
                  icon: const Icon(Icons.person_outline, color: Colors.white70),
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
    );
  }

  Widget _buildProgressCard(DailyProgress progress) {
    final percentage = progress.total > 0
        ? (progress.completed / progress.total * 100).round()
        : 0;
    final progressValue = progress.total > 0
        ? progress.completed / progress.total
        : 0.0;

    // 根據進度選色
    final progressColor = progressValue >= 1.0
        ? const Color(0xFF10B981) // 完成：翠綠
        : progressValue >= 0.5
            ? const Color(0xFF4ADE80) // 過半：淺綠
            : const Color(0xFF6366F1); // 未過半：靛藍

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
                        color: Colors.white.withValues(alpha: 0.7),
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
                    backgroundColor: Colors.white.withValues(alpha: 0.08),
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
                    backgroundColor: Colors.white.withValues(alpha: 0.08),
                    valueColor: AlwaysStoppedAnimation<Color>(progressColor),
                  ),
                ),
                Center(
                  child: Text(
                    '$percentage%',
                    style: const TextStyle(
                      color: Colors.white,
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
    final accentColor = task.isOverdue
        ? const Color(0xFFEF4444)
        : task.isToday
            ? const Color(0xFFF59E0B)
            : const Color(0xFF6366F1);

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
                  Colors.white.withValues(alpha: 0.03),
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
                                    style: const TextStyle(
                                      color: Colors.white,
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
                                            color: Colors.white.withValues(alpha: 0.35),
                                          ),
                                          const SizedBox(width: 4),
                                          Expanded(
                                            child: Text(
                                              [task.areaName, task.productName]
                                                  .whereType<String>()
                                                  .join(' > '),
                                              style: TextStyle(
                                                color: Colors.white.withValues(alpha: 0.4),
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
                                    color: Colors.white.withValues(alpha: 0.06),
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(
                                      color: Colors.white.withValues(alpha: 0.1),
                                    ),
                                  ),
                                  child: Text(
                                    '未排程',
                                    style: TextStyle(
                                      color: Colors.white.withValues(alpha: 0.35),
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
    return Padding(
      padding: const EdgeInsets.only(top: 12, left: 34),
      child: Container(
        padding: const EdgeInsets.only(left: 12),
        decoration: BoxDecoration(
          border: Border(
            left: BorderSide(
              color: Colors.white.withValues(alpha: 0.08),
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
                  GestureDetector(
                    onTap: () => _toggleSubItem(task, subItem),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      curve: Curves.easeInOut,
                      width: 18,
                      height: 18,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(5),
                        color: isCompleted
                            ? const Color(0xFF10B981)
                            : Colors.transparent,
                        border: Border.all(
                          color: isCompleted
                              ? const Color(0xFF10B981)
                              : Colors.white.withValues(alpha: 0.2),
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
                            ? Colors.white.withValues(alpha: 0.35)
                            : Colors.white.withValues(alpha: 0.8),
                        fontSize: 14,
                        decoration:
                            isCompleted ? TextDecoration.lineThrough : null,
                        decorationColor: Colors.white.withValues(alpha: 0.3),
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
                  color: Color(0xFF4ADE80),
                  size: 20,
                ),
                SizedBox(width: 8),
                Text(
                  '今日完成',
                  style: TextStyle(
                    color: Color(0xFF4ADE80),
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
              color: const Color(0xFF4ADE80).withValues(alpha: 0.6),
              size: 18,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                task.content,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.4),
                  fontSize: 14,
                  decoration: TextDecoration.lineThrough,
                  decorationColor: Colors.white.withValues(alpha: 0.3),
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
                    const Color(0xFF10B981).withValues(alpha: 0.2),
                    const Color(0xFF6366F1).withValues(alpha: 0.2),
                  ],
                ),
              ),
              child: const Icon(
                Icons.check_circle_outline,
                size: 40,
                color: Color(0xFF10B981),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              '太棒了！沒有待辦事項',
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.6),
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
              style: const TextStyle(color: Colors.white70),
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
    if (task.isOverdue) return const Color(0xFFEF4444);
    if (task.isToday) return const Color(0xFFF59E0B);
    return const Color(0xFF3B82F6);
  }

  String _formatDueDate(DateTime date) {
    return utils.DateUtils.formatDueDate(date);
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
        backgroundColor: const Color(0xFF2c2c2e),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        title: const Text(
          '完成任務',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
        ),
        content: Text(
          '確定要完成「${task.content}」嗎？',
          style: const TextStyle(color: Colors.white70, fontSize: 15),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text(
              '取消',
              style: TextStyle(color: Colors.white54),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(
              backgroundColor: const Color(0xFF4ADE80).withValues(alpha: 0.15),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            child: const Text(
              '完成',
              style: TextStyle(color: Color(0xFF4ADE80), fontWeight: FontWeight.w600),
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
                  color: const Color(0xFF4ADE80),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check, size: 16, color: Colors.white),
              ),
              const SizedBox(width: 12),
              const Text('🎉 任務已完成！'),
            ],
          ),
          duration: const Duration(seconds: 2),
          backgroundColor: const Color(0xFF4ADE80).withValues(alpha: 0.2),
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
    // 使用當前顯示的狀態（可能是樂觀更新的值），而非原始數據
    final currentState = _optimisticSubItemStates[key] ?? subItem.completed;
    final newCompleted = !currentState;

    // 樂觀更新：立即更新 UI
    setState(() {
      _optimisticSubItemStates[key] = newCompleted;
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
        // 回滾樂觀更新
        if (mounted) {
          setState(() {
            _optimisticSubItemStates[key] = currentState;
          });
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('更新失敗: ${failure.message}')),
          );
        }
      },
      (_) {
        // 成功，保持樂觀狀態
        // repository 會自動靜默刷新快取
      },
    );
  }
}
