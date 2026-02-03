import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../domain/entities/milestone.dart';

/// 里程碑卡片
class MilestoneCard extends StatelessWidget {
  final Milestone milestone;
  final VoidCallback? onTap;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;

  const MilestoneCard({
    super.key,
    required this.milestone,
    this.onTap,
    this.onEdit,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    // 根據狀態和時間決定顏色
    Color cardColor;
    Color borderColor;
    Color statusColor;
    Color statusBgColor;

    if (milestone.isOverdue && milestone.isActive) {
      // 逾期且活躍
      cardColor = colorScheme.errorContainer.withValues(alpha: 0.1);
      borderColor = colorScheme.error.withValues(alpha: 0.3);
      statusColor = colorScheme.error;
      statusBgColor = colorScheme.error.withValues(alpha: 0.1);
    } else if (milestone.isUrgent && milestone.isActive) {
      // 緊急（7天內）
      cardColor = Colors.orange.withValues(alpha: 0.1);
      borderColor = Colors.orange.withValues(alpha: 0.3);
      statusColor = Colors.orange;
      statusBgColor = Colors.orange.withValues(alpha: 0.1);
    } else if (milestone.status == MilestoneStatus.inProgress) {
      // 進行中
      cardColor = colorScheme.primaryContainer.withValues(alpha: 0.1);
      borderColor = colorScheme.primary.withValues(alpha: 0.3);
      statusColor = colorScheme.primary;
      statusBgColor = colorScheme.primary.withValues(alpha: 0.1);
    } else if (milestone.status == MilestoneStatus.completed) {
      // 已完成
      cardColor = Colors.green.withValues(alpha: 0.1);
      borderColor = Colors.green.withValues(alpha: 0.3);
      statusColor = Colors.green;
      statusBgColor = Colors.green.withValues(alpha: 0.1);
    } else {
      // 計畫中或其他
      cardColor = colorScheme.surfaceContainerHighest;
      borderColor = colorScheme.outlineVariant.withValues(alpha: 0.3);
      statusColor = colorScheme.onSurfaceVariant;
      statusBgColor = colorScheme.surfaceContainerHighest;
    }

    return Material(
      color: cardColor,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: borderColor),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 標題行
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 圖標
                  Icon(
                    Icons.flag_rounded,
                    size: 18,
                    color: statusColor,
                  ),
                  const SizedBox(width: 8),
                  // 名稱
                  Expanded(
                    child: Text(
                      milestone.name,
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                        color: colorScheme.onSurface,
                      ),
                    ),
                  ),
                  // 狀態標籤
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: statusBgColor,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      milestone.status.displayName,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: statusColor,
                      ),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 8),

              // 日期和剩餘天數
              Row(
                children: [
                  Icon(
                    Icons.calendar_today_rounded,
                    size: 12,
                    color: colorScheme.onSurfaceVariant.withValues(alpha: 0.6),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    DateFormat('yyyy/MM/dd').format(milestone.targetDate),
                    style: TextStyle(
                      fontSize: 12,
                      color: colorScheme.onSurfaceVariant.withValues(alpha: 0.8),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '·',
                    style: TextStyle(
                      color: colorScheme.onSurfaceVariant.withValues(alpha: 0.4),
                    ),
                  ),
                  const SizedBox(width: 8),
                  _buildDaysRemainingText(context, statusColor),
                ],
              ),

              // 描述（如果有）
              if (milestone.description != null &&
                  milestone.description!.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  milestone.description!,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12,
                    color: colorScheme.onSurfaceVariant.withValues(alpha: 0.7),
                  ),
                ),
              ],

              // 優先級指示器（高優先級才顯示）
              if (milestone.priority >= 8) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    Icon(
                      Icons.priority_high_rounded,
                      size: 14,
                      color: Colors.orange.withValues(alpha: 0.8),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      '高優先級',
                      style: TextStyle(
                        fontSize: 11,
                        color: Colors.orange.withValues(alpha: 0.8),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDaysRemainingText(BuildContext context, Color statusColor) {
    final days = milestone.daysRemaining;
    final colorScheme = Theme.of(context).colorScheme;

    String text;
    Color color;

    if (milestone.status == MilestoneStatus.completed) {
      text = '已完成';
      color = Colors.green;
    } else if (milestone.status == MilestoneStatus.cancelled) {
      text = '已取消';
      color = colorScheme.onSurfaceVariant.withValues(alpha: 0.5);
    } else if (days < 0) {
      text = '逾期 ${days.abs()} 天';
      color = colorScheme.error;
    } else if (days == 0) {
      text = '今天截止';
      color = Colors.orange;
    } else if (days <= 7) {
      text = '剩餘 $days 天';
      color = Colors.orange;
    } else {
      text = '剩餘 $days 天';
      color = colorScheme.onSurfaceVariant.withValues(alpha: 0.6);
    }

    return Text(
      text,
      style: TextStyle(
        fontSize: 12,
        fontWeight: days <= 7 ? FontWeight.w600 : FontWeight.normal,
        color: color,
      ),
    );
  }
}
