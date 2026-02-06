import 'dart:ui' as dart_ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/di/providers.dart';
import '../../../../domain/entities/task.dart';
import '../../../../domain/entities/area.dart';
import '../../../../domain/entities/product.dart';
import '../../../../application/use_cases/update_task_details_use_case.dart';
import '../../../../application/use_cases/update_sub_item_use_case.dart';
import '../../../../application/use_cases/add_sub_item_use_case.dart';
import '../../../../application/use_cases/delete_sub_item_use_case.dart';
import '../../../../application/use_cases/promote_sub_item_use_case.dart';
import '../../../../application/use_cases/reorder_sub_items_use_case.dart';
import '../../../../application/use_cases/schedule_task_reminder_use_case.dart';
import '../../../../application/use_cases/cancel_task_reminder_use_case.dart';
import '../../../providers/area_provider.dart';
import '../../../providers/product_provider.dart';
import '../../../providers/task_provider.dart';

/// Task 編輯畫面 (BottomSheet) - 完整編輯功能
///
/// 支援功能:
/// - 編輯任務標題 (content)
/// - 選擇開始日期 (start_date)
/// - 選擇截止日期 (due_date)
/// - 選擇 Area / Product / Topic
/// - 管理 Sub-items (顯示、勾選、新增、刪除、編輯)
/// - 標記為已完成
/// - 進入專注模式
class TaskEditBottomSheet extends ConsumerStatefulWidget {
  final Task task;

  const TaskEditBottomSheet({super.key, required this.task});

  @override
  ConsumerState<TaskEditBottomSheet> createState() =>
      _TaskEditBottomSheetState();
}

class _TaskEditBottomSheetState extends ConsumerState<TaskEditBottomSheet> {
  // 任務基本資訊
  late TextEditingController _contentController;
  late DateTime? _selectedStartDate;
  late DateTime? _selectedDueDate;

  // 提醒設定
  late DateTime? _selectedRemindAt;
  late bool _reminderEnabled;

  // 分類選擇
  late String? _selectedProductId;
  late String? _selectedTopicId;
  String? _selectedAreaId;

  // Sub-items 本地狀態
  late List<SubItemEditState> _subItems;

  // Sub-items 編輯模式 (用於拖拽排序)
  bool _isSubItemEditMode = false;

  bool _isLoading = false;

  // 錯誤訊息狀態
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _contentController = TextEditingController(text: widget.task.content);
    _selectedStartDate = widget.task.startDate;
    _selectedDueDate = widget.task.dueDate;
    _selectedRemindAt = widget.task.remindAt;
    _reminderEnabled = widget.task.reminderEnabled;
    _selectedProductId = widget.task.productId;
    _selectedTopicId = widget.task.topicId;

    // 初始化 sub-items 本地狀態
    _subItems = (widget.task.subItems ?? [])
        .map((sub) => SubItemEditState(
              id: sub.id,
              content: sub.content,
              completed: sub.completed,
            ))
        .toList();
  }

  @override
  void dispose() {
    _contentController.dispose();
    super.dispose();
  }

  Future<void> _showDatePicker({
    required String title,
    required DateTime? initialDate,
    required Function(DateTime?) onDateSelected,
  }) async {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final tomorrow = today.add(const Duration(days: 1));
    // 計算下週一
    final daysUntilNextMonday = (DateTime.monday - today.weekday + 7) % 7;
    final nextMonday = today.add(Duration(days: daysUntilNextMonday == 0 ? 7 : daysUntilNextMonday));

    final result = await showModalBottomSheet<DateTime?>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: const BoxDecoration(
          color: Color(0xFF2c2c2e),
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.symmetric(vertical: 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              title,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            _buildQuickDateOption(
              context,
              icon: Icons.today,
              label: '今天',
              subtitle: DateFormat('MM/dd (E)', 'zh_TW').format(today),
              color: Colors.blue,
              date: today,
              isSelected: initialDate != null &&
                  initialDate.year == today.year &&
                  initialDate.month == today.month &&
                  initialDate.day == today.day,
            ),
            _buildQuickDateOption(
              context,
              icon: Icons.wb_sunny_outlined,
              label: '明天',
              subtitle: DateFormat('MM/dd (E)', 'zh_TW').format(tomorrow),
              color: Colors.orange,
              date: tomorrow,
              isSelected: initialDate != null &&
                  initialDate.year == tomorrow.year &&
                  initialDate.month == tomorrow.month &&
                  initialDate.day == tomorrow.day,
            ),
            _buildQuickDateOption(
              context,
              icon: Icons.next_week_outlined,
              label: '下週一',
              subtitle: DateFormat('MM/dd (E)', 'zh_TW').format(nextMonday),
              color: Colors.purple,
              date: nextMonday,
              isSelected: initialDate != null &&
                  initialDate.year == nextMonday.year &&
                  initialDate.month == nextMonday.month &&
                  initialDate.day == nextMonday.day,
            ),
            const Divider(color: Colors.white12, height: 1, indent: 16, endIndent: 16),
            ListTile(
              leading: const Icon(Icons.calendar_month, color: Colors.green, size: 22),
              title: const Text('自訂日期...', style: TextStyle(color: Colors.white, fontSize: 15)),
              onTap: () async {
                Navigator.pop(context); // 先關閉 bottom sheet
                final picked = await showDatePicker(
                  context: this.context,
                  initialDate: initialDate ?? DateTime.now(),
                  firstDate: DateTime.now().subtract(const Duration(days: 365)),
                  lastDate: DateTime.now().add(const Duration(days: 365 * 2)),
                  builder: (context, child) {
                    return Theme(
                      data: ThemeData.dark().copyWith(
                        colorScheme: const ColorScheme.dark(
                          primary: Color(0xFF6C63FF),
                          surface: Color(0xFF1c1c1e),
                        ),
                      ),
                      child: child!,
                    );
                  },
                );
                if (picked != null) {
                  onDateSelected(picked);
                }
              },
            ),
            if (initialDate != null) ...[
              const Divider(color: Colors.white12, height: 1, indent: 16, endIndent: 16),
              ListTile(
                leading: Icon(Icons.clear, color: Colors.red.withValues(alpha: 0.7), size: 22),
                title: Text('清除日期', style: TextStyle(color: Colors.red.withValues(alpha: 0.7), fontSize: 15)),
                onTap: () {
                  onDateSelected(null);
                  Navigator.pop(context);
                },
              ),
            ],
            SizedBox(height: MediaQuery.of(context).padding.bottom),
          ],
        ),
      ),
    );

    if (result != null) {
      onDateSelected(result);
    }
  }

  Widget _buildQuickDateOption(
    BuildContext context, {
    required IconData icon,
    required String label,
    required String subtitle,
    required Color color,
    required DateTime date,
    required bool isSelected,
  }) {
    return ListTile(
      leading: Icon(icon, color: color, size: 22),
      title: Text(label, style: const TextStyle(color: Colors.white, fontSize: 15)),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            subtitle,
            style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 13),
          ),
          if (isSelected) ...[
            const SizedBox(width: 8),
            const Icon(Icons.check_circle, color: Color(0xFF6C63FF), size: 18),
          ],
        ],
      ),
      onTap: () => Navigator.pop(context, date),
    );
  }

  Future<void> _handleSaveChanges() async {
    final content = _contentController.text.trim();
    if (content.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('任務內容不能為空')),
      );
      return;
    }

    // 驗證提醒設定
    if (_reminderEnabled && _selectedRemindAt == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('請設定提醒時間')),
      );
      return;
    }

    setState(() => _isLoading = true);

    // 1. 先更新任務基本資訊
    final useCase = ref.read(updateTaskDetailsUseCaseProvider);
    final result = await useCase(UpdateTaskDetailsParams(
      taskId: widget.task.id,
      content: content,
      startDate: _selectedStartDate,
      dueDate: _selectedDueDate,
      productId: _selectedProductId,
      topicId: _selectedTopicId,
    ));

    await result.fold(
      (failure) async {
        setState(() => _isLoading = false);
        if (mounted) {
          setState(() {
            _errorMessage = '儲存失敗: ${failure.message}';
          });
          Future.delayed(const Duration(seconds: 3), () {
            if (mounted) {
              setState(() => _errorMessage = null);
            }
          });
        }
      },
      (updatedTask) async {
        // 2. 處理提醒設定
        await _handleReminderUpdate(content);

        setState(() => _isLoading = false);

        // 3. 觸發靜默刷新
        await silentRefreshTasks(ref);

        if (mounted) {
          Navigator.pop(context);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('變更已儲存')),
          );
        }
      },
    );
  }

  /// 處理提醒的新增/更新/取消
  Future<void> _handleReminderUpdate(String taskContent) async {
    final wasReminderEnabled = widget.task.reminderEnabled;
    final oldRemindAt = widget.task.remindAt;

    // Case 1: 從無提醒 → 啟用提醒
    if (!wasReminderEnabled && _reminderEnabled && _selectedRemindAt != null) {
      final scheduleUseCase = ref.read(scheduleTaskReminderUseCaseProvider);
      final result = await scheduleUseCase(ScheduleReminderParams(
        taskId: widget.task.id,
        taskContent: taskContent,
        remindAt: _selectedRemindAt!,
        productName: widget.task.productName,
      ));

      result.fold(
        (failure) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('設定提醒失敗: ${failure.message}')),
            );
          }
        },
        (_) {},
      );
    }
    // Case 2: 從有提醒 → 取消提醒
    else if (wasReminderEnabled && !_reminderEnabled) {
      final cancelUseCase = ref.read(cancelTaskReminderUseCaseProvider);
      final result = await cancelUseCase(widget.task.id);

      result.fold(
        (failure) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('取消提醒失敗: ${failure.message}')),
            );
          }
        },
        (_) {},
      );
    }
    // Case 3: 提醒時間有變更
    else if (_reminderEnabled &&
        _selectedRemindAt != null &&
        oldRemindAt != _selectedRemindAt) {
      // 先取消舊提醒
      final cancelUseCase = ref.read(cancelTaskReminderUseCaseProvider);
      await cancelUseCase(widget.task.id);

      // 再設定新提醒
      final scheduleUseCase = ref.read(scheduleTaskReminderUseCaseProvider);
      final result = await scheduleUseCase(ScheduleReminderParams(
        taskId: widget.task.id,
        taskContent: taskContent,
        remindAt: _selectedRemindAt!,
        productName: widget.task.productName,
      ));

      result.fold(
        (failure) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('更新提醒失敗: ${failure.message}')),
            );
          }
        },
        (_) {},
      );
    }
  }


  Future<void> _handleSubItemToggle(String subItemId, bool completed) async {
    HapticFeedback.lightImpact();

    final newCompleted = !completed;

    // 先更新本地狀態（樂觀更新）
    setState(() {
      final index = _subItems.indexWhere((s) => s.id == subItemId);
      if (index != -1) {
        _subItems[index] = _subItems[index].copyWith(completed: newCompleted);
      }
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
            final index = _subItems.indexWhere((s) => s.id == subItemId);
            if (index != -1) {
              _subItems[index] = _subItems[index].copyWith(completed: completed);
            }
            _errorMessage = '更新失敗: ${failure.message}';
          });
          Future.delayed(const Duration(seconds: 3), () {
            if (mounted) setState(() => _errorMessage = null);
          });
        }
      },
      (_) {
        // 觸發靜默刷新
        silentRefreshTasks(ref);
      },
    );
  }

  Future<void> _handleAddSubItem() async {
    final controller = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('新增待辦項目'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: '輸入項目內容',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: const Text('新增'),
          ),
        ],
      ),
    );

    if (result != null && result.isNotEmpty) {
      // 樂觀更新：先添加本地項目
      final tempId = DateTime.now().millisecondsSinceEpoch.toString();
      setState(() {
        _subItems.add(SubItemEditState(
          id: tempId,
          content: result,
          completed: false,
        ));
      });

      final useCase = ref.read(addSubItemUseCaseProvider);
      final apiResult = await useCase(AddSubItemParams(
        taskId: widget.task.id,
        content: result,
      ));

      apiResult.fold(
        (failure) {
          // 回滾：移除剛才添加的項目
          if (mounted) {
            setState(() {
              _subItems.removeWhere((s) => s.id == tempId);
              _errorMessage = '新增失敗: ${failure.message}';
            });
            Future.delayed(const Duration(seconds: 3), () {
              if (mounted) setState(() => _errorMessage = null);
            });
          }
        },
        (_) {
          // 觸發靜默刷新
          silentRefreshTasks(ref);
        },
      );
    }
  }

  Future<void> _handleDeleteSubItem(String subItemId) async {
    // 樂觀更新：先保存並移除
    final index = _subItems.indexWhere((s) => s.id == subItemId);
    if (index == -1) return;

    final removedItem = _subItems[index];
    setState(() {
      _subItems.removeAt(index);
    });

    final useCase = ref.read(deleteSubItemUseCaseProvider);
    final result = await useCase(DeleteSubItemParams(
      taskId: widget.task.id,
      subItemId: subItemId,
    ));

    result.fold(
      (failure) {
        // 回滾：恢復被刪除的項目
        if (mounted) {
          setState(() {
            _subItems.insert(index, removedItem);
            _errorMessage = '刪除失敗: ${failure.message}';
          });
          Future.delayed(const Duration(seconds: 3), () {
            if (mounted) setState(() => _errorMessage = null);
          });
        }
      },
      (_) {
        // 觸發靜默刷新
        silentRefreshTasks(ref);
      },
    );
  }

  /// 升級 sub-item 為獨立任務
  Future<void> _handlePromoteSubItem(String subItemId) async {
    // 確認對話框
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF2c2c2e),
        title: const Text('升級為獨立任務', style: TextStyle(color: Colors.white)),
        content: const Text(
          '確定要將此待辦項目升級為獨立任務嗎？',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('確定', style: TextStyle(color: Color(0xFF6C63FF))),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    // 樂觀更新：先移除
    final index = _subItems.indexWhere((s) => s.id == subItemId);
    if (index == -1) return;

    final removedItem = _subItems[index];
    setState(() {
      _subItems.removeAt(index);
    });

    final useCase = ref.read(promoteSubItemUseCaseProvider);
    final result = await useCase(PromoteSubItemParams(
      taskId: widget.task.id,
      subItemId: subItemId,
    ));

    result.fold(
      (failure) {
        // 回滾：恢復被移除的項目
        if (mounted) {
          setState(() {
            _subItems.insert(index, removedItem);
            _errorMessage = '升級失敗: ${failure.message}';
          });
          Future.delayed(const Duration(seconds: 3), () {
            if (mounted) setState(() => _errorMessage = null);
          });
        }
      },
      (newTask) {
        // 觸發靜默刷新
        silentRefreshTasks(ref);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('已升級為獨立任務: ${newTask.content}'),
              backgroundColor: const Color(0xFF6C63FF),
            ),
          );
        }
      },
    );
  }

  /// 處理 sub-items 拖拽排序
  Future<void> _handleReorderSubItems(int oldIndex, int newIndex) async {
    // 調整 newIndex (當向下拖拽時需要減 1)
    if (newIndex > oldIndex) {
      newIndex -= 1;
    }

    // 保存原始順序（用於回滾）
    final originalOrder = List<SubItemEditState>.from(_subItems);

    // 樂觀更新本地順序
    setState(() {
      final item = _subItems.removeAt(oldIndex);
      _subItems.insert(newIndex, item);
    });

    // 觸覺反饋
    HapticFeedback.mediumImpact();

    // 調用 API 更新後端順序
    final subItemIds = _subItems.map((s) => s.id).toList();
    final useCase = ref.read(reorderSubItemsUseCaseProvider);
    final result = await useCase(ReorderSubItemsParams(
      taskId: widget.task.id,
      subItemIds: subItemIds,
    ));

    result.fold(
      (failure) {
        // 回滾到原始順序
        if (mounted) {
          setState(() {
            _subItems
              ..clear()
              ..addAll(originalOrder);
            _errorMessage = '排序失敗: ${failure.message}';
          });
          Future.delayed(const Duration(seconds: 3), () {
            if (mounted) setState(() => _errorMessage = null);
          });
        }
      },
      (_) {
        // 觸發靜默刷新
        silentRefreshTasks(ref);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.9,
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
                child: GestureDetector(
                  onTap: () => FocusScope.of(context).unfocus(),
                  behavior: HitTestBehavior.opaque,
                  child: SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildTitleRow(),
                        _buildDivider(),
                        _buildDatesRow(),
                        _buildDivider(),
                        _buildReminderRow(),
                        _buildDivider(),
                        _buildCategoryChips(),
                        if (_subItems.isNotEmpty) ...[
                          _buildDivider(),
                          _buildSubItemsSection(),
                        ],
                      ],
                    ),
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
      margin: const EdgeInsets.only(top: 12, bottom: 4),
      width: 40,
      height: 4,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.3),
        borderRadius: BorderRadius.circular(2),
      ),
    );
  }

  Widget _buildDivider() {
    return Divider(
      height: 1,
      thickness: 0.5,
      color: Colors.white.withValues(alpha: 0.1),
      indent: 20,
      endIndent: 20,
    );
  }

  /// 標題行：大字 TextField 直接編輯 + 關閉按鈕
  Widget _buildTitleRow() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: TextField(
              controller: _contentController,
              maxLines: null,
              minLines: 1,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
              decoration: InputDecoration.collapsed(
                hintText: '輸入任務內容...',
                hintStyle: TextStyle(
                  color: Colors.white.withValues(alpha: 0.3),
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: () => Navigator.pop(context),
            child: Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.close,
                color: Colors.white.withValues(alpha: 0.6),
                size: 20,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// 日期並排一行：開始 | 截止
  Widget _buildDatesRow() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Row(
        children: [
          // 開始日期
          Expanded(
            child: _buildDateCell(
              icon: Icons.play_circle_outline,
              iconColor: Colors.blue,
              label: '開始',
              date: _selectedStartDate,
              dateColor: Colors.blue,
              onTap: () => _showDatePicker(
                title: '選擇開始日期',
                initialDate: _selectedStartDate,
                onDateSelected: (date) => setState(() => _selectedStartDate = date),
              ),
            ),
          ),
          Container(
            height: 24,
            width: 0.5,
            color: Colors.white.withValues(alpha: 0.15),
            margin: const EdgeInsets.symmetric(horizontal: 12),
          ),
          // 截止日期
          Expanded(
            child: _buildDateCell(
              icon: Icons.flag_outlined,
              iconColor: Colors.orange,
              label: '截止',
              date: _selectedDueDate,
              dateColor: Colors.orange,
              onTap: () => _showDatePicker(
                title: '選擇截止日期',
                initialDate: _selectedDueDate,
                onDateSelected: (date) => setState(() => _selectedDueDate = date),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDateCell({
    required IconData icon,
    required Color iconColor,
    required String label,
    required DateTime? date,
    required Color dateColor,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            Icon(icon, size: 18, color: iconColor),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.6),
                fontSize: 14,
              ),
            ),
            const Spacer(),
            Text(
              date != null ? DateFormat('MM/dd').format(date) : '未設定',
              style: TextStyle(
                color: date != null ? dateColor : Colors.white.withValues(alpha: 0.3),
                fontSize: 14,
                fontWeight: date != null ? FontWeight.w600 : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// 提醒單行：icon + 文字 + 時間 + Switch
  Widget _buildReminderRow() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
      child: Row(
        children: [
          Icon(
            Icons.notifications_outlined,
            size: 18,
            color: _reminderEnabled ? const Color(0xFFFFB020) : Colors.white.withValues(alpha: 0.6),
          ),
          const SizedBox(width: 6),
          Text(
            '提醒',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.6),
              fontSize: 14,
            ),
          ),
          const Spacer(),
          if (_reminderEnabled && _selectedRemindAt != null)
            GestureDetector(
              onTap: _showReminderTimePicker,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Text(
                  DateFormat('MM/dd HH:mm').format(_selectedRemindAt!),
                  style: const TextStyle(
                    color: Color(0xFFFFB020),
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            )
          else if (_reminderEnabled)
            GestureDetector(
              onTap: _showReminderTimePicker,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Text(
                  '設定時間',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.3),
                    fontSize: 13,
                  ),
                ),
              ),
            ),
          SizedBox(
            height: 32,
            child: FittedBox(
              child: Switch(
                value: _reminderEnabled,
                onChanged: (value) {
                  setState(() {
                    _reminderEnabled = value;
                    if (value && _selectedRemindAt == null) {
                      _showReminderTimePicker();
                    }
                    if (!value) {
                      _selectedRemindAt = null;
                    }
                  });
                },
                activeTrackColor: const Color(0xFFFFB020),
                activeThumbColor: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _showReminderTimePicker() async {
    // 1. 先選日期
    final pickedDate = await showDatePicker(
      context: context,
      initialDate: _selectedRemindAt ?? DateTime.now(),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365 * 2)),
      builder: (context, child) {
        return Theme(
          data: ThemeData.dark().copyWith(
            colorScheme: const ColorScheme.dark(
              primary: Color(0xFFFFB020),
              surface: Color(0xFF1c1c1e),
            ),
          ),
          child: child!,
        );
      },
    );

    if (pickedDate != null && mounted) {
      // 2. 再選時間
      final pickedTime = await showTimePicker(
        context: context,
        initialTime: _selectedRemindAt != null
            ? TimeOfDay.fromDateTime(_selectedRemindAt!)
            : TimeOfDay.now(),
        builder: (context, child) {
          return Theme(
            data: ThemeData.dark().copyWith(
              colorScheme: const ColorScheme.dark(
                primary: Color(0xFFFFB020),
                surface: Color(0xFF1c1c1e),
              ),
            ),
            child: child!,
          );
        },
      );

      if (pickedTime != null && mounted) {
        final remindAt = DateTime(
          pickedDate.year,
          pickedDate.month,
          pickedDate.day,
          pickedTime.hour,
          pickedTime.minute,
        );

        // 驗證提醒時間不能在過去
        if (remindAt.isBefore(DateTime.now())) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('提醒時間不能設定在過去')),
          );
          return;
        }

        setState(() {
          _selectedRemindAt = remindAt;
        });
      }
    }
  }

  /// 分類 chips 行
  Widget _buildCategoryChips() {
    final areasAsync = ref.watch(areasProvider);
    final productsAsync = ref.watch(productsProvider);

    // 初始化 _selectedAreaId：從 products 中反向查找
    if (_selectedAreaId == null) {
      productsAsync.whenData((eitherProducts) {
        eitherProducts.fold(
          (_) {},
          (products) {
            if (products.isNotEmpty && _selectedProductId != null) {
              final currentProduct = products.firstWhere(
                (p) => p.id == _selectedProductId,
                orElse: () => products.first,
              );
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (mounted && _selectedAreaId == null) {
                  setState(() {
                    _selectedAreaId = currentProduct.areaId;
                  });
                }
              });
            }
          },
        );
      });
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              '分類',
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.6),
                fontSize: 14,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Wrap(
              spacing: 8,
              runSpacing: 6,
              children: [
                // Area chip
                areasAsync.when(
                  data: (eitherAreas) {
                    return eitherAreas.fold(
                      (failure) => _buildChip('載入失敗', Colors.red),
                      (areas) {
                        if (areas.isEmpty) return _buildChip('無領域', Colors.grey);
                        if (_selectedAreaId == null) {
                          return const SizedBox(
                            width: 20, height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          );
                        }
                        final selectedArea = areas.firstWhere(
                          (area) => area.id == _selectedAreaId,
                          orElse: () => areas.first,
                        );
                        return _buildChip(
                          selectedArea.name,
                          const Color(0xFF6C63FF),
                          onTap: () => _showAreaSelector(areas),
                        );
                      },
                    );
                  },
                  loading: () => const SizedBox(
                    width: 20, height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                  error: (err, _) => _buildChip('載入失敗', Colors.red),
                ),
                // Product chip
                productsAsync.when(
                  data: (eitherProducts) {
                    return eitherProducts.fold(
                      (failure) => _buildChip('載入失敗', Colors.red),
                      (products) {
                        if (_selectedAreaId == null) {
                          return const SizedBox(
                            width: 20, height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          );
                        }
                        final filteredProducts = products
                            .where((product) => product.areaId == _selectedAreaId)
                            .toList();
                        if (filteredProducts.isEmpty) {
                          return _buildChip('無專案', Colors.grey);
                        }
                        // 檢查當前選中的 Product 是否屬於選中的 Area
                        final currentProductInArea = filteredProducts.any(
                          (product) => product.id == _selectedProductId,
                        );
                        if (!currentProductInArea) {
                          WidgetsBinding.instance.addPostFrameCallback((_) {
                            if (mounted) {
                              setState(() {
                                _selectedProductId = filteredProducts.first.id;
                                _selectedTopicId = null;
                              });
                            }
                          });
                        }
                        final selectedProduct = filteredProducts.firstWhere(
                          (product) => product.id == _selectedProductId,
                          orElse: () => filteredProducts.first,
                        );
                        return _buildChip(
                          selectedProduct.name,
                          Colors.green,
                          onTap: () => _showProductSelector(filteredProducts),
                        );
                      },
                    );
                  },
                  loading: () => const SizedBox(
                    width: 20, height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                  error: (err, _) => _buildChip('載入失敗', Colors.red),
                ),
                // Topic chip
                if (_selectedTopicId != null)
                  _buildChip(
                    widget.task.topicName ?? '未分類',
                    Colors.purple,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildChip(String label, Color color, {VoidCallback? onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withValues(alpha: 0.4)),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: color.withValues(alpha: 0.9),
            fontSize: 12,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }

  Widget _buildSubItemsSection() {
    final completedCount = _subItems.where((s) => s.completed).length;
    final total = _subItems.length;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 標題列
          Row(
            children: [
              const Icon(Icons.checklist, size: 18, color: Color(0xFF6C63FF)),
              const SizedBox(width: 6),
              Text(
                '待辦 $completedCount/$total',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.6),
                  fontSize: 14,
                ),
              ),
              const Spacer(),
              if (_subItems.isNotEmpty)
                GestureDetector(
                  onTap: () => setState(() => _isSubItemEditMode = !_isSubItemEditMode),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    child: Text(
                      _isSubItemEditMode ? '完成' : '排序',
                      style: TextStyle(
                        fontSize: 12,
                        color: _isSubItemEditMode ? Colors.orange : Colors.white54,
                      ),
                    ),
                  ),
                ),
              GestureDetector(
                onTap: _handleAddSubItem,
                child: const Padding(
                  padding: EdgeInsets.all(4),
                  child: Icon(Icons.add_circle_outline, color: Color(0xFF6C63FF), size: 20),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          // Sub-items 列表
          if (_isSubItemEditMode)
            ReorderableListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _subItems.length,
              onReorder: _handleReorderSubItems,
              itemBuilder: (context, index) {
                final sub = _subItems[index];
                return Container(
                  key: ValueKey(sub.id),
                  margin: const EdgeInsets.only(bottom: 4),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.drag_handle,
                        size: 20,
                        color: Colors.white.withValues(alpha: 0.5),
                      ),
                      const SizedBox(width: 8),
                      Icon(
                        sub.completed ? Icons.check_circle : Icons.circle_outlined,
                        size: 18,
                        color: sub.completed ? Colors.green : Colors.white.withValues(alpha: 0.4),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          sub.content,
                          style: TextStyle(
                            color: sub.completed
                                ? Colors.white.withValues(alpha: 0.5)
                                : Colors.white,
                            fontSize: 14,
                            decoration: sub.completed ? TextDecoration.lineThrough : null,
                          ),
                        ),
                      ),
                      GestureDetector(
                        onTap: () => _handlePromoteSubItem(sub.id),
                        child: Padding(
                          padding: const EdgeInsets.all(6),
                          child: Icon(Icons.arrow_upward, color: Colors.blue.withValues(alpha: 0.7), size: 16),
                        ),
                      ),
                      GestureDetector(
                        onTap: () => _handleDeleteSubItem(sub.id),
                        child: Padding(
                          padding: const EdgeInsets.all(6),
                          child: Icon(Icons.close, color: Colors.white.withValues(alpha: 0.3), size: 16),
                        ),
                      ),
                    ],
                  ),
                );
              },
            )
          else
            ..._subItems.map((sub) => Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      InkWell(
                        onTap: () => _handleSubItemToggle(sub.id, sub.completed),
                        child: Padding(
                          padding: const EdgeInsets.all(4),
                          child: AnimatedSwitcher(
                            duration: const Duration(milliseconds: 200),
                            child: Icon(
                              sub.completed ? Icons.check_circle : Icons.circle_outlined,
                              key: ValueKey(sub.completed),
                              size: 18,
                              color: sub.completed ? Colors.green : Colors.white.withValues(alpha: 0.4),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: AnimatedDefaultTextStyle(
                          duration: const Duration(milliseconds: 200),
                          style: TextStyle(
                            color: sub.completed
                                ? Colors.white.withValues(alpha: 0.5)
                                : Colors.white,
                            fontSize: 14,
                            decoration: sub.completed ? TextDecoration.lineThrough : null,
                          ),
                          child: Text(sub.content),
                        ),
                      ),
                      GestureDetector(
                        onTap: () => _handlePromoteSubItem(sub.id),
                        child: Padding(
                          padding: const EdgeInsets.all(6),
                          child: Icon(Icons.arrow_upward, color: Colors.blue.withValues(alpha: 0.7), size: 16),
                        ),
                      ),
                      GestureDetector(
                        onTap: () => _handleDeleteSubItem(sub.id),
                        child: Padding(
                          padding: const EdgeInsets.all(6),
                          child: Icon(Icons.close, color: Colors.white.withValues(alpha: 0.3), size: 16),
                        ),
                      ),
                    ],
                  ),
                )),
        ],
      ),
    );
  }

  Future<void> _showAreaSelector(List<Area> areas) async {
    final selected = await showModalBottomSheet<Area>(
      context: context,
      backgroundColor: const Color(0xFF2c2c2e),
      builder: (context) => Container(
        padding: const EdgeInsets.symmetric(vertical: 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              "選擇領域",
              style: TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            ...areas.map((area) => ListTile(
              leading: const Icon(Icons.category, color: Color(0xFF6C63FF)),
              title: Text(area.name, style: const TextStyle(color: Colors.white)),
              selected: area.id == _selectedAreaId,
              selectedTileColor: const Color(0xFF6C63FF).withValues(alpha: 0.2),
              onTap: () => Navigator.pop(context, area),
            )),
          ],
        ),
      ),
    );

    if (selected != null) {
      setState(() {
        _selectedAreaId = selected.id;
        _selectedTopicId = null; // 重置 topic
      });
    }
  }

  Future<void> _showProductSelector(List<Product> products) async {
    final selected = await showModalBottomSheet<Product>(
      context: context,
      backgroundColor: const Color(0xFF2c2c2e),
      builder: (context) => Container(
        padding: const EdgeInsets.symmetric(vertical: 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              "選擇專案",
              style: TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            ...products.map((product) => ListTile(
              leading: const Icon(Icons.work_outline, color: Colors.green),
              title: Text(product.name, style: const TextStyle(color: Colors.white)),
              selected: product.id == _selectedProductId,
              selectedTileColor: Colors.green.withValues(alpha: 0.2),
              onTap: () => Navigator.pop(context, product),
            )),
          ],
        ),
      ),
    );

    if (selected != null) {
      setState(() {
        _selectedProductId = selected.id;
        _selectedTopicId = null; // 重置 topic
      });
    }
  }

  Widget _buildActionButtons() {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton(
              onPressed: _isLoading ? null : () => Navigator.pop(context),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.white,
                side: BorderSide(color: Colors.white.withValues(alpha: 0.3)),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              child: const Text("取消"),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: FilledButton.icon(
              onPressed: _isLoading ? null : _handleSaveChanges,
              icon: _isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                    ),
                  )
                : const Icon(Icons.save_rounded),
              label: Text(_isLoading ? "儲存中..." : "儲存"),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF6C63FF),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                elevation: 4,
                shadowColor: const Color(0xFF6C63FF).withValues(alpha: 0.5),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Sub-item 編輯狀態
class SubItemEditState {
  final String id;
  final String content;
  final bool completed;

  SubItemEditState({
    required this.id,
    required this.content,
    required this.completed,
  });

  SubItemEditState copyWith({
    String? id,
    String? content,
    bool? completed,
  }) {
    return SubItemEditState(
      id: id ?? this.id,
      content: content ?? this.content,
      completed: completed ?? this.completed,
    );
  }
}
