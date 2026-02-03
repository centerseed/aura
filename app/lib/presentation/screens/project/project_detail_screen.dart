import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../domain/entities/product.dart';
import '../../providers/task_provider.dart';
import '../../providers/reorganize_provider.dart';

import '../../../domain/entities/reorganize_proposal.dart';
import '../dashboard/widgets/task_edit_bottom_sheet.dart';
import 'widgets/milestone_section.dart';

class ProjectDetailScreen extends ConsumerWidget {
  final Product product;

  const ProjectDetailScreen({super.key, required this.product});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final taskState = ref.watch(activeTasksProvider);

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      appBar: AppBar(
        backgroundColor: Theme.of(context).colorScheme.surface,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          product.name,
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 18,
          ),
        ),
        actions: [
          // AI Magic Sparkle Button
          Padding(
            padding: const EdgeInsets.only(right: 8.0),
            child: InkWell(
              onTap: () => _showAIMagicSheet(context),
              borderRadius: BorderRadius.circular(12),
              child: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFF6C63FF).withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: const Color(0xFF6C63FF).withValues(alpha: 0.5),
                    width: 1,
                  ),
                ),
                child: const Icon(
                  Icons.auto_awesome,
                  color: Color(0xFF8F8AFF),
                  size: 20,
                ),
              ),
            ),
          ),
        ],
      ),
      body: _buildBody(context, ref, taskState),
    );
  }

  Widget _buildBody(BuildContext context, WidgetRef ref, TaskDataState taskState) {
    // Loading state
    if (taskState.showLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    // Error state
    if (taskState.hasError) {
      return Center(child: Text("載入錯誤: ${taskState.error}"));
    }

    // Data state
    if (!taskState.hasData) {
      return const Center(child: CircularProgressIndicator());
    }

    final projectTasks = taskState.tasks!
        .where((t) => t.productId == product.id)
        .toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
      children: [
        // 里程碑區塊
        MilestoneSection(
          productId: product.id,
          productName: product.name,
        ),

        // 任務區塊標題
        if (projectTasks.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              children: [
                Icon(
                  Icons.task_alt_rounded,
                  size: 18,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(width: 8),
                Text(
                  '任務',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                    color: Theme.of(context).colorScheme.onSurface,
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    '${projectTasks.length}',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                  ),
                ),
              ],
            ),
          ),

        // 空白狀態（無任務）
        if (projectTasks.isEmpty)
          Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 40),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.task_alt_rounded,
                    size: 48,
                    color: Theme.of(context).colorScheme.onSurfaceVariant.withValues(alpha: 0.3),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    "專案內無待辦事項",
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurfaceVariant.withValues(alpha: 0.5),
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),
          ),

        // 任務列表
        ...projectTasks.asMap().entries.map((entry) {
          final index = entry.key;
          final task = entry.value;
          // Use Material Design style matching Focus list
                      final contextParts = [
                        task.topicName,
                      ].whereType<String>().where((s) => s.trim().isNotEmpty).toList();
                      final contextString = contextParts.join(' > ');
                      final hasContext = contextString.isNotEmpty;

                      // Determine card style based on task state
                      Color? cardColor;
                      Color? borderColor;

                      if (task.isOverdue || task.isToday) {
                        // Urgent style
                        cardColor = Theme.of(context).colorScheme.errorContainer.withValues(alpha: 0.1);
                        borderColor = Theme.of(context).colorScheme.error.withValues(alpha: 0.3);
                      } else if (task.isStarted) {
                        // Ongoing style
                        cardColor = Theme.of(context).colorScheme.primaryContainer.withValues(alpha: 0.1);
                        borderColor = Theme.of(context).colorScheme.primary.withValues(alpha: 0.3);
                      } else {
                        // Normal style
                        cardColor = Theme.of(context).colorScheme.surfaceContainer;
                        borderColor = Theme.of(context).colorScheme.outlineVariant.withValues(alpha: 0.3);
                      }

                      return Container(
                        margin: EdgeInsets.only(
                          top: index == 0 ? 10 : 0,
                          bottom: 8,
                        ),
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
                                                    color: Theme.of(context).colorScheme.primary,
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
                                  if (task.dueDate != null || (task.subItems?.isNotEmpty ?? false)) ...[
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
                                          _ProgressBadge(
                                            completedCount: task.subItems!.where((s) => s.completed).length,
                                            totalCount: task.subItems!.length,
                                          ),
                                      ],
                                    ),
                                  ],

                                  // SubItems expanded view
                                  if (task.subItems != null && task.subItems!.isNotEmpty) ...[
                                    const SizedBox(height: 12),
                                    const Divider(height: 1),
                                    const SizedBox(height: 8),
                                    ...task.subItems!.map(
                                      (sub) => InkWell(
                                        onTap: () {
                                          ref
                                              .read(taskControllerProvider.notifier)
                                              .updateSubItemStatus(
                                                task,
                                                sub.id,
                                                !sub.completed,
                                              );
                                        },
                                        child: Padding(
                                          padding: const EdgeInsets.only(bottom: 6.0, top: 2.0),
                                          child: Row(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Padding(
                                                padding: const EdgeInsets.only(
                                                  top: 2,
                                                  right: 10,
                                                ),
                                                child: Icon(
                                                  sub.completed
                                                      ? Icons.check_circle
                                                      : Icons.circle_outlined,
                                                  size: 16,
                                                  color: sub.completed
                                                      ? Colors.green
                                                      : Theme.of(context).colorScheme.onSurfaceVariant.withValues(alpha: 0.4),
                                                ),
                                              ),
                                              Expanded(
                                                child: Text(
                                                  sub.content,
                                                  style: TextStyle(
                                                    color: sub.completed
                                                        ? Theme.of(context).colorScheme.onSurfaceVariant.withValues(alpha: 0.5)
                                                        : Theme.of(context).colorScheme.onSurfaceVariant,
                                                    fontSize: 14,
                                                    height: 1.4,
                                                    decoration: sub.completed
                                                        ? TextDecoration.lineThrough
                                                        : null,
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ),
                        ),
                      );
        }),
      ],
    );
  }

  void _showAIMagicSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => _AIMagicSheet(productId: product.id),
    );
  }
}

class _AIMagicSheet extends ConsumerStatefulWidget {
  final String productId;

  const _AIMagicSheet({required this.productId});

  @override
  ConsumerState<_AIMagicSheet> createState() => _AIMagicSheetState();
}

class TopicFlow {
  final String fromTopic;
  final String toTopic;
  final int taskCount;
  final bool isNew;
  final bool isSame;

  TopicFlow({
    required this.fromTopic,
    required this.toTopic,
    required this.taskCount,
    required this.isNew,
    required this.isSame,
  });
}

class _FlowCount {
  final String from;
  final String to;
  int count;

  _FlowCount({
    required this.from,
    required this.to,
    required this.count,
  });
}

class _AIMagicSheetState extends ConsumerState<_AIMagicSheet>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();

    // Trigger analysis on open
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(reorganizeControllerProvider.notifier).analyze(widget.productId);
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Map<String, dynamic> _calculateFlowData(ReorganizeProposal proposal) {
    if (proposal.tasksContext.isEmpty) {
      return {
        'flows': <TopicFlow>[],
        'changedCount': 0,
        'unchangedCount': 0,
      };
    }

    // 建立 taskId -> newTopic 的映射
    final taskToNewTopic = <String, String>{};
    for (var cluster in proposal.proposedClusters) {
      for (var taskId in cluster.taskIds) {
        taskToNewTopic[taskId] = cluster.topicName;
      }
    }

    // 統計每個流動
    final flowMap = <String, _FlowCount>{};
    for (var task in proposal.tasksContext) {
      final newTopic = taskToNewTopic[task.id] ?? '未分類';
      final key = '${task.currentTopic}|$newTopic';
      final existing = flowMap[key];
      if (existing != null) {
        existing.count++;
      } else {
        flowMap[key] = _FlowCount(
          from: task.currentTopic,
          to: newTopic,
          count: 1,
        );
      }
    }

    // 計算原本的 Topic 統計
    final currentTopicStats = <String, int>{};
    for (var task in proposal.tasksContext) {
      currentTopicStats[task.currentTopic] =
          (currentTopicStats[task.currentTopic] ?? 0) + 1;
    }

    // 轉換成流動陣列
    final flows = flowMap.values
        .map((f) => TopicFlow(
              fromTopic: f.from,
              toTopic: f.to,
              taskCount: f.count,
              isNew: !currentTopicStats.containsKey(f.to),
              isSame: f.from == f.to,
            ))
        .toList();

    // 排序
    flows.sort((a, b) => a.fromTopic.compareTo(b.fromTopic));

    // 計算變動數量
    final unchangedCount =
        flows.where((f) => f.isSame).fold<int>(0, (acc, f) => acc + f.taskCount);
    final changedCount = proposal.tasksContext.length - unchangedCount;

    return {
      'flows': flows,
      'changedCount': changedCount,
      'unchangedCount': unchangedCount,
    };
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(reorganizeControllerProvider);
    final proposal = ref.watch(reorganizeProposalProvider);
    final isLoading = state is AsyncLoading;

    // Determine state
    final isAnalyzing = proposal == null && isLoading;
    final isApplying = proposal != null && isLoading;

    return BackdropFilter(
      filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
      child: Container(
        height: 600,
        decoration: BoxDecoration(
          color: const Color(0xFF1c1c1e).withOpacity(0.9),
          borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
          border: Border.all(color: Colors.white.withOpacity(0.1)),
        ),
        child: Column(
          children: [
            // Handle
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 12, bottom: 24),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),

            if (state.hasError)
              Expanded(
                child: Center(
                  child: Text(
                    "分析失敗\n${state.error}",
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.redAccent),
                  ),
                ),
              )
            else if (isAnalyzing)
              _buildAnalyzingView()
            else if (proposal != null)
              _buildSuggestionView(proposal, isApplying)
            else
              // Fallback or empty state
              const Expanded(child: Center(child: Text("Ready"))),
          ],
        ),
      ),
    );
  }

  Widget _buildAnalyzingView() {
    return Expanded(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          RotationTransition(
            turns: _controller,
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF6C63FF).withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.auto_awesome,
                color: Color(0xFF6C63FF),
                size: 48,
              ),
            ),
          ),
          const SizedBox(height: 24),
          const Text(
            "AI 正在分析專案結構...",
            style: TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            "尋找可優化的任務與屬性",
            style: TextStyle(
              color: Colors.white.withOpacity(0.5),
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSuggestionView(ReorganizeProposal proposal, bool isApplying) {
    // 計算流向資料
    final flowData = _calculateFlowData(proposal);
    final totalTasks = proposal.tasksContext.length;
    final currentTopicCount = proposal.currentTopicCount ?? proposal.currentTopics.length;
    final newTopicCount = proposal.proposedClusters.length;
    final changedCount = flowData['changedCount'] as int;
    final unchangedCount = flowData['unchangedCount'] as int;
    final flows = flowData['flows'] as List<TopicFlow>;
    final changedFlows = flows.where((f) => !f.isSame).toList();

    // 建立 taskId -> context 的映射 (用於整合卡片顯示)
    final taskContextMap = <String, TaskContext>{};
    for (var task in proposal.tasksContext) {
      taskContextMap[task.id] = task;
    }

    return Expanded(
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 20.0),
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.auto_awesome, color: Color(0xFF6C63FF), size: 24),
                  SizedBox(width: 8),
                  Text(
                    "AI 重組建議",
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              IconButton(
                icon: Icon(Icons.close, color: Colors.white.withOpacity(0.5)),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),

          // 變化摘要
          Padding(
            padding: const EdgeInsets.only(top: 8, bottom: 16),
            child: Wrap(
              spacing: 16,
              runSpacing: 8,
              children: [
                // Topic 數量變化
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      "Topic",
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.6),
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      "$currentTopicCount",
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Icon(Icons.arrow_forward, size: 12, color: Colors.white54),
                    const SizedBox(width: 4),
                    Text(
                      "$newTopicCount",
                      style: const TextStyle(
                        color: Color(0xFF6C63FF),
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                // 任務重新分配數量
                if (changedCount > 0)
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.move_down,
                        size: 14,
                        color: const Color(0xFFFFD700).withOpacity(0.8),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        "$changedCount/$totalTasks 個任務重新分配",
                        style: TextStyle(
                          color: const Color(0xFFFFD700).withOpacity(0.8),
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                // 整合數量
                if (proposal.taskConsolidations.isNotEmpty)
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.layers,
                        size: 14,
                        color: const Color(0xFF6C63FF).withOpacity(0.8),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        "${proposal.taskConsolidations.length} 組整合",
                        style: TextStyle(
                          color: const Color(0xFF6C63FF).withOpacity(0.8),
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),

          const SizedBox(height: 8),

          // 流向圖 - 顯示有變動的流向
          if (changedFlows.isNotEmpty)
            ...changedFlows.map((flow) => _buildFlowCard(flow)),

          // 不變的統計
          if (unchangedCount > 0)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text(
                "其餘 $unchangedCount 個任務維持原本的分類",
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white.withOpacity(0.4),
                  fontSize: 13,
                ),
              ),
            ),

          // 完全沒有變動
          if (changedFlows.isEmpty && proposal.taskConsolidations.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 40),
              child: Center(
                child: Column(
                  children: [
                    Text(
                      "所有任務的分類維持不變",
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.4),
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      "AI 認為目前的分類已經很好了",
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.3),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ),

          const SizedBox(height: 16),

          // 整合卡片
          ...proposal.taskConsolidations.map((c) => _buildGroupingCard(c, taskContextMap)),

          const SizedBox(height: 30),

          // Action Button
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: isApplying
                  ? null
                  : () async {
                      await ref
                          .read(reorganizeControllerProvider.notifier)
                          .apply(widget.productId);
                      if (context.mounted) {
                        Navigator.pop(context);
                        // ignore: use_build_context_synchronously
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text("已套用重組建議")),
                        );
                        // repository 會自動靜默刷新快取
                      }
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF6C63FF),
                disabledBackgroundColor: const Color(
                  0xFF6C63FF,
                ).withOpacity(0.5),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                elevation: 0,
              ),
              child: isApplying
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Text(
                      "應用重組",
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
            ),
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildFlowCard(TopicFlow flow) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF1c1c1e).withOpacity(0.5),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withOpacity(0.05)),
      ),
      child: Row(
        children: [
          // From Topic
          Expanded(
            child: Text(
              flow.fromTopic,
              style: TextStyle(
                color: Colors.white.withOpacity(0.6),
                fontSize: 13,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: 8),
          // Arrow with count
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: const Color(0xFFFFD700).withOpacity(0.1),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              "${flow.taskCount}",
              style: const TextStyle(
                color: Color(0xFFFFD700),
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(width: 4),
          const Icon(
            Icons.arrow_forward,
            size: 16,
            color: Color(0xFFFFD700),
          ),
          const SizedBox(width: 8),
          // To Topic
          Expanded(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Flexible(
                  child: Text(
                    flow.toTopic,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.end,
                  ),
                ),
                if (flow.isNew) ...[
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFF6C63FF).withOpacity(0.2),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text(
                      "新",
                      style: TextStyle(
                        color: Color(0xFF6C63FF),
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildGroupingCard(TaskConsolidation c, Map<String, TaskContext> taskContextMap) {
    // 取得主任務和子任務的標題
    final parentTask = taskContextMap[c.parentTaskId];
    final subTasks = c.subTaskIds
        .map((id) => taskContextMap[id])
        .where((task) => task != null)
        .cast<TaskContext>()
        .toList();

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF161621),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF6C63FF).withOpacity(0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 整合標題
          Row(
            children: [
              const Icon(Icons.layers, color: Color(0xFF6C63FF), size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  c.consolidatedTitle,
                  style: const TextStyle(
                    color: Color(0xFF9D97FF),
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.only(left: 26.0, top: 2),
            child: Text(
              "${c.subTaskIds.length + 1} 個任務整合為待辦清單",
              style: TextStyle(
                color: Colors.white.withOpacity(0.4),
                fontSize: 11,
              ),
            ),
          ),
          const SizedBox(height: 14),

          // 整合的任務列表
          Padding(
            padding: const EdgeInsets.only(left: 26.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 主任務
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      margin: const EdgeInsets.only(top: 5),
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(
                        color: Color(0xFF6C63FF),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        parentTask?.title ?? c.parentTaskId,
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 12,
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFF6C63FF).withOpacity(0.2),
                        borderRadius: BorderRadius.circular(3),
                      ),
                      child: const Text(
                        "主任務",
                        style: TextStyle(fontSize: 9, color: Color(0xFF8F8AFF)),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                // 子任務
                ...subTasks.map((task) => Padding(
                  padding: const EdgeInsets.only(bottom: 6, left: 8),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        margin: const EdgeInsets.only(top: 5),
                        width: 4,
                        height: 4,
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.3),
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          task.title,
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.5),
                            fontSize: 11,
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        "子項目",
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.3),
                          fontSize: 9,
                        ),
                      ),
                    ],
                  ),
                )),
              ],
            ),
          ),

          // 整合理由
          Padding(
            padding: const EdgeInsets.only(left: 26.0, top: 10),
            child: Container(
              padding: const EdgeInsets.only(top: 10),
              decoration: BoxDecoration(
                border: Border(
                  top: BorderSide(
                    color: Colors.white.withOpacity(0.05),
                  ),
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "理由：",
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.5),
                      fontSize: 11,
                    ),
                  ),
                  Expanded(
                    child: Text(
                      c.reasoning,
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.4),
                        fontSize: 11,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

}

// Badge widgets matching dashboard style
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
  final int completedCount;
  final int totalCount;

  const _ProgressBadge({
    required this.completedCount,
    required this.totalCount,
  });

  @override
  Widget build(BuildContext context) {
    if (totalCount == 0) return const SizedBox.shrink();
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
            "$completedCount/$totalCount",
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
