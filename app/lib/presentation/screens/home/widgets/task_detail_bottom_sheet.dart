import 'dart:ui' as dart_ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../../core/di/providers.dart';
import '../../../../domain/entities/task.dart';
import '../../../../application/use_cases/update_task_details_use_case.dart';
import '../../../../application/use_cases/update_sub_item_use_case.dart';
import '../../dashboard/widgets/task_edit_bottom_sheet.dart';

/// Task 細節畫面 (BottomSheet) - 唯讀展示 + 輕量操作
///
/// 功能:
/// - 展示任務所有資訊（唯讀）
/// - Sub-items 可勾選完成
/// - 進入編輯畫面
/// - 進入專注模式
/// - 標記為已完成
class TaskDetailBottomSheet extends ConsumerStatefulWidget {
  final Task task;

  const TaskDetailBottomSheet({super.key, required this.task});

  @override
  ConsumerState<TaskDetailBottomSheet> createState() =>
      _TaskDetailBottomSheetState();
}

class _TaskDetailBottomSheetState extends ConsumerState<TaskDetailBottomSheet> {
  bool _isLoading = false;
  // 追蹤樂觀更新的 subitem 狀態 (subItemId -> completed)
  final Map<String, bool> _optimisticSubItemStates = {};
  // 錯誤訊息
  String? _errorMessage;

  /// 處理 sub-item 勾選切換
  Future<void> _handleSubItemToggle(String subItemId, bool completed) async {
    // 使用當前顯示的狀態（可能是樂觀更新的值），而非傳入的參數
    final currentState = _optimisticSubItemStates[subItemId] ?? completed;
    final newCompleted = !currentState;

    // 樂觀更新：立即更新 UI
    HapticFeedback.lightImpact();
    setState(() {
      _optimisticSubItemStates[subItemId] = newCompleted;
    });

    // 發送 API 請求
    final useCase = ref.read(updateSubItemUseCaseProvider);
    final result = await useCase(UpdateSubItemParams(
      taskId: widget.task.id,
      subItemId: subItemId,
      completed: newCompleted,
    ));

    result.fold(
      (failure) {
        // 回滾樂觀更新
        if (mounted) {
          setState(() {
            _optimisticSubItemStates[subItemId] = currentState;
            _errorMessage = '更新失敗: ${failure.message}';
          });
          Future.delayed(const Duration(seconds: 3), () {
            if (mounted) setState(() => _errorMessage = null);
          });
        }
      },
      (_) {
        // 成功，repository 會自動靜默刷新快取
      },
    );
  }

  /// 進入編輯畫面
  Future<void> _handleEdit() async {
    // 關閉當前細節畫面
    Navigator.pop(context);

    // 延遲一下避免動畫衝突
    await Future.delayed(const Duration(milliseconds: 100));

    if (mounted) {
      // 開啟編輯畫面
      await showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (context) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom,
          ),
          child: TaskEditBottomSheet(task: widget.task),
        ),
      );
    }
  }

  /// 進入專注模式
  void _handleStartFocus() {
    Navigator.pop(context);
    context.push('/focus/${widget.task.id}', extra: widget.task);
  }

  /// 標記為已完成
  Future<void> _handleComplete() async {
    setState(() {
      _isLoading = true;
    });

    final useCase = ref.read(updateTaskDetailsUseCaseProvider);
    await useCase(UpdateTaskDetailsParams(
      taskId: widget.task.id,
      status: TaskStatus.archive,
    ));

    // repository 會自動靜默刷新快取
    HapticFeedback.mediumImpact();

    if (mounted) {
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      decoration: BoxDecoration(
        color: const Color(0xFF1c1c1e).withValues(alpha: 0.95),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
        child: BackdropFilter(
          filter: dart_ui.ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: Column(
            children: [
              _buildHandle(),
              _buildHeader(),
              // 錯誤訊息橫幅
              if (_errorMessage != null)
                Container(
                  width: double.infinity,
                  margin: const EdgeInsets.symmetric(horizontal: 20),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.red.withValues(alpha: 0.5)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline, color: Colors.red, size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _errorMessage!,
                          style: const TextStyle(color: Colors.red, fontSize: 14),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, color: Colors.red, size: 18),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                        onPressed: () => setState(() => _errorMessage = null),
                      ),
                    ],
                  ),
                ),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildDatesSection(),
                      const SizedBox(height: 16),
                      _buildTagsSection(),
                      if (widget.task.subItems != null &&
                          widget.task.subItems!.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        _buildSubItemsSection(),
                      ],
                    ],
                  ),
                ),
              ),
              _buildActionButtons(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHandle() {
    return Container(
      margin: const EdgeInsets.only(top: 12, bottom: 8),
      width: 40,
      height: 4,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.3),
        borderRadius: BorderRadius.circular(2),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: Colors.white.withValues(alpha: 0.1),
            width: 1,
          ),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              widget.task.content,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          IconButton(
            icon: const Icon(Icons.close, color: Colors.white70),
            onPressed: () => Navigator.pop(context),
          ),
        ],
      ),
    );
  }

  Widget _buildDatesSection() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            "日期設定",
            style: TextStyle(
              color: Colors.white70,
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 12),
          // 開始日期
          if (widget.task.startDate != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  const Icon(Icons.play_circle_outline,
                      size: 18, color: Colors.blue),
                  const SizedBox(width: 8),
                  const Text(
                    "開始",
                    style: TextStyle(color: Colors.white70, fontSize: 14),
                  ),
                  const Spacer(),
                  Text(
                    DateFormat('yyyy/MM/dd').format(widget.task.startDate!),
                    style: const TextStyle(color: Colors.white, fontSize: 14),
                  ),
                ],
              ),
            ),
          // 截止日期
          if (widget.task.dueDate != null)
            Row(
              children: [
                const Icon(Icons.flag_outlined, size: 18, color: Colors.orange),
                const SizedBox(width: 8),
                const Text(
                  "截止",
                  style: TextStyle(color: Colors.white70, fontSize: 14),
                ),
                const Spacer(),
                Text(
                  DateFormat('yyyy/MM/dd').format(widget.task.dueDate!),
                  style: TextStyle(
                    color: widget.task.dueDate!.isBefore(DateTime.now())
                        ? Colors.red
                        : Colors.white,
                    fontSize: 14,
                  ),
                ),
                if (widget.task.dueDate!.isBefore(DateTime.now()))
                  const Padding(
                    padding: EdgeInsets.only(left: 6),
                    child: Text(
                      "逾期",
                      style: TextStyle(
                        color: Colors.red,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
              ],
            ),
          if (widget.task.startDate == null && widget.task.dueDate == null)
            Text(
              "未設定日期",
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.4),
                fontSize: 14,
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildTagsSection() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            "分類標籤",
            style: TextStyle(
              color: Colors.white70,
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 12),
          // 單行排列的標籤
          Row(
            children: [
              // Area
              if (widget.task.areaName != null) ...[
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFF6C63FF).withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                        color: const Color(0xFF6C63FF).withValues(alpha: 0.4)),
                  ),
                  child: Text(
                    widget.task.areaName!,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
              ],
              // Product
              if (widget.task.productName != null) ...[
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.green.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                        color: Colors.green.withValues(alpha: 0.4)),
                  ),
                  child: Text(
                    widget.task.productName!,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
              ],
              // Topic - 使用 Expanded 讓它佔據剩餘空間並可截斷
              if (widget.task.topicName != null)
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.purple.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(8),
                      border:
                          Border.all(color: Colors.purple.withValues(alpha: 0.4)),
                    ),
                    child: Text(
                      widget.task.topicName!,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSubItemsSection() {
    final subItems = widget.task.subItems!;
    final total = subItems.length;
    // 計算完成數量（考慮樂觀更新）
    final completedCount = subItems.where((s) {
      final optimistic = _optimisticSubItemStates[s.id];
      return optimistic ?? s.completed;
    }).length;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.checklist, size: 18, color: Color(0xFF6C63FF)),
              const SizedBox(width: 8),
              const Text(
                "待辦事項",
                style: TextStyle(
                  color: Colors.white70,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const Spacer(),
              Text(
                "$completedCount/$total 完成",
                style: const TextStyle(
                  fontSize: 12,
                  color: Colors.white54,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Divider(height: 1, color: Colors.white10),
          const SizedBox(height: 8),
          ...subItems.map((sub) {
            // 使用樂觀更新狀態
            final isCompleted = _optimisticSubItemStates[sub.id] ?? sub.completed;

            return Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  InkWell(
                    onTap: () => _handleSubItemToggle(sub.id, isCompleted),
                    child: Padding(
                      padding: const EdgeInsets.all(4),
                      child: AnimatedSwitcher(
                        duration: const Duration(milliseconds: 200),
                        child: Icon(
                          isCompleted
                              ? Icons.check_circle
                              : Icons.circle_outlined,
                          key: ValueKey(isCompleted),
                          size: 20,
                          color: isCompleted
                              ? Colors.green
                              : Colors.white.withValues(alpha: 0.4),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: AnimatedDefaultTextStyle(
                      duration: const Duration(milliseconds: 200),
                      style: TextStyle(
                        color: isCompleted
                            ? Colors.white.withValues(alpha: 0.5)
                            : Colors.white,
                        fontSize: 14,
                        height: 1.4,
                        decoration: isCompleted
                            ? TextDecoration.lineThrough
                            : null,
                      ),
                      child: Text(sub.content),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildActionButtons() {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          // 編輯按鈕
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _isLoading ? null : _handleEdit,
              icon: const Icon(Icons.edit_rounded),
              label: const Text("編輯"),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF6C63FF),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 18),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                elevation: 4,
                shadowColor: const Color(0xFF6C63FF).withValues(alpha: 0.5),
              ),
            ),
          ),
          const SizedBox(height: 12),
          // 進入專注模式
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _isLoading ? null : _handleStartFocus,
              icon: const Icon(Icons.center_focus_strong_rounded),
              label: const Text("進入專注模式"),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.white,
                side: BorderSide(color: Colors.white.withValues(alpha: 0.3)),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          // 標記為已完成
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _isLoading ? null : _handleComplete,
              icon: const Icon(Icons.check_circle, color: Color(0xFF4ADE80)),
              label: const Text(
                "標記為已完成",
                style: TextStyle(color: Color(0xFF4ADE80)),
              ),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Color(0xFF4ADE80)),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
