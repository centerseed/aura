import 'package:flutter/material.dart';
import 'package:app/core/theme/app_colors.dart';
import '../../../../domain/entities/reorganize_proposal.dart';

class ReorganizeBottomSheet extends StatefulWidget {
  final ReorganizeProposal proposal;
  final bool isApplying;
  final void Function({required bool applyTopicOps, required bool applyConsolidations}) onApply;

  const ReorganizeBottomSheet({
    super.key,
    required this.proposal,
    required this.isApplying,
    required this.onApply,
  });

  @override
  State<ReorganizeBottomSheet> createState() => _ReorganizeBottomSheetState();
}

class _ReorganizeBottomSheetState extends State<ReorganizeBottomSheet> {
  bool _applyTopicOps = true;
  bool _applyConsolidations = true;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final taskContextMap = {for (var task in widget.proposal.tasksContext) task.id: task};
    final proposal = widget.proposal;
    final currentTopicCount = proposal.currentTopicCount ?? proposal.currentTopics.length;
    final newTopicCount = proposal.proposedClusters.length;
    final hasConsolidations = proposal.taskConsolidations.isNotEmpty;
    final visibleTopicOps = proposal.topicOperations.where((op) => op.action != 'keep').toList();

    // 建立 consolidation map
    final consolidationMap = <String, String>{};
    for (var consolidation in proposal.taskConsolidations) {
      consolidationMap[consolidation.parentTaskId] = 'p';
      for (var subId in consolidation.subTaskIds) {
        consolidationMap[subId] = 's';
      }
    }

    // 計算每個主題的任務資訊
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

    // 計算移動數
    final changedCount = topicChanges
        .expand((c) => c.tasks)
        .where((t) => t.isMoved && !t.isFromUncategorized)
        .length;
    final unchangedCount = topicChanges
        .expand((c) => c.tasks)
        .where((t) => !t.isMoved)
        .length;
    final hasTopicOps = visibleTopicOps.isNotEmpty;
    final hasChanges = changedCount > 0 || hasTopicOps || topicChanges.any((c) => c.isNew);
    final nothingSelected = !_applyTopicOps && !_applyConsolidations;

    return Container(
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerLow,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(top: BorderSide(color: colorScheme.onSurface.withValues(alpha: 0.1))),
      ),
      child: SafeArea(
        bottom: false,
        child: Column(
        children: [
          // Handle Bar
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: colorScheme.onSurface.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Content
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 標題
                  Row(
                    children: [
                      const Icon(Icons.auto_awesome, color: AppColors.primary, size: 24),
                      const SizedBox(width: 12),
                      Text(
                        'AI 整理建議',
                        style: TextStyle(
                          color: colorScheme.onSurface,
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // ═══════════════════════════════════════
                  // Section 1: 主題重組（topic ops + cluster）
                  // ═══════════════════════════════════════
                  if (hasChanges) ...[
                    _buildSection(
                      color: AppColors.onboardingIndigo,
                      icon: Icons.auto_awesome,
                      title: '主題重組',
                      subtitle: '$currentTopicCount → $newTopicCount 個主題'
                          '${changedCount > 0 ? '，$changedCount 個任務移動' : ''}'
                          '${unchangedCount > 0 ? '，$unchangedCount 個不動' : ''}',
                      checked: _applyTopicOps,
                      onChecked: (v) => setState(() => _applyTopicOps = v),
                      dimmed: !_applyTopicOps,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Topic operations（rename / merge）
                          if (hasTopicOps) ...[
                            Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: Text(
                                '主題整理',
                                style: TextStyle(
                                  color: AppColors.statusInbox.withValues(alpha: 0.8),
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 1,
                                ),
                              ),
                            ),
                            ...visibleTopicOps.map((op) => Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: _buildTopicOpItem(op),
                            )),
                            const SizedBox(height: 8),
                            Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: Text(
                                '任務分配',
                                style: TextStyle(
                                  color: AppColors.onboardingIndigo.withValues(alpha: 0.8),
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 1,
                                ),
                              ),
                            ),
                          ],

                          // Cluster 分配（只顯示有移動任務的 cluster）
                          ...topicChanges.where((change) =>
                            change.tasks.any((t) => t.isMoved && (!t.isFromUncategorized || change.isNew))
                          ).map((change) => Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: _buildClusterCard(change),
                          )),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // ═══════════════════════════════════════
                  // Section 2: 任務整合 (violet)
                  // ═══════════════════════════════════════
                  // 無建議時顯示空白態
                  if (!hasChanges && !hasConsolidations) ...[
                    SizedBox(
                      width: double.infinity,
                      child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 40),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Icon(Icons.check_circle_outline, color: Colors.green, size: 48),
                          const SizedBox(height: 12),
                          Text(
                            '任務已整理好了',
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.onSurface,
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            '目前沒有需要調整的地方',
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5),
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                      ),
                    ),
                  ],

                  if (hasConsolidations) ...[
                    _buildSection(
                      color: AppColors.statusMaintain,
                      icon: Icons.compress,
                      title: '任務整合',
                      subtitle: '${proposal.taskConsolidations.length} 組細碎任務合併',
                      checked: _applyConsolidations,
                      onChecked: (v) => setState(() => _applyConsolidations = v),
                      dimmed: !_applyConsolidations,
                      child: Column(
                        children: proposal.taskConsolidations.map((c) {
                          final parentCtx = taskContextMap[c.parentTaskId];
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Theme.of(context).colorScheme.surfaceContainer,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.08)),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    c.consolidatedTitle,
                                    style: TextStyle(
                                      color: Theme.of(context).colorScheme.onSurface,
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Row(
                                    children: [
                                      _buildTag('主', AppColors.statusMaintain),
                                      const SizedBox(width: 6),
                                      Expanded(
                                        child: Text(
                                          parentCtx?.title ?? c.parentTaskId,
                                          style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7), fontSize: 12),
                                        ),
                                      ),
                                    ],
                                  ),
                                  ...c.subTaskIds.map((subId) {
                                    final subCtx = taskContextMap[subId];
                                    return Padding(
                                      padding: const EdgeInsets.only(top: 4),
                                      child: Row(
                                        children: [
                                          _buildTag('子', AppColors.statusMaintain.withValues(alpha: 0.7)),
                                          const SizedBox(width: 6),
                                          Expanded(
                                            child: Text(
                                              subCtx?.title ?? subId,
                                              style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7), fontSize: 12),
                                            ),
                                          ),
                                        ],
                                      ),
                                    );
                                  }),
                                  if (c.reasoning.isNotEmpty) ...[
                                    const SizedBox(height: 6),
                                    Text(
                                      c.reasoning,
                                      style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6), fontSize: 11),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  const SizedBox(height: 20),
                ],
              ),
            ),
          ),

          // 底部按鈕
          Container(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
            decoration: BoxDecoration(
              border: Border(
                top: BorderSide(color: colorScheme.onSurface.withValues(alpha: 0.1)),
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: widget.isApplying ? null : () => Navigator.pop(context),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: colorScheme.onSurface,
                      side: BorderSide(color: colorScheme.onSurface.withValues(alpha: 0.3)),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('取消', style: TextStyle(fontSize: 16)),
                  ),
                ),
                if (hasChanges || hasConsolidations) ...[
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: FilledButton(
                      onPressed: widget.isApplying || nothingSelected
                          ? null
                          : () => widget.onApply(
                              applyTopicOps: _applyTopicOps,
                              applyConsolidations: _applyConsolidations,
                            ),
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        elevation: 0,
                      ),
                      child: widget.isApplying
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                              ),
                            )
                          : const Text(
                              '套用勾選項目',
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
      ),
    );
  }

  // ─── Section with checkbox header ───
  Widget _buildSection({
    required Color color,
    required IconData icon,
    required String title,
    required String subtitle,
    required bool checked,
    required ValueChanged<bool> onChecked,
    required bool dimmed,
    required Widget child,
  }) {
    return AnimatedOpacity(
      duration: const Duration(milliseconds: 200),
      opacity: dimmed ? 0.45 : 1.0,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Column(
          children: [
            // Header with checkbox
            InkWell(
              onTap: () => onChecked(!checked),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(13)),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(13)),
                ),
                child: Row(
                  children: [
                    SizedBox(
                      width: 22,
                      height: 22,
                      child: Checkbox(
                        value: checked,
                        onChanged: (v) => onChecked(v ?? true),
                        activeColor: color,
                        checkColor: Colors.white,
                        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Icon(icon, color: color, size: 18),
                    const SizedBox(width: 8),
                    Text(
                      title,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.onSurface,
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        subtitle,
                        style: TextStyle(
                          color: color.withValues(alpha: 0.7),
                          fontSize: 12,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            // Body
            Padding(
              padding: const EdgeInsets.all(12),
              child: child,
            ),
          ],
        ),
      ),
    );
  }

  // ─── Topic operation item ───
  Widget _buildTopicOpItem(TopicOperation op) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainer,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.08)),
      ),
      child: op.action == 'rename'
          ? Row(
              children: [
                _buildTag('改名', AppColors.statusInbox),
                const SizedBox(width: 8),
                Text(
                  op.oldName ?? '',
                  style: const TextStyle(
                    color: AppColors.statusArchive,
                    fontSize: 13,
                    decoration: TextDecoration.lineThrough,
                  ),
                ),
                const SizedBox(width: 6),
                const Icon(Icons.arrow_forward, size: 12, color: AppColors.statusArchive),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    op.newName ?? '',
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurface,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            )
          : Row(
              children: [
                _buildTag('合併', AppColors.statusInbox),
                const SizedBox(width: 8),
                Expanded(
                  child: Wrap(
                    spacing: 4,
                    runSpacing: 4,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      ...(op.sourceNames ?? []).map((name) => Text(
                        name,
                        style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6), fontSize: 13),
                      )).toList().expand((w) => [w, const Text(' + ', style: TextStyle(color: AppColors.statusArchive, fontSize: 11))]).toList()..removeLast(),
                      const Icon(Icons.arrow_forward, size: 12, color: AppColors.statusArchive),
                      Text(
                        op.targetName ?? '',
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.onSurface,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }

  // ─── Cluster card（只顯示移動的任務） ───
  Widget _buildClusterCard(_TopicChange change) {
    // 只顯示有移動的任務（未分類 → 新 Topic 也算移動）
    final visibleTasks = change.tasks
        .where((t) => t.isMoved && (!t.isFromUncategorized || change.isNew))
        .toList();

    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainer,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: change.isNew
              ? AppColors.onboardingIndigo.withValues(alpha: 0.4)
              : Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.08),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 主題標題
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: change.isNew
                  ? AppColors.onboardingIndigo.withValues(alpha: 0.12)
                  : Theme.of(context).colorScheme.surfaceContainerHigh,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(11)),
            ),
            child: Row(
              children: [
                Icon(
                  Icons.folder_outlined,
                  size: 16,
                  color: change.isNew ? const Color(0xFF818CF8) : Theme.of(context).colorScheme.onSurfaceVariant,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    change.topicName,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurface,
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
                      color: AppColors.onboardingIndigo.withValues(alpha: 0.3),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text(
                      '新',
                      style: TextStyle(
                        color: Color(0xFF818CF8),
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                Text(
                  '${visibleTasks.length} 個任務移動',
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          // 任務列表（只顯示移動的）
          Padding(
            padding: const EdgeInsets.all(10),
            child: Column(
              children: visibleTasks.map((task) {
                final showFromLabel = !task.isFromUncategorized;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 5),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(top: 5),
                        child: Container(
                          width: 5,
                          height: 5,
                          decoration: BoxDecoration(
                            color: AppColors.statusInbox,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              task.title,
                              style: TextStyle(
                                color: AppColors.statusInbox,
                                fontSize: 13,
                              ),
                            ),
                            if (showFromLabel)
                              Padding(
                                padding: const EdgeInsets.only(top: 2),
                                child: Text(
                                  '從「${task.fromTopic}」移入',
                                  style: TextStyle(
                                    color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5),
                                    fontSize: 11,
                                  ),
                                ),
                              ),
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
    );
  }

  // ─── Small tag widget ───
  Widget _buildTag(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.bold,
        ),
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
}

class _TaskInfo {
  final String id;
  final String title;
  final String fromTopic;
  final bool isMoved;
  final bool isFromUncategorized;
  final String? cRole;

  _TaskInfo({
    required this.id,
    required this.title,
    required this.fromTopic,
    required this.isMoved,
    required this.isFromUncategorized,
    this.cRole,
  });
}
