import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../domain/entities/coach_briefing.dart';
import '../../../../domain/entities/daily_plan.dart';
import '../../../providers/coach_provider.dart';

/// 教練簡報展開 BottomSheet
class CoachBriefingSheet extends ConsumerWidget {
  const CoachBriefingSheet({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(coachBriefingProvider);
    final briefingType = ref.watch(currentBriefingTypeProvider);
    final isMorning = briefingType == BriefingType.morning;

    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (context, scrollController) => Container(
        decoration: const BoxDecoration(
          color: Color(0xFF1A1F2E),
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            // Handle bar
            Container(
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            // Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: Row(
                children: [
                  Text(
                    isMorning ? '☀️' : '🌙',
                    style: const TextStyle(fontSize: 24),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      isMorning ? '今日晨報' : '今日晚報',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  if (state.isGenerating)
                    const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white54,
                      ),
                    )
                  else
                    IconButton(
                      icon: const Icon(Icons.refresh, color: Colors.white54),
                      onPressed: () {
                        ref
                            .read(coachBriefingProvider.notifier)
                            .regenerateBriefing();
                        ref
                            .read(coachBriefingProvider.notifier)
                            .regeneratePlan();
                      },
                      tooltip: '重新生成',
                    ),
                ],
              ),
            ),
            const Divider(color: Colors.white12, height: 1),
            // Content
            Expanded(
              child: ListView(
                controller: scrollController,
                padding: const EdgeInsets.all(20),
                children: [
                  if (state.briefing != null) ...[
                    _buildSummarySection(state.briefing!),
                    const SizedBox(height: 20),
                  ],
                  if (isMorning) ...[
                    // 晨報：完整計畫 + 詳情
                    if (state.plan != null) ...[
                      _buildPlanSection(context, ref, state.plan!),
                      const SizedBox(height: 20),
                    ],
                    if (state.briefing != null) ...[
                      if (state.briefing!.calendarEvents.isNotEmpty) ...[
                        _buildCalendarSection(state.briefing!),
                        const SizedBox(height: 20),
                      ],
                      if (state.briefing!.overdueTasks.isNotEmpty) ...[
                        _buildOverdueSection(state.briefing!),
                        const SizedBox(height: 20),
                      ],
                      if (state.briefing!.conflicts.isNotEmpty) ...[
                        _buildConflictSection(state.briefing!),
                        const SizedBox(height: 20),
                      ],
                      if (state.briefing!.recommendations.isNotEmpty) ...[
                        _buildRecommendationsSection(state.briefing!),
                        const SizedBox(height: 20),
                      ],
                    ],
                  ] else ...[
                    // 晚報：只顯示已完成 + 延後建議
                    if (state.plan != null) ...[
                      _buildEveningCompletedPlanSection(state.plan!),
                      const SizedBox(height: 20),
                    ],
                    if (state.briefing != null &&
                        state.briefing!.completedTasks.isNotEmpty) ...[
                      _buildCompletedSection(state.briefing!),
                      const SizedBox(height: 20),
                    ],
                    if (state.briefing != null &&
                        state.briefing!.deferSuggestions.isNotEmpty) ...[
                      _buildDeferSection(ref, state.briefing!),
                      const SizedBox(height: 20),
                    ],
                  ],
                  if (!state.hasData && !state.isLoading)
                    _buildGeneratePrompt(ref, isMorning),
                  const SizedBox(height: 40),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String icon, String title, Color color) {
    return Row(
      children: [
        Text(icon, style: const TextStyle(fontSize: 16)),
        const SizedBox(width: 8),
        Text(
          title,
          style: TextStyle(
            color: color,
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }

  Widget _buildSummarySection(CoachBriefing briefing) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle('💬', 'AI 摘要', const Color(0xFF6366F1)),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFF6366F1).withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: const Color(0xFF6366F1).withValues(alpha: 0.15),
            ),
          ),
          child: Text(
            briefing.summary,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.8),
              fontSize: 14,
              height: 1.5,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPlanSection(
    BuildContext context,
    WidgetRef ref,
    DailyPlan plan,
  ) {
    final todayItems = plan.items
        .where((i) => i.status == 'today' && !i.completed && !i.deferred)
        .toList();
    final overflowItems = plan.items
        .where((i) => i.status == 'overflow' && !i.completed && !i.deferred)
        .toList();
    final completedItems = plan.items.where((i) => i.completed).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            _buildSectionTitle('📋', '今日計畫', const Color(0xFF3B82F6)),
            const Spacer(),
            if (plan.coachMessage != null)
              Flexible(
                child: Text(
                  plan.coachMessage!,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.4),
                    fontSize: 11,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
          ],
        ),
        // 容量資訊
        if (plan.availableMinutes != null) ...[
          const SizedBox(height: 8),
          Row(
            children: [
              _buildCapacityChip(
                '可用 ${plan.availableMinutes}分',
                const Color(0xFF10B981),
              ),
              const SizedBox(width: 6),
              if (plan.meetingMinutes != null && plan.meetingMinutes! > 0)
                _buildCapacityChip(
                  '會議 ${plan.meetingMinutes}分',
                  const Color(0xFFF59E0B),
                ),
              const SizedBox(width: 6),
              _buildCapacityChip(
                '已排 ${plan.plannedMinutes ?? plan.totalEstimatedMinutes}分',
                const Color(0xFF3B82F6),
              ),
            ],
          ),
        ],
        const SizedBox(height: 12),
        // Today 項目
        ...todayItems.map((item) => _buildPlanItem(ref, item)),
        // Overflow 項目（分隔顯示）
        if (overflowItems.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.only(top: 10, bottom: 8),
            child: Row(
              children: [
                Expanded(
                  child: Container(
                    height: 1,
                    decoration: BoxDecoration(
                      border: Border(
                        bottom: BorderSide(
                          color: Colors.white.withValues(alpha: 0.1),
                          width: 1,
                          style: BorderStyle.solid,
                        ),
                      ),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  child: Text(
                    '明後天代辦',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.35),
                      fontSize: 12,
                    ),
                  ),
                ),
                Expanded(
                  child: Container(
                    height: 1,
                    color: Colors.white.withValues(alpha: 0.1),
                  ),
                ),
              ],
            ),
          ),
          ...overflowItems.map((item) => _buildPlanItem(ref, item)),
        ],
        // 已完成項目
        if (completedItems.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.only(top: 8, bottom: 4),
            child: Text(
              '已完成 (${completedItems.length})',
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.35),
                fontSize: 12,
              ),
            ),
          ),
          ...completedItems.map((item) => _buildPlanItem(ref, item)),
        ],
      ],
    );
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
        style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w500),
      ),
    );
  }

  Widget _buildPlanItem(WidgetRef ref, DailyPlanItem item) {
    final isCompleted = item.completed;
    final isDeferred = item.deferred;
    final accentColor = isCompleted
        ? const Color(0xFF10B981)
        : isDeferred
            ? const Color(0xFF64748B)
            : const Color(0xFF6366F1);

    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: accentColor.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: accentColor.withValues(alpha: 0.12)),
        ),
        child: Row(
          children: [
            // 完成勾選
            GestureDetector(
              onTap: () {
                HapticFeedback.lightImpact();
                ref.read(coachBriefingProvider.notifier).updatePlanItem(
                      itemId: item.id,
                      completed: !isCompleted,
                    );
              },
              child: Container(
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color:
                      isCompleted ? const Color(0xFF10B981) : Colors.transparent,
                  border: Border.all(
                    color: isCompleted
                        ? const Color(0xFF10B981)
                        : Colors.white.withValues(alpha: 0.2),
                    width: 1.5,
                  ),
                ),
                child: isCompleted
                    ? const Icon(Icons.check, size: 12, color: Colors.white)
                    : null,
              ),
            ),
            const SizedBox(width: 10),
            // 內容
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.content,
                    style: TextStyle(
                      color: isCompleted
                          ? Colors.white.withValues(alpha: 0.35)
                          : Colors.white.withValues(alpha: 0.85),
                      fontSize: 14,
                      decoration: isCompleted ? TextDecoration.lineThrough : null,
                      decorationColor: Colors.white.withValues(alpha: 0.3),
                    ),
                  ),
                  if (item.areaName != null || item.productName != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        [item.areaName, item.productName]
                            .whereType<String>()
                            .join(' > '),
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.3),
                          fontSize: 11,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            // 時間估計
            if (item.estimatedMinutes != null)
              Text(
                '${item.estimatedMinutes}分',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.35),
                  fontSize: 11,
                ),
              ),
            // Pin 按鈕
            if (!isCompleted) ...[
              const SizedBox(width: 4),
              GestureDetector(
                onTap: () {
                  HapticFeedback.lightImpact();
                  ref.read(coachBriefingProvider.notifier).updatePlanItem(
                        itemId: item.id,
                        pinned: !item.pinned,
                      );
                },
                child: Icon(
                  item.pinned ? Icons.push_pin : Icons.push_pin_outlined,
                  size: 16,
                  color: item.pinned
                      ? const Color(0xFFF59E0B)
                      : Colors.white.withValues(alpha: 0.2),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildEveningCompletedPlanSection(DailyPlan plan) {
    final completedItems =
        plan.items.where((i) => i.completed && i.status == 'today').toList();

    if (completedItems.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle(
          '🎯',
          '今日計畫成果 (${completedItems.length})',
          const Color(0xFF10B981),
        ),
        const SizedBox(height: 10),
        ...completedItems.map((item) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withValues(alpha: 0.06),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: const Color(0xFF10B981).withValues(alpha: 0.12),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.check_circle,
                      size: 16,
                      color: const Color(0xFF10B981).withValues(alpha: 0.6),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        item.content,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.6),
                          fontSize: 13,
                          decoration: TextDecoration.lineThrough,
                          decorationColor: Colors.white.withValues(alpha: 0.3),
                        ),
                      ),
                    ),
                    if (item.estimatedMinutes != null)
                      Text(
                        '${item.estimatedMinutes}分',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.3),
                          fontSize: 11,
                        ),
                      ),
                  ],
                ),
              ),
            )),
      ],
    );
  }

  Widget _buildCalendarSection(CoachBriefing briefing) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle('📅', '行事曆', const Color(0xFF3B82F6)),
        const SizedBox(height: 10),
        ...briefing.calendarEvents.map((event) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFF3B82F6).withValues(alpha: 0.06),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: const Color(0xFF3B82F6).withValues(alpha: 0.12),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.event,
                      size: 16,
                      color: const Color(0xFF3B82F6).withValues(alpha: 0.6),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            event.summary,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.8),
                              fontSize: 13,
                            ),
                          ),
                          Text(
                            _formatEventTime(event),
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.4),
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (event.meetLink != null)
                      Icon(
                        Icons.videocam_outlined,
                        size: 16,
                        color: const Color(0xFF10B981).withValues(alpha: 0.6),
                      ),
                  ],
                ),
              ),
            )),
      ],
    );
  }

  String _formatEventTime(CalendarEventSummary event) {
    try {
      final start = DateTime.parse(event.startDateTime).toLocal();
      final end = DateTime.parse(event.endDateTime).toLocal();
      return '${start.hour.toString().padLeft(2, '0')}:${start.minute.toString().padLeft(2, '0')}'
          ' - ${end.hour.toString().padLeft(2, '0')}:${end.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return '';
    }
  }

  Widget _buildOverdueSection(CoachBriefing briefing) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle('🔴', '逾期任務', const Color(0xFFEF4444)),
        const SizedBox(height: 10),
        ...briefing.overdueTasks.map((task) => _buildTaskSummaryTile(
              task,
              const Color(0xFFEF4444),
              suffix: task.daysOverdue != null ? '逾期 ${task.daysOverdue} 天' : null,
            )),
      ],
    );
  }

  Widget _buildConflictSection(CoachBriefing briefing) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle('⚠️', '衝突偵測', const Color(0xFFF59E0B)),
        const SizedBox(height: 10),
        ...briefing.conflicts.map((conflict) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFFF59E0B).withValues(alpha: 0.06),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: const Color(0xFFF59E0B).withValues(alpha: 0.12),
                  ),
                ),
                child: Text(
                  conflict.description,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.7),
                    fontSize: 13,
                  ),
                ),
              ),
            )),
      ],
    );
  }

  Widget _buildRecommendationsSection(CoachBriefing briefing) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle('💡', 'AI 建議', const Color(0xFF10B981)),
        const SizedBox(height: 10),
        ...briefing.recommendations.map((rec) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withValues(alpha: 0.06),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: const Color(0xFF10B981).withValues(alpha: 0.12),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      rec.action,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.85),
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    if (rec.reasoning.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        rec.reasoning,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.45),
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            )),
      ],
    );
  }

  Widget _buildCompletedSection(CoachBriefing briefing) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle(
            '✅', '今日完成 (${briefing.completedTasks.length})', const Color(0xFF4ADE80)),
        const SizedBox(height: 10),
        ...briefing.completedTasks.map((task) => _buildTaskSummaryTile(
              task,
              const Color(0xFF4ADE80),
              isCompleted: true,
            )),
      ],
    );
  }

  Widget _buildDeferSection(WidgetRef ref, CoachBriefing briefing) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle('⏳', '延後建議', const Color(0xFF64748B)),
        const SizedBox(height: 10),
        ...briefing.deferSuggestions.map((suggestion) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFF64748B).withValues(alpha: 0.06),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: const Color(0xFF64748B).withValues(alpha: 0.12),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      suggestion.taskContent,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.7),
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      suggestion.reasoning,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.4),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            )),
      ],
    );
  }

  Widget _buildTaskSummaryTile(
    TaskSummary task,
    Color color, {
    String? suffix,
    bool isCompleted = false,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withValues(alpha: 0.12)),
        ),
        child: Row(
          children: [
            if (isCompleted)
              Icon(Icons.check_circle, size: 16, color: color.withValues(alpha: 0.6)),
            if (isCompleted) const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    task.content,
                    style: TextStyle(
                      color: isCompleted
                          ? Colors.white.withValues(alpha: 0.4)
                          : Colors.white.withValues(alpha: 0.8),
                      fontSize: 13,
                      decoration:
                          isCompleted ? TextDecoration.lineThrough : null,
                    ),
                  ),
                  if (task.areaName != null || task.productName != null)
                    Text(
                      [task.areaName, task.productName]
                          .whereType<String>()
                          .join(' > '),
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.3),
                        fontSize: 11,
                      ),
                    ),
                ],
              ),
            ),
            if (suffix != null)
              Text(
                suffix,
                style: TextStyle(color: color, fontSize: 11),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildGeneratePrompt(WidgetRef ref, bool isMorning) {
    final accentColor =
        isMorning ? const Color(0xFFF59E0B) : const Color(0xFF8B5CF6);

    return Center(
      child: Column(
        children: [
          const SizedBox(height: 40),
          Text(
            isMorning ? '☀️' : '🌙',
            style: const TextStyle(fontSize: 48),
          ),
          const SizedBox(height: 16),
          Text(
            isMorning ? '尚未生成今日晨報' : '尚未生成今日晚報',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.5),
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: () {
              ref.read(coachBriefingProvider.notifier).regenerateBriefing();
              ref.read(coachBriefingProvider.notifier).regeneratePlan();
            },
            icon: const Icon(Icons.auto_awesome, size: 18),
            label: Text(isMorning ? '生成晨報' : '生成晚報'),
            style: ElevatedButton.styleFrom(
              backgroundColor: accentColor.withValues(alpha: 0.2),
              foregroundColor: accentColor,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
