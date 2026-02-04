import 'package:flutter/material.dart';
import '../../../../domain/entities/reorganize_proposal.dart';

class ReorganizeBottomSheet extends StatelessWidget {
  final ReorganizeProposal proposal;
  final bool isApplying;
  final VoidCallback onApply;

  const ReorganizeBottomSheet({
    super.key,
    required this.proposal,
    required this.isApplying,
    required this.onApply,
  });

  @override
  Widget build(BuildContext context) {
    final taskContextMap = {for (var task in proposal.tasksContext) task.id: task};

    // 計算變化
    final currentTopicCount = proposal.currentTopicCount ?? proposal.currentTopics.length;
    final newTopicCount = proposal.proposedClusters.length;
    final hasConsolidations = proposal.taskConsolidations.isNotEmpty;
    final topicDiff = newTopicCount - currentTopicCount;

    // 建立 consolidation map (用於顯示「主」「子」標記)
    final consolidationMap = <String, String>{};
    for (var consolidation in proposal.taskConsolidations) {
      consolidationMap[consolidation.parentTaskId] = 'p';
      for (var subId in consolidation.subTaskIds) {
        consolidationMap[subId] = 's';
      }
    }

    // 計算每個分類的任務資訊
    final topicChanges = <_TopicChange>[];
    for (var cluster in proposal.proposedClusters) {
      final isNew = !proposal.currentTopics.contains(cluster.topicName);
      final taskInfos = cluster.taskIds.map((id) {
        final context = taskContextMap[id];
        if (context == null) return null;

        final currentTopic = context.currentTopic;
        final isMoved = currentTopic != cluster.topicName;
        final isFromUncategorized = currentTopic == '未分類';

        return _TaskInfo(
          id: id,
          title: context.title,
          fromTopic: currentTopic,
          isMoved: isMoved,
          isFromUncategorized: isFromUncategorized,
          cRole: consolidationMap[id],
        );
      }).where((t) => t != null).cast<_TaskInfo>().toList();

      topicChanges.add(_TopicChange(
        topicName: cluster.topicName,
        isNew: isNew,
        tasks: taskInfos,
      ));
    }

    // 計算有多少任務被移動（排除從「未分類」來的）
    final movedTasksCount = topicChanges
        .expand((change) => change.tasks)
        .where((task) => task.isMoved && !task.isFromUncategorized)
        .length;

    // 判斷是否有實質性變化
    final hasNoChanges = topicDiff == 0 && !hasConsolidations && movedTasksCount == 0;

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF0D1117),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(top: BorderSide(color: Colors.white.withValues(alpha: 0.1))),
      ),
      child: Column(
        children: [
          // Handle Bar
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Content
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 標題
                  const Row(
                    children: [
                      Icon(Icons.auto_awesome, color: Color(0xFF6C63FF), size: 24),
                      SizedBox(width: 12),
                      Text(
                        'AI 整理建議',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  // Before & After 對比
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B).withValues(alpha: 0.5),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                    ),
                    child: Column(
                      children: [
                        // Before
                        Row(
                          children: [
                            Container(
                              width: 6,
                              height: 6,
                              decoration: BoxDecoration(
                                color: Colors.red.withValues(alpha: 0.6),
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              '現在：$currentTopicCount 個分類',
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.7),
                                fontSize: 15,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),

                        // Arrow
                        Icon(
                          Icons.arrow_downward,
                          color: Colors.white.withValues(alpha: 0.3),
                          size: 20,
                        ),
                        const SizedBox(height: 12),

                        // After
                        Row(
                          children: [
                            Container(
                              width: 6,
                              height: 6,
                              decoration: const BoxDecoration(
                                color: Color(0xFF6C63FF),
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              '整理後：$newTopicCount 個分類',
                              style: const TextStyle(
                                color: Color(0xFF6C63FF),
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  // 當 AI 判定不需要調整時的訊息
                  if (hasNoChanges) ...[
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            Color(0xFF064E3B),
                            Color(0xFF0D1117),
                          ],
                        ),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: const Color(0xFF10B981).withValues(alpha: 0.2),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.check_circle,
                              color: Color(0xFF10B981),
                              size: 22,
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  '✅ 目前的分類組織已經很合理',
                                  style: TextStyle(
                                    color: Color(0xFF6EE7B7),
                                    fontSize: 15,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'AI 分析後認為現有的 $currentTopicCount 個分類和任務分布都很清晰，不需要進行調整。',
                                  style: TextStyle(
                                    color: const Color(0xFF6EE7B7).withValues(alpha: 0.7),
                                    fontSize: 13,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                  ],

                  // 任務整合說明（如果有）
                  if (hasConsolidations) ...[
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFF6C63FF).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFF6C63FF).withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.merge_type, color: Color(0xFF6C63FF), size: 18),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              '「主」任務保留，「子」任務變成待辦事項',
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.9),
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                  ],

                  // 分類列表標題
                  Row(
                    children: [
                      const Text(
                        '重組後的分類',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '($newTopicCount 個)',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.5),
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // 每個分類的任務列表
                  ...topicChanges.map((change) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Container(
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E293B).withValues(alpha: 0.5),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: change.isNew
                              ? const Color(0xFF6C63FF).withValues(alpha: 0.4)
                              : Colors.white.withValues(alpha: 0.1),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // 分類標題
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            decoration: BoxDecoration(
                              color: change.isNew
                                  ? const Color(0xFF6C63FF).withValues(alpha: 0.12)
                                  : const Color(0xFF334155).withValues(alpha: 0.25),
                              borderRadius: const BorderRadius.vertical(top: Radius.circular(11)),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  Icons.folder_outlined,
                                  size: 16,
                                  color: change.isNew ? const Color(0xFF8B85FF) : Colors.white60,
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    change.topicName,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                                if (change.isNew)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    margin: const EdgeInsets.only(right: 6),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF6C63FF).withValues(alpha: 0.3),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: const Text(
                                      '新',
                                      style: TextStyle(
                                        color: Color(0xFF8B85FF),
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                Text(
                                  '${change.totalTasks}',
                                  style: TextStyle(
                                    color: Colors.white.withValues(alpha: 0.5),
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          ),

                          // 任務列表
                          Padding(
                            padding: const EdgeInsets.all(10),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: change.tasks.map((task) {
                                return Padding(
                                  padding: const EdgeInsets.only(bottom: 6),
                                  child: Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      // Bullet point
                                      Padding(
                                        padding: const EdgeInsets.only(top: 4),
                                        child: Container(
                                          width: 4,
                                          height: 4,
                                          decoration: BoxDecoration(
                                            color: task.isMoved && !task.isFromUncategorized
                                                ? const Color(0xFFF59E0B)
                                                : Colors.white.withValues(alpha: 0.4),
                                            shape: BoxShape.circle,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      // 任務內容
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Row(
                                              children: [
                                                Expanded(
                                                  child: Text(
                                                    task.title,
                                                    style: TextStyle(
                                                      color: task.isMoved && !task.isFromUncategorized
                                                          ? const Color(0xFFF59E0B)
                                                          : Colors.white.withValues(alpha: 0.85),
                                                      fontSize: 13,
                                                    ),
                                                  ),
                                                ),
                                                // 「主」「子」標記
                                                if (task.cRole != null) ...[
                                                  const SizedBox(width: 6),
                                                  Container(
                                                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                                                    decoration: BoxDecoration(
                                                      color: task.cRole == 'p'
                                                          ? const Color(0xFF6C63FF).withValues(alpha: 0.2)
                                                          : const Color(0xFF6C63FF).withValues(alpha: 0.1),
                                                      borderRadius: BorderRadius.circular(3),
                                                    ),
                                                    child: Text(
                                                      task.cRole == 'p' ? '主' : '子',
                                                      style: TextStyle(
                                                        color: task.cRole == 'p'
                                                            ? const Color(0xFF8B85FF)
                                                            : const Color(0xFF8B85FF).withValues(alpha: 0.6),
                                                        fontSize: 10,
                                                        fontWeight: FontWeight.bold,
                                                      ),
                                                    ),
                                                  ),
                                                ],
                                              ],
                                            ),
                                            // 只在真的從其他 topic 移動過來時才顯示來源（排除「未分類」）
                                            if (task.isMoved && !task.isFromUncategorized) ...[
                                              const SizedBox(height: 2),
                                              Text(
                                                '← ${task.fromTopic}',
                                                style: TextStyle(
                                                  color: Colors.white.withValues(alpha: 0.35),
                                                  fontSize: 11,
                                                ),
                                              ),
                                            ],
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                );
                              }).toList(),
                            ),
                          ),
                        ],
                      ),
                    ),
                  )),

                  const SizedBox(height: 30),
                ],
              ),
            ),
          ),

          // 底部按鈕
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              border: Border(
                top: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: isApplying ? null : () => Navigator.pop(context),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white,
                      side: BorderSide(color: Colors.white.withValues(alpha: 0.3)),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: Text(hasNoChanges ? '關閉' : '取消', style: const TextStyle(fontSize: 16)),
                  ),
                ),
                if (!hasNoChanges) ...[
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: FilledButton(
                      onPressed: isApplying ? null : onApply,
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF6C63FF),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        elevation: 0,
                      ),
                      child: isApplying
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                              ),
                            )
                          : const Text(
                              '套用',
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
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
}

class _TopicChange {
  final String topicName;
  final bool isNew;
  final List<_TaskInfo> tasks;

  _TopicChange({
    required this.topicName,
    required this.isNew,
    required this.tasks,
  });

  int get totalTasks => tasks.length;
  List<_TaskInfo> get movedTasks => tasks.where((t) => t.isMoved && !t.isFromUncategorized).toList();
}

class _TaskInfo {
  final String id;
  final String title;
  final String fromTopic;
  final bool isMoved;
  final bool isFromUncategorized;
  final String? cRole; // 'p' = parent, 's' = sub

  _TaskInfo({
    required this.id,
    required this.title,
    required this.fromTopic,
    required this.isMoved,
    required this.isFromUncategorized,
    this.cRole,
  });
}
