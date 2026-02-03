import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../domain/entities/milestone.dart';
import '../../../providers/milestone_provider.dart';
import 'milestone_card.dart';
import 'milestone_edit_bottom_sheet.dart';

/// 里程碑區塊
///
/// 顯示特定 Product 的所有里程碑，支援展開/摺疊
class MilestoneSection extends ConsumerStatefulWidget {
  final String productId;
  final String productName;

  const MilestoneSection({
    super.key,
    required this.productId,
    required this.productName,
  });

  @override
  ConsumerState<MilestoneSection> createState() => _MilestoneSectionState();
}

class _MilestoneSectionState extends ConsumerState<MilestoneSection> {
  bool _isExpanded = true;

  @override
  Widget build(BuildContext context) {
    final milestonesAsync = ref.watch(productMilestonesProvider(widget.productId));
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return milestonesAsync.when(
      loading: () => _buildLoadingState(colorScheme),
      error: (error, stack) => _buildErrorState(error, colorScheme),
      data: (milestones) => _buildContent(milestones, colorScheme),
    );
  }

  Widget _buildLoadingState(ColorScheme colorScheme) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainer,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: colorScheme.outlineVariant.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: colorScheme.primary.withValues(alpha: 0.5),
            ),
          ),
          const SizedBox(width: 12),
          Text(
            '載入里程碑...',
            style: TextStyle(
              color: colorScheme.onSurfaceVariant.withValues(alpha: 0.6),
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorState(Object error, ColorScheme colorScheme) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colorScheme.errorContainer.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: colorScheme.error.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.error_outline,
            size: 18,
            color: colorScheme.error,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              '載入里程碑失敗',
              style: TextStyle(
                color: colorScheme.error,
                fontSize: 13,
              ),
            ),
          ),
          TextButton(
            onPressed: () {
              ref.invalidate(productMilestonesProvider(widget.productId));
            },
            child: const Text('重試'),
          ),
        ],
      ),
    );
  }

  Widget _buildContent(List<Milestone> milestones, ColorScheme colorScheme) {
    // 過濾出未完成的里程碑（包含逾期但未完成的）
    final activeMilestones =
        milestones.where((m) => m.isActive).toList();

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainer,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: colorScheme.outlineVariant.withValues(alpha: 0.3),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 標題列
          InkWell(
            onTap: () {
              setState(() {
                _isExpanded = !_isExpanded;
              });
            },
            borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  Icon(
                    Icons.flag_rounded,
                    size: 18,
                    color: colorScheme.primary,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '里程碑',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                      color: colorScheme.onSurface,
                    ),
                  ),
                  if (activeMilestones.isNotEmpty) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: colorScheme.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '${activeMilestones.length}',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: colorScheme.primary,
                        ),
                      ),
                    ),
                  ],
                  const Spacer(),
                  // 新增按鈕
                  IconButton(
                    onPressed: () => _showAddMilestoneSheet(context),
                    icon: Icon(
                      Icons.add_rounded,
                      size: 20,
                      color: colorScheme.primary,
                    ),
                    style: IconButton.styleFrom(
                      padding: const EdgeInsets.all(4),
                      minimumSize: const Size(32, 32),
                    ),
                    tooltip: '新增里程碑',
                  ),
                  const SizedBox(width: 4),
                  // 展開/摺疊按鈕
                  Icon(
                    _isExpanded
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    size: 20,
                    color: colorScheme.onSurfaceVariant.withValues(alpha: 0.6),
                  ),
                ],
              ),
            ),
          ),

          // 內容區域（摺疊動畫）
          AnimatedCrossFade(
            firstChild: const SizedBox.shrink(),
            secondChild: _buildMilestonesList(
              activeMilestones,
              colorScheme,
            ),
            crossFadeState: _isExpanded
                ? CrossFadeState.showSecond
                : CrossFadeState.showFirst,
            duration: const Duration(milliseconds: 200),
          ),
        ],
      ),
    );
  }

  Widget _buildMilestonesList(
    List<Milestone> activeMilestones,
    ColorScheme colorScheme,
  ) {
    if (activeMilestones.isEmpty) {
      return _buildEmptyState(colorScheme);
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ...activeMilestones.map((milestone) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: MilestoneCard(
                  milestone: milestone,
                  onTap: () => _showEditMilestoneSheet(context, milestone),
                ),
              )),
        ],
      ),
    );
  }

  Widget _buildEmptyState(ColorScheme colorScheme) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 24),
        child: Column(
          children: [
            Icon(
              Icons.flag_outlined,
              size: 32,
              color: colorScheme.onSurfaceVariant.withValues(alpha: 0.3),
            ),
            const SizedBox(height: 8),
            Text(
              '尚無里程碑',
              style: TextStyle(
                color: colorScheme.onSurfaceVariant.withValues(alpha: 0.5),
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              '點擊上方 + 按鈕新增',
              style: TextStyle(
                color: colorScheme.onSurfaceVariant.withValues(alpha: 0.4),
                fontSize: 11,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showAddMilestoneSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
        ),
        child: MilestoneEditBottomSheet(
          productId: widget.productId,
          productName: widget.productName,
        ),
      ),
    );
  }

  void _showEditMilestoneSheet(BuildContext context, Milestone milestone) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
        ),
        child: MilestoneEditBottomSheet(
          productId: widget.productId,
          productName: widget.productName,
          editingMilestone: milestone,
        ),
      ),
    );
  }
}
