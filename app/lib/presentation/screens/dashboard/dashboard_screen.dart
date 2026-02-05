import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/di/providers.dart';
import '../../../domain/entities/task.dart';
import '../../../application/use_cases/create_task_use_case.dart';
import '../../../application/use_cases/update_task_details_use_case.dart';
import '../../providers/task_provider.dart';
import 'widgets/task_edit_bottom_sheet.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  // 追蹤已完成的任務 ID（樂觀更新）
  final Set<String> _completedTaskIds = {};

  @override
  Widget build(BuildContext context) {
    final taskState = ref.watch(activeTasksProvider);
    final dailyProgress = ref.watch(dailyProgressProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF000000),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => refreshTasks(ref),
          child: CustomScrollView(
            slivers: [
              // Header with refresh indicator
              SliverToBoxAdapter(
                child: _buildHeader(dailyProgress, isRefreshing: taskState.isRefreshing),
              ),
              // Task List - 使用 TaskDataState
              if (taskState.showLoading)
                const SliverToBoxAdapter(
                  child: Center(
                    child: Padding(
                      padding: EdgeInsets.all(48.0),
                      child: CircularProgressIndicator(color: Colors.white),
                    ),
                  ),
                )
              else if (taskState.hasError)
                SliverToBoxAdapter(
                  child: _buildErrorState(taskState.error!),
                )
              else if (taskState.showContent)
                _buildTaskList(taskState.tasks!),
            ],
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showQuickCapture(context),
        backgroundColor: const Color(0xFF6C63FF),
        child: const Icon(Icons.add, color: Colors.white),
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
                  const Text(
                    'Zentropy',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
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
          const SizedBox(height: 16),
          // Daily Progress Card
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  const Color(0xFF6C63FF).withValues(alpha: 0.3),
                  const Color(0xFF6C63FF).withValues(alpha: 0.1),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: const Color(0xFF6C63FF).withValues(alpha: 0.3),
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        '今日進度',
                        style: TextStyle(
                          color: Colors.white70,
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '${progress.completed} / ${progress.total}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 32,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
                SizedBox(
                  width: 60,
                  height: 60,
                  child: Stack(
                    children: [
                      CircularProgressIndicator(
                        value: progress.total > 0
                            ? progress.completed / progress.total
                            : 0,
                        strokeWidth: 6,
                        backgroundColor: Colors.white.withValues(alpha: 0.1),
                        valueColor: const AlwaysStoppedAnimation<Color>(
                          Color(0xFF4ADE80),
                        ),
                      ),
                      Center(
                        child: Text(
                          progress.total > 0
                              ? '${((progress.completed / progress.total) * 100).round()}%'
                              : '0%',
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
              ],
            ),
          ),
          const SizedBox(height: 24),
          const Text(
            '待辦事項',
            style: TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTaskList(List<Task> tasks) {
    // 樂觀更新：過濾掉已完成的任務
    final activeTasks = tasks.where((t) => !_completedTaskIds.contains(t.id)).toList();

    if (activeTasks.isEmpty) {
      return SliverToBoxAdapter(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(48.0),
            child: Column(
              children: [
                Icon(
                  Icons.check_circle_outline,
                  size: 64,
                  color: Colors.white.withValues(alpha: 0.3),
                ),
                const SizedBox(height: 16),
                Text(
                  '太棒了！沒有待辦事項',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.5),
                    fontSize: 16,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    // Group tasks by due date
    final overdueTasks = activeTasks.where((t) => t.isOverdue).toList();
    final todayTasks = activeTasks.where((t) => t.isToday).toList();
    final upcomingTasks = activeTasks
        .where((t) => !t.isOverdue && !t.isToday && t.dueDate != null)
        .toList();
    final noDueTasks = activeTasks.where((t) => t.dueDate == null).toList();

    return SliverList(
      delegate: SliverChildListDelegate([
        if (overdueTasks.isNotEmpty) ...[
          _buildSectionHeader('逾期', Colors.red),
          ...overdueTasks.map((task) => _buildTaskCard(task)),
        ],
        if (todayTasks.isNotEmpty) ...[
          _buildSectionHeader('今天', Colors.orange),
          ...todayTasks.map((task) => _buildTaskCard(task)),
        ],
        if (upcomingTasks.isNotEmpty) ...[
          _buildSectionHeader('即將到來', Colors.blue),
          ...upcomingTasks.map((task) => _buildTaskCard(task)),
        ],
        if (noDueTasks.isNotEmpty) ...[
          _buildSectionHeader('無期限', Colors.grey),
          ...noDueTasks.map((task) => _buildTaskCard(task)),
        ],
        const SizedBox(height: 80), // Space for FAB
      ]),
    );
  }

  Widget _buildSectionHeader(String title, Color color) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Row(
        children: [
          Container(
            width: 4,
            height: 16,
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            title,
            style: TextStyle(
              color: color,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTaskCard(Task task) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => _showTaskDetails(task),
          borderRadius: BorderRadius.circular(16),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF1c1c1e),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
            ),
            child: Row(
              children: [
                // Complete Button - 改用更明顯的按鈕樣式
                GestureDetector(
                  onTap: () => _completeTask(task),
                  child: Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: const Color(0xFF4ADE80).withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: const Color(0xFF4ADE80).withValues(alpha: 0.4),
                        width: 2,
                      ),
                    ),
                    child: Icon(
                      Icons.check_rounded,
                      size: 16,
                      color: const Color(0xFF4ADE80).withValues(alpha: 0.6),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                // Task Content
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        task.content,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (task.areaName != null || task.productName != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            [task.areaName, task.productName]
                                .whereType<String>()
                                .join(' > '),
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.4),
                              fontSize: 12,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                // Focus Button
                IconButton(
                  icon: Icon(
                    Icons.play_circle_outline,
                    color: Colors.white.withValues(alpha: 0.5),
                  ),
                  onPressed: () =>
                      context.push('/focus/${task.id}', extra: task),
                ),
              ],
            ),
          ),
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

  void _showTaskDetails(Task task) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
        ),
        child: TaskEditBottomSheet(task: task),
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

  void _showQuickCapture(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => const _QuickCaptureSheet(),
    );
  }
}

class _QuickCaptureSheet extends ConsumerStatefulWidget {
  const _QuickCaptureSheet();

  @override
  ConsumerState<_QuickCaptureSheet> createState() => _QuickCaptureSheetState();
}

class _QuickCaptureSheetState extends ConsumerState<_QuickCaptureSheet> {
  final _textController = TextEditingController();
  bool _isLoading = false;

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_textController.text.trim().isEmpty) return;

    setState(() => _isLoading = true);

    final useCase = ref.read(createTaskUseCaseProvider);
    final result = await useCase(CreateTaskParams(content: _textController.text.trim()));

    setState(() => _isLoading = false);

    result.fold(
      (failure) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('新增失敗: ${failure.message}')),
          );
        }
      },
      (task) async {
        // 觸發靜默刷新以載入新建立的任務
        await silentRefreshTasks(ref);

        if (mounted) {
          Navigator.pop(context);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('任務已新增！')),
          );
        }
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      decoration: const BoxDecoration(
        color: Color(0xFF1c1c1e),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            TextField(
              controller: _textController,
              autofocus: true,
              style: const TextStyle(color: Colors.white, fontSize: 16),
              decoration: InputDecoration(
                hintText: '輸入新任務...',
                hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.3)),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
                filled: true,
                fillColor: Colors.white.withValues(alpha: 0.05),
              ),
              onSubmitted: (_) => _submit(),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _isLoading ? null : _submit,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF6C63FF),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: _isLoading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('新增任務'),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}
