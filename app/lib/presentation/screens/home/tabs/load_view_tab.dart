import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../domain/entities/task.dart';
import '../../../providers/task_provider.dart';
import '../widgets/task_detail_bottom_sheet.dart';

/// 負載視圖分頁 - 按週顯示任務負載
class LoadViewTab extends ConsumerStatefulWidget {
  const LoadViewTab({super.key});

  @override
  ConsumerState<LoadViewTab> createState() => _LoadViewTabState();
}

class _LoadViewTabState extends ConsumerState<LoadViewTab> {
  // 展開的週
  final Set<String> _expandedWeeks = {};

  @override
  Widget build(BuildContext context) {
    final taskState = ref.watch(activeTasksProvider);

    return SafeArea(
      child: RefreshIndicator(
        onRefresh: () => refreshTasks(ref),
        color: const Color(0xFF6C63FF),
        backgroundColor: const Color(0xFF161B22),
        child: CustomScrollView(
          slivers: [
            // Header with refresh indicator
            SliverToBoxAdapter(
              child: _buildHeader(isRefreshing: taskState.isRefreshing),
            ),
            // Load View - 使用 TaskDataState
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
              _buildLoadView(taskState.tasks!),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader({bool isRefreshing = false}) {
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
                      colors: [Color(0xFF6366F1), Color(0xFFF59E0B)],
                    ).createShader(bounds),
                    child: const Text(
                      '負載視圖',
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
              IconButton(
                icon: const Icon(Icons.person_outline, color: Colors.white70),
                onPressed: () => context.push('/profile'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '每週工作量分析',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.6),
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoadView(List<Task> tasks) {
    // 計算每週負載
    final weeklyLoads = _calculateWeeklyLoads(tasks);

    if (weeklyLoads.isEmpty) {
      return SliverToBoxAdapter(
        child: _buildEmptyState(),
      );
    }

    // 初始化展開狀態（預設全部展開）
    if (_expandedWeeks.isEmpty) {
      _expandedWeeks.addAll(weeklyLoads.map((w) => w.key));
    }

    // 計算統計
    final avgLoad = weeklyLoads.isNotEmpty
        ? weeklyLoads.map((w) => w.taskCount).reduce((a, b) => a + b) /
            weeklyLoads.length
        : 0.0;
    final overloadedWeeks =
        weeklyLoads.where((w) => w.taskCount >= _LoadThresholds.warning).length;
    final maxLoad = weeklyLoads.map((w) => w.taskCount).reduce((a, b) => a > b ? a : b);

    return SliverList(
      delegate: SliverChildListDelegate([
        // 緊湊的統計摘要
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          child: Row(
            children: [
              Text(
                '共 ${weeklyLoads.length} 週',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.6),
                  fontSize: 13,
                ),
              ),
              const SizedBox(width: 4),
              Text(
                '•',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.3),
                  fontSize: 13,
                ),
              ),
              const SizedBox(width: 4),
              Text(
                '平均 ${avgLoad.toStringAsFixed(1)}',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.6),
                  fontSize: 13,
                ),
              ),
              if (maxLoad > 0) ...[
                const SizedBox(width: 4),
                Text(
                  '•',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.3),
                    fontSize: 13,
                  ),
                ),
                const SizedBox(width: 4),
                Text(
                  '最高 $maxLoad',
                  style: const TextStyle(
                    color: Color(0xFFF59E0B),
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
              if (overloadedWeeks > 0) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEF4444).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.warning_rounded,
                        color: Color(0xFFEF4444),
                        size: 12,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '$overloadedWeeks 週超載',
                        style: const TextStyle(
                          color: Color(0xFFEF4444),
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        // 週列表
        ...weeklyLoads.map((week) => _buildWeekCard(week)),
        // 圖例
        _buildLegend(),
        const SizedBox(height: 100),
      ]),
    );
  }

  Widget _buildWeekCard(_WeekLoad week) {
    final isExpanded = _expandedWeeks.contains(week.key);
    final isCurrent = _isCurrentWeek(week.weekStart);
    final loadColor = _getLoadColor(week.taskCount);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF161B22),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isCurrent
                ? const Color(0xFF3B82F6).withValues(alpha: 0.5)
                : loadColor.withValues(alpha: 0.2),
            width: 1,
          ),
        ),
        child: Column(
          children: [
            // 週標題列
            InkWell(
              onTap: () {
                setState(() {
                  if (isExpanded) {
                    _expandedWeeks.remove(week.key);
                  } else {
                    _expandedWeeks.add(week.key);
                  }
                });
              },
              borderRadius: BorderRadius.circular(16),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Row(
                  children: [
                    // 展開圖標
                    Icon(
                      isExpanded
                          ? Icons.keyboard_arrow_down
                          : Icons.keyboard_arrow_right,
                      color: Colors.white.withValues(alpha: 0.4),
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    // 週標籤
                    Text(
                      '${week.weekStart.month}/${week.weekStart.day} 週',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (isCurrent) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFF3B82F6),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text(
                          '本週',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                    const Spacer(),
                    // 負載標籤
                    Text(
                      _getLoadLabel(week.taskCount),
                      style: TextStyle(
                        color: loadColor,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(width: 8),
                    // 任務數
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: loadColor,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        '${week.taskCount}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            // 負載條
            if (!isExpanded)
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: (week.taskCount / 10).clamp(0.0, 1.0),
                    minHeight: 6,
                    backgroundColor: Colors.white.withValues(alpha: 0.08),
                    valueColor: AlwaysStoppedAnimation<Color>(loadColor),
                  ),
                ),
              ),
            // 展開詳情
            if (isExpanded && week.tasks.isNotEmpty)
              Container(
                decoration: BoxDecoration(
                  border: Border(
                    top: BorderSide(
                      color: Colors.white.withValues(alpha: 0.08),
                    ),
                  ),
                ),
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // 日期範圍
                    Text(
                      '${_formatDate(week.weekStart)} ~ ${_formatDate(week.weekEnd)}',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.4),
                        fontSize: 11,
                      ),
                    ),
                    const SizedBox(height: 8),
                    // 任務列表
                    ...week.tasks.map((task) => _buildTaskItem(task)),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildTaskItem(Task task) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: InkWell(
        onTap: () => _showTaskDetails(task),
        borderRadius: BorderRadius.circular(6),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
          child: Row(
            children: [
              // 小點指示器
              Container(
                width: 4,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.3),
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 10),
              // 任務標題
              Expanded(
                child: Text(
                  task.content,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              // 日期
              if (task.dueDate != null) ...[
                const SizedBox(width: 8),
                Text(
                  '${task.dueDate!.month}/${task.dueDate!.day}',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.4),
                    fontSize: 12,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLegend() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: Wrap(
        spacing: 16,
        runSpacing: 8,
        children: [
          _buildLegendItem('輕鬆 (0-2)', const Color(0xFF10B981)),
          _buildLegendItem('適中 (3-4)', const Color(0xFF3B82F6)),
          _buildLegendItem('忙碌 (5-7)', const Color(0xFFF59E0B)),
          _buildLegendItem('爆炸 (8+)', const Color(0xFFEF4444)),
        ],
      ),
    );
  }

  Widget _buildLegendItem(String label, Color color) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.6),
            fontSize: 12,
          ),
        ),
      ],
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(48.0),
        child: Column(
          children: [
            Icon(
              Icons.calendar_today_outlined,
              size: 64,
              color: Colors.white.withValues(alpha: 0.3),
            ),
            const SizedBox(height: 16),
            Text(
              '沒有排定日期的任務',
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.5),
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

  // ==================== Helper Methods ====================

  List<_WeekLoad> _calculateWeeklyLoads(List<Task> tasks) {
    final weekMap = <String, _WeekLoad>{};

    for (final task in tasks) {
      if (task.dueDate == null) continue;

      final weekStart = _getWeekStart(task.dueDate!);
      final key = weekStart.toIso8601String();

      if (!weekMap.containsKey(key)) {
        final weekEnd = weekStart.add(const Duration(days: 6));
        weekMap[key] = _WeekLoad(
          key: key,
          weekStart: weekStart,
          weekEnd: weekEnd,
          tasks: [],
        );
      }

      weekMap[key]!.tasks.add(task);
    }

    // 排序
    final result = weekMap.values.toList()
      ..sort((a, b) => a.weekStart.compareTo(b.weekStart));

    return result;
  }

  DateTime _getWeekStart(DateTime date) {
    final d = DateTime(date.year, date.month, date.day);
    final weekday = d.weekday;
    return d.subtract(Duration(days: weekday - 1));
  }

  bool _isCurrentWeek(DateTime weekStart) {
    final now = DateTime.now();
    final currentWeekStart = _getWeekStart(now);
    return weekStart.year == currentWeekStart.year &&
        weekStart.month == currentWeekStart.month &&
        weekStart.day == currentWeekStart.day;
  }

  String _formatDate(DateTime date) {
    return '${date.month}/${date.day}';
  }

  Color _getLoadColor(int load) {
    if (load < _LoadThresholds.low) return const Color(0xFF10B981);
    if (load < _LoadThresholds.medium) return const Color(0xFF3B82F6);
    if (load < _LoadThresholds.warning) return const Color(0xFFF59E0B);
    return const Color(0xFFEF4444);
  }

  String _getLoadLabel(int load) {
    if (load < _LoadThresholds.low) return '輕鬆';
    if (load < _LoadThresholds.medium) return '適中';
    if (load < _LoadThresholds.warning) return '忙碌';
    return '爆炸';
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
}

/// 負載等級閾值
class _LoadThresholds {
  static const int low = 3; // 0-2: 輕鬆
  static const int medium = 5; // 3-4: 適中
  static const int warning = 8; // 5-7: 忙碌, 8+: 爆炸
}

/// 週負載資料
class _WeekLoad {
  final String key;
  final DateTime weekStart;
  final DateTime weekEnd;
  final List<Task> tasks;

  _WeekLoad({
    required this.key,
    required this.weekStart,
    required this.weekEnd,
    required this.tasks,
  });

  int get taskCount => tasks.length;
}
