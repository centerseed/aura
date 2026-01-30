import 'dart:ui' as dart_ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:app/core/di/providers.dart';
import 'package:app/presentation/providers/auth_provider.dart';
import 'package:app/presentation/providers/task_provider.dart';
import 'package:app/presentation/providers/cached_data_provider.dart';
import 'package:app/domain/entities/task.dart' as entity;

import '../capture/capture_screen.dart';
import '../review/inbox_review_screen.dart';
import 'widgets/task_edit_bottom_sheet.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    // Shared Scaffold for BottomNav
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Text(
              'Zen',
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurface,
                fontWeight: FontWeight.w900, // Extra Bold
                fontSize: 24,
                fontFamily: 'SF Pro Display', // Or system font
                letterSpacing: -0.5,
              ),
            ),
            Text(
              'tropy',
              style: TextStyle(
                color: Theme.of(
                  context,
                ).colorScheme.onSurface.withOpacity(0.6), // Greyish
                fontWeight: FontWeight.w500, // Medium
                fontSize: 24,
                fontFamily: 'SF Pro Display',
                letterSpacing: -0.5,
              ),
            ),
          ],
        ),
        centerTitle: false,
        elevation: 0,
        backgroundColor: Theme.of(context).colorScheme.surface,
        actions: [
          // Profile Icon (Shared across tabs)
          Consumer(
            builder: (context, ref, child) {
              final user = ref.watch(currentUserProvider);
              return IconButton(
                onPressed: () {
                  context.push('/profile');
                },
                icon: CircleAvatar(
                  backgroundImage: NetworkImage(user?.photoURL ?? ''),
                  backgroundColor: Colors.grey.withOpacity(0.2),
                  radius: 16,
                  child: user?.photoURL == null
                      ? const Icon(Icons.person, size: 20)
                      : null,
                ),
              );
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Stack(
        children: [
          // Main Content
          IndexedStack(
            index: _currentIndex,
            children: const [
              CaptureScreen(),
              _FocusView(),
              InboxReviewScreen(),
            ],
          ),

          // Floating "iOS 26" Tab Bar
          Align(
            alignment: Alignment.bottomCenter,
            child: Padding(
              padding: const EdgeInsets.only(bottom: 32.0, left: 16, right: 16),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(32),
                child: BackdropFilter(
                  filter: dart_ui.ImageFilter.blur(
                    sigmaX: 25,
                    sigmaY: 25,
                  ), // Stronger Blur for Liquid effect
                  child: Container(
                    height: 64,
                    width: 280,
                    decoration: BoxDecoration(
                      // Liquid Glass Gradient: Ultra transparent
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.white.withOpacity(
                            0.08,
                          ), // Very subtle crystalline shine
                          Colors.black.withOpacity(
                            0.25,
                          ), // Slight darkening for contrast
                        ],
                      ),
                      borderRadius: BorderRadius.circular(32),
                      border: Border.all(
                        color: Colors.white.withOpacity(0.2),
                        width: 0.5,
                      ),
                      boxShadow: [
                        // Deep shadow for float
                        BoxShadow(
                          color: Colors.black.withOpacity(0.5),
                          blurRadius: 30,
                          offset: const Offset(0, 15),
                          spreadRadius: -5,
                        ),
                        // Soft glow (ambient)
                        BoxShadow(
                          color: const Color(0xFF7C3AED).withOpacity(0.1),
                          blurRadius: 20,
                          spreadRadius: 0,
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        _buildTabItem(
                          index: 0,
                          icon: Icons.add,
                          isActive: _currentIndex == 0,
                        ),
                        _buildTabItem(
                          index: 1,
                          icon: Icons.play_arrow_rounded,
                          isActive: _currentIndex == 1,
                        ),
                        _buildTabItem(
                          index: 2,
                          icon: Icons.inbox_outlined,
                          isActive: _currentIndex == 2,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTabItem({
    required int index,
    required IconData icon,
    required bool isActive,
  }) {
    return GestureDetector(
      onTap: () {
        setState(() {
          _currentIndex = index;
        });
        HapticFeedback.lightImpact();
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        width: 50,
        height: 50,
        decoration: BoxDecoration(
          color: isActive ? Colors.white.withOpacity(0.15) : Colors.transparent,
          shape: BoxShape.circle,
        ),
        child: Icon(
          icon,
          color: isActive ? Colors.white : Colors.white.withOpacity(0.4),
          size: 28,
        ),
      ),
    );
  }
}

class _FocusView extends ConsumerWidget {
  const _FocusView();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final tasksState = ref.watch(cachedActiveTasksProvider);
    final progress = ref.watch(dailyProgressProvider);

    return Column(
      children: [
        // Focus Mode Header (Progress)
        if (progress.total > 0)
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: 16.0,
              vertical: 12.0,
            ),
            child: Row(
              children: [
                Text(
                  'Focus',
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
                ),
                const SizedBox(width: 12),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1B4D3E), // Dark Green
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: const Color(0xFF4ADE80),
                      width: 1,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.check_circle,
                        size: 14,
                        color: Color(0xFF4ADE80),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '今天已完成 (${progress.completed}/${progress.total})',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF4ADE80),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

        // Task List with Pull to Refresh
        Expanded(
          child: _buildTaskContent(context, ref, tasksState, user),
        ),
      ],
    );
  }

  Widget _buildTaskContent(
    BuildContext context,
    WidgetRef ref,
    CachedState<List<entity.Task>> tasksState,
    dynamic user,
  ) {
    // 顯示 Loading（只有在完全沒有資料時）
    if (!tasksState.hasData && tasksState.isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    // 顯示錯誤（只有在沒有資料且有錯誤時）
    if (!tasksState.hasData && tasksState.hasError) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                'Error: ${tasksState.errorMessage}',
                style: const TextStyle(color: Colors.red),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () =>
                    ref.read(cachedActiveTasksProvider.notifier).refresh(),
                child: const Text('重試'),
              ),
            ],
          ),
        ),
      );
    }

    // 優先顯示快取資料
    final tasks = tasksState.data ?? [];

    if (tasks.isEmpty) {
      return RefreshIndicator(
        onRefresh: () async =>
            ref.read(cachedActiveTasksProvider.notifier).refresh(),
        child: Stack(
          children: [
            ListView(),
            _buildEmptyState(context),
          ],
        ),
      );
    }

    return TaskListView(allTasks: tasks, user: user);
  }

  Widget _buildEmptyState(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.check_circle_outline, size: 64, color: Colors.grey),
          const SizedBox(height: 16),
          const Text('全部完成！'),
        ],
      ),
    );
  }
}

class TaskListView extends ConsumerStatefulWidget {
  final List<entity.Task> allTasks;
  final dynamic user;

  const TaskListView({super.key, required this.allTasks, required this.user});

  @override
  ConsumerState<TaskListView> createState() => _TaskListViewState();
}

class _TaskListViewState extends ConsumerState<TaskListView> {
  late List<entity.Task> _tasks;

  @override
  void initState() {
    super.initState();
    _tasks = List.from(widget.allTasks);
  }

  @override
  void didUpdateWidget(covariant TaskListView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.allTasks != widget.allTasks) {
      _tasks = List.from(widget.allTasks);
    }
  }

  Future<void> _handleArchive(entity.Task task) async {
    // 0. Haptic feedback
    HapticFeedback.mediumImpact();

    // 1. Remove logically from UI immediately
    setState(() {
      _tasks.removeWhere((t) => t.id == task.id);
    });

    // 2. Call API (Set Status to Archive)
    final repo = ref.read(taskRepositoryProvider);
    final updatedTask = task.copyWith(status: entity.TaskStatus.archive);
    await repo.updateTask(updatedTask);

    // 3. Refresh providers
    ref.read(cachedActiveTasksProvider.notifier).refresh();

    // 4. SnackBar with Undo
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.check_circle, color: Colors.white, size: 20),
              const SizedBox(width: 8),
              const Text("任務已完成歸檔"),
            ],
          ),
          action: SnackBarAction(
            label: "復原",
            onPressed: () async {
              // Undo: Set status back to Active
              final undoTask = task.copyWith(status: entity.TaskStatus.active);
              await repo.updateTask(undoTask);
              ref.read(cachedActiveTasksProvider.notifier).refresh();
            },
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    // Grouping Logic
    final immediateTasks = _tasks
        .where((t) => t.isOverdue || t.isToday)
        .toList();

    final ongoingTasks =
        _tasks.where((t) => !t.isOverdue && !t.isToday && t.isStarted).toList()
          ..sort((a, b) {
            if (a.dueDate == null && b.dueDate == null) return 0;
            if (a.dueDate == null) return 1;
            if (b.dueDate == null) return -1;
            return a.dueDate!.compareTo(b.dueDate!);
          });

    final backlogTasks = _tasks
        .where(
          (t) =>
              !t.isOverdue &&
              !t.isToday &&
              !t.isStarted,
        )
        .toList();

    // Group backlog by Area
    final Map<String, List<entity.Task>> backlogGrouped = {};
    for (var task in backlogTasks) {
      final key = task.areaName ?? '其他';
      (backlogGrouped[key] ??= []).add(task);
    }
    final sortedBacklogKeys = backlogGrouped.keys.toList()..sort();

    return RefreshIndicator(
      onRefresh: () async =>
          ref.read(cachedActiveTasksProvider.notifier).refresh(),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 80),
        children: [
          const SizedBox(height: 16),

          // TIER 1: Immediate
          if (immediateTasks.isNotEmpty) ...[
            _buildSectionHeader(
              context,
              "立即處理 (Immediate)",
              Icons.local_fire_department_rounded,
              Theme.of(context).colorScheme.error,
            ),
            ...immediateTasks.map(
              (t) => _TaskCard(
                key: Key(t.id),
                task: t,
                style: _CardStyle.urgent,
                onDismiss: () => _handleArchive(t),
              ),
            ),
            const SizedBox(height: 24),
          ],

          // TIER 2: Ongoing
          if (ongoingTasks.isNotEmpty) ...[
            _buildSectionHeader(
              context,
              "正在進行 (In Progress)",
              Icons.run_circle_outlined,
              Colors.blue,
            ),
            ...ongoingTasks.map(
              (t) => _TaskCard(
                key: Key(t.id),
                task: t,
                style: _CardStyle.ongoing,
                onDismiss: () => _handleArchive(t),
              ),
            ),
            const SizedBox(height: 24),
          ],

          // TIER 3: Backlog
          if (backlogTasks.isNotEmpty) ...[
            const SizedBox(height: 16),
            const Divider(height: 1),
            Theme(
              data: Theme.of(
                context,
              ).copyWith(dividerColor: Colors.transparent),
              child: ExpansionTile(
                tilePadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 8,
                ),
                title: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.inventory_2_outlined,
                      size: 16,
                      color: Theme.of(context).colorScheme.secondary,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      "還有 ${backlogTasks.length} 個待辦事項...",
                      style: TextStyle(
                        fontSize: 14,
                        color: Theme.of(context).colorScheme.secondary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
                initiallyExpanded: false,
                children: [
                  ...sortedBacklogKeys.expand((area) {
                    final areaTasks = backlogGrouped[area]!;
                    return [
                      if (sortedBacklogKeys.length > 1)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                          child: Row(
                            children: [
                              Text(
                                area,
                                style: TextStyle(
                                  color: Theme.of(context).colorScheme.primary,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                ),
                              ),
                              const Expanded(child: Divider(indent: 8)),
                            ],
                          ),
                        ),
                      ...areaTasks.map(
                        (t) => _TaskCard(
                          key: Key(t.id),
                          task: t,
                          style: _CardStyle.normal,
                          onDismiss: () => _handleArchive(t),
                        ),
                      ),
                    ];
                  }),
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSectionHeader(
    BuildContext context,
    String title,
    IconData icon,
    Color color,
  ) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: Row(
        children: [
          Icon(icon, size: 20, color: color),
          const SizedBox(width: 8),
          Text(
            title,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.bold,
              fontSize: 16,
            ),
          ),
          const Expanded(child: Divider(indent: 12)),
        ],
      ),
    );
  }
}

enum _CardStyle { urgent, ongoing, normal }

class _TaskCard extends StatelessWidget {
  final entity.Task task;
  final _CardStyle style;
  final VoidCallback onDismiss;

  const _TaskCard({
    required Key key,
    required this.task,
    required this.style,
    required this.onDismiss,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final isUrgent = style == _CardStyle.urgent;
    final isOngoing = style == _CardStyle.ongoing;

    Color? cardColor;
    Color? borderColor;

    if (isUrgent) {
      cardColor = Theme.of(
        context,
      ).colorScheme.errorContainer.withValues(alpha: 0.1);
      borderColor = Theme.of(context).colorScheme.error.withValues(alpha: 0.3);
    } else if (isOngoing) {
      cardColor = Theme.of(
        context,
      ).colorScheme.primaryContainer.withValues(alpha: 0.1);
      borderColor = Theme.of(
        context,
      ).colorScheme.primary.withValues(alpha: 0.3);
    } else {
      cardColor = Theme.of(context).colorScheme.surfaceContainer;
      borderColor = Theme.of(
        context,
      ).colorScheme.outlineVariant.withValues(alpha: 0.3);
    }

    final contextParts = [
      task.areaName,
      task.productName,
      task.topicName,
    ].whereType<String>().where((s) => s.trim().isNotEmpty).toList();
    final contextString = contextParts.join(' > ');
    final hasContext = contextString.isNotEmpty;

    return Dismissible(
      key: key!,
      direction: DismissDirection.startToEnd,
      background: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.only(left: 20),
        decoration: BoxDecoration(
          color: Colors.green,
          borderRadius: BorderRadius.circular(12),
        ),
        alignment: Alignment.centerLeft,
        child: const Icon(Icons.archive_outlined, color: Colors.white),
      ),
      onDismissed: (direction) => onDismiss(),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        child: Material(
          color: cardColor,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: borderColor ?? Colors.transparent),
          ),
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () {
              showModalBottomSheet(
                context: context,
                backgroundColor: Colors.transparent,
                isScrollControlled: true,
                builder: (context) => Padding(
                  padding: EdgeInsets.only(
                    bottom: MediaQuery.of(context).viewInsets.bottom,
                  ),
                  child: TaskEditBottomSheet(task: task),
                ),
              );
            },
            child: Padding(
              padding: const EdgeInsets.all(12.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title Row
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (hasContext)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 4),
                                child: Text(
                                  contextString,
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Theme.of(
                                      context,
                                    ).colorScheme.primary,
                                  ),
                                ),
                              ),
                            Text(
                              task.content,
                              style: const TextStyle(
                                fontWeight: FontWeight.w500,
                                fontSize: 16,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),

                  // Metadata Row (Dates, Progress)
                  if (task.dueDate != null ||
                      (task.subItems?.isNotEmpty ?? false)) ...[
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        if (task.dueDate != null) ...[
                          _DateBadge(
                            date: task.dueDate!,
                            isOverdue: task.isOverdue,
                            isToday: task.isToday,
                          ),
                          if (task.subItems?.isNotEmpty ?? false)
                            const SizedBox(width: 8),
                        ],
                        if (task.subItems?.isNotEmpty ?? false)
                          _ProgressBadge(subItemsCount: task.subItems!.length),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _DateBadge extends StatelessWidget {
  final DateTime date;
  final bool isOverdue;
  final bool isToday;

  const _DateBadge({
    required this.date,
    required this.isOverdue,
    required this.isToday,
  });

  @override
  Widget build(BuildContext context) {
    Color color;
    Color bg;
    if (isOverdue) {
      color = Theme.of(context).colorScheme.onErrorContainer;
      bg = Theme.of(context).colorScheme.errorContainer;
    } else if (isToday) {
      color = Theme.of(context).colorScheme.onTertiaryContainer;
      bg = Theme.of(context).colorScheme.tertiaryContainer;
    } else {
      color = Theme.of(context).colorScheme.onSurfaceVariant;
      bg = Theme.of(context).colorScheme.surfaceContainerHighest;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.calendar_today, size: 10, color: color),
          const SizedBox(width: 4),
          Text(
            DateFormat('MM/dd').format(date),
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          if (isOverdue)
            Text(" (逾期)", style: TextStyle(fontSize: 10, color: color)),
        ],
      ),
    );
  }
}

class _ProgressBadge extends StatelessWidget {
  final int subItemsCount;
  const _ProgressBadge({required this.subItemsCount});

  @override
  Widget build(BuildContext context) {
    if (subItemsCount == 0) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: Colors.blue.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(
          color: Colors.blue.withValues(alpha: 0.3),
          width: 0.5,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.incomplete_circle, size: 10, color: Colors.blue),
          const SizedBox(width: 4),
          Text(
            "進行中 ($subItemsCount 步驟)",
            style: const TextStyle(
              fontSize: 11,
              color: Colors.blue,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}
