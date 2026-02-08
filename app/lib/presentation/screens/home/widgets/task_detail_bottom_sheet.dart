import 'dart:ui' as dart_ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../../core/di/providers.dart';
import '../../../../domain/entities/task.dart';
import '../../../../domain/entities/area.dart';
import '../../../../domain/entities/product.dart';
import '../../../../application/use_cases/delete_task_use_case.dart';
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

/// Task 細節畫面 (BottomSheet) - 直接可編輯的緊湊介面
class TaskDetailBottomSheet extends ConsumerStatefulWidget {
  final Task task;

  const TaskDetailBottomSheet({super.key, required this.task});

  @override
  ConsumerState<TaskDetailBottomSheet> createState() =>
      _TaskDetailBottomSheetState();
}

class _TaskDetailBottomSheetState extends ConsumerState<TaskDetailBottomSheet> {
  bool _isLoading = false;
  String? _errorMessage;

  // 可編輯的任務狀態
  late TextEditingController _contentController;
  late DateTime? _selectedStartDate;
  late DateTime? _selectedDueDate;
  late DateTime? _selectedRemindAt;
  late bool _reminderEnabled;
  late String? _selectedProductId;
  late String? _selectedTopicId;
  String? _selectedAreaId;

  // 狀態選擇
  late TaskStatus _selectedStatus;

  // Sub-items 本地狀態
  late List<_SubItemState> _subItems;
  bool _isSubItemEditMode = false;


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
    _selectedStatus = widget.task.status;

    _subItems = (widget.task.subItems ?? [])
        .map((sub) => _SubItemState(
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


  // ========== 儲存邏輯 ==========

  Future<void> _handleSave() async {
    final content = _contentController.text.trim();
    if (content.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('任務內容不能為空')),
      );
      return;
    }

    setState(() => _isLoading = true);

    final useCase = ref.read(updateTaskDetailsUseCaseProvider);
    final result = await useCase(UpdateTaskDetailsParams(
      taskId: widget.task.id,
      content: content,
      status: _selectedStatus,
      startDate: _selectedStartDate,
      dueDate: _selectedDueDate,
      productId: _selectedProductId,
      topicId: _selectedTopicId,
    ));

    await result.fold(
      (failure) async {
        setState(() => _isLoading = false);
        if (mounted) {
          setState(() => _errorMessage = '儲存失敗: ${failure.message}');
          Future.delayed(const Duration(seconds: 3), () {
            if (mounted) setState(() => _errorMessage = null);
          });
        }
      },
      (updatedTask) async {
        // 處理提醒
        await _handleReminderUpdate(content);
        setState(() => _isLoading = false);
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

  Future<void> _handleReminderUpdate(String taskContent) async {
    final wasReminderEnabled = widget.task.reminderEnabled;
    final oldRemindAt = widget.task.remindAt;

    if (!wasReminderEnabled && _reminderEnabled && _selectedRemindAt != null) {
      final scheduleUseCase = ref.read(scheduleTaskReminderUseCaseProvider);
      await scheduleUseCase(ScheduleReminderParams(
        taskId: widget.task.id,
        taskContent: taskContent,
        remindAt: _selectedRemindAt!,
        productName: widget.task.productName,
      ));
    } else if (wasReminderEnabled && !_reminderEnabled) {
      final cancelUseCase = ref.read(cancelTaskReminderUseCaseProvider);
      await cancelUseCase(widget.task.id);
    } else if (_reminderEnabled &&
        _selectedRemindAt != null &&
        oldRemindAt != _selectedRemindAt) {
      final cancelUseCase = ref.read(cancelTaskReminderUseCaseProvider);
      await cancelUseCase(widget.task.id);
      final scheduleUseCase = ref.read(scheduleTaskReminderUseCaseProvider);
      await scheduleUseCase(ScheduleReminderParams(
        taskId: widget.task.id,
        taskContent: taskContent,
        remindAt: _selectedRemindAt!,
        productName: widget.task.productName,
      ));
    }
  }

  // ========== 日期選擇 ==========

  Future<void> _pickDate({
    required DateTime? current,
    required ValueChanged<DateTime?> onSelected,
  }) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: current ?? DateTime.now(),
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
      onSelected(picked);

    }
  }

  // ========== 提醒 ==========

  Future<void> _showReminderTimePicker() async {
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
          pickedDate.year, pickedDate.month, pickedDate.day,
          pickedTime.hour, pickedTime.minute,
        );
        if (remindAt.isBefore(DateTime.now())) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('提醒時間不能設定在過去')),
          );
          return;
        }
        setState(() {
          _selectedRemindAt = remindAt;
          _reminderEnabled = true;
        });
  
      }
    }
  }

  // ========== Sub-items ==========

  Future<void> _handleSubItemToggle(String subItemId, bool completed) async {
    HapticFeedback.lightImpact();
    final newCompleted = !completed;
    setState(() {
      final index = _subItems.indexWhere((s) => s.id == subItemId);
      if (index != -1) {
        _subItems[index] = _subItems[index].copyWith(completed: newCompleted);
      }
    });

    final useCase = ref.read(updateSubItemUseCaseProvider);
    final result = await useCase(UpdateSubItemParams(
      taskId: widget.task.id,
      subItemId: subItemId,
      completed: newCompleted,
    ));

    result.fold(
      (failure) {
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
      (_) => silentRefreshTasks(ref),
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
          decoration: const InputDecoration(hintText: '輸入項目內容'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('取消')),
          TextButton(
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: const Text('新增'),
          ),
        ],
      ),
    );

    if (result != null && result.isNotEmpty) {
      final tempId = DateTime.now().millisecondsSinceEpoch.toString();
      setState(() {
        _subItems.add(_SubItemState(id: tempId, content: result, completed: false));
      });

      final useCase = ref.read(addSubItemUseCaseProvider);
      final apiResult = await useCase(AddSubItemParams(
        taskId: widget.task.id,
        content: result,
      ));

      apiResult.fold(
        (failure) {
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
        (_) => silentRefreshTasks(ref),
      );
    }
  }

  Future<void> _handleDeleteSubItem(String subItemId) async {
    final index = _subItems.indexWhere((s) => s.id == subItemId);
    if (index == -1) return;
    final removedItem = _subItems[index];
    setState(() => _subItems.removeAt(index));

    final useCase = ref.read(deleteSubItemUseCaseProvider);
    final result = await useCase(DeleteSubItemParams(
      taskId: widget.task.id,
      subItemId: subItemId,
    ));

    result.fold(
      (failure) {
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
      (_) => silentRefreshTasks(ref),
    );
  }

  Future<void> _handlePromoteSubItem(String subItemId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF2c2c2e),
        title: const Text('升級為獨立任務', style: TextStyle(color: Colors.white)),
        content: const Text('確定要將此待辦項目升級為獨立任務嗎？', style: TextStyle(color: Colors.white70)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('取消')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('確定', style: TextStyle(color: Color(0xFF6C63FF))),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    final index = _subItems.indexWhere((s) => s.id == subItemId);
    if (index == -1) return;
    final removedItem = _subItems[index];
    setState(() => _subItems.removeAt(index));

    final useCase = ref.read(promoteSubItemUseCaseProvider);
    final result = await useCase(PromoteSubItemParams(
      taskId: widget.task.id,
      subItemId: subItemId,
    ));

    result.fold(
      (failure) {
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

  Future<void> _handleReorderSubItems(int oldIndex, int newIndex) async {
    if (newIndex > oldIndex) newIndex -= 1;
    final originalOrder = List<_SubItemState>.from(_subItems);
    setState(() {
      final item = _subItems.removeAt(oldIndex);
      _subItems.insert(newIndex, item);
    });
    HapticFeedback.mediumImpact();

    final subItemIds = _subItems.map((s) => s.id).toList();
    final useCase = ref.read(reorderSubItemsUseCaseProvider);
    final result = await useCase(ReorderSubItemsParams(
      taskId: widget.task.id,
      subItemIds: subItemIds,
    ));

    result.fold(
      (failure) {
        if (mounted) {
          setState(() {
            _subItems..clear()..addAll(originalOrder);
            _errorMessage = '排序失敗: ${failure.message}';
          });
          Future.delayed(const Duration(seconds: 3), () {
            if (mounted) setState(() => _errorMessage = null);
          });
        }
      },
      (_) => silentRefreshTasks(ref),
    );
  }

  // ========== 任務操作 ==========

  void _handleStartFocus() {
    Navigator.pop(context);
    context.push('/focus/${widget.task.id}', extra: widget.task);
  }

  Future<void> _handleComplete() async {
    setState(() => _isLoading = true);
    final useCase = ref.read(updateTaskDetailsUseCaseProvider);
    final result = await useCase(UpdateTaskDetailsParams(
      taskId: widget.task.id,
      status: TaskStatus.archive,
    ));

    result.fold(
      (failure) {
        if (mounted) {
          setState(() {
            _isLoading = false;
            _errorMessage = '完成失敗: ${failure.message}';
          });
          Future.delayed(const Duration(seconds: 3), () {
            if (mounted) setState(() => _errorMessage = null);
          });
        }
      },
      (_) async {
        await silentRefreshTasks(ref);
        ref.invalidate(completedTodayTasksProvider);
        HapticFeedback.mediumImpact();
        if (mounted) Navigator.pop(context);
      },
    );
  }

  Future<void> _handleDelete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF2c2c2e),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('刪除任務', style: TextStyle(color: Colors.white)),
        content: Text(
          '確定要刪除「${widget.task.content}」嗎？\n此操作無法復原。',
          style: const TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('取消', style: TextStyle(color: Colors.white54)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('刪除'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _isLoading = true);
    final useCase = ref.read(deleteTaskUseCaseProvider);
    final result = await useCase(DeleteTaskParams(taskId: widget.task.id));

    result.fold(
      (failure) {
        if (mounted) {
          setState(() {
            _isLoading = false;
            _errorMessage = '刪除失敗: ${failure.message}';
          });
          Future.delayed(const Duration(seconds: 3), () {
            if (mounted) setState(() => _errorMessage = null);
          });
        }
      },
      (_) async {
        await silentRefreshTasks(ref);
        ref.invalidate(completedTodayTasksProvider);
        HapticFeedback.mediumImpact();
        if (mounted) {
          Navigator.pop(context);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('任務已刪除')),
          );
        }
      },
    );
  }

  // ========== 分類選擇器 ==========

  Future<void> _showAreaSelector(List<Area> areas) async {
    final selected = await showModalBottomSheet<Area>(
      context: context,
      backgroundColor: const Color(0xFF2c2c2e),
      builder: (context) => Container(
        padding: const EdgeInsets.symmetric(vertical: 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text("選擇領域", style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
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
        _selectedTopicId = null;
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
            const Text("選擇專案", style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
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
        _selectedTopicId = null;
      });

    }
  }

  // ========== Build ==========

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
              if (_errorMessage != null) _buildErrorBanner(),
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
                        _buildStatusRow(),
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
                        _buildDivider(),
                        _buildFocusModeRow(),
                        _buildDivider(),
                        _buildCompleteRow(),
                        _buildDivider(),
                        _buildDeleteRow(),
                        const SizedBox(height: 20),
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

  Widget _buildErrorBanner() {
    return Container(
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
          GestureDetector(
            onTap: () => setState(() => _errorMessage = null),
            child: const Icon(Icons.close, color: Colors.red, size: 18),
          ),
        ],
      ),
    );
  }

  /// 標題：大字直接編輯 + 關閉按鈕
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
              child: Icon(Icons.close, color: Colors.white.withValues(alpha: 0.6), size: 20),
            ),
          ),
        ],
      ),
    );
  }

  /// 狀態選擇行
  Widget _buildStatusRow() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.swap_horiz, size: 18, color: Colors.white.withValues(alpha: 0.6)),
              const SizedBox(width: 6),
              Text('狀態', style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 14)),
            ],
          ),
          const SizedBox(height: 8),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: TaskStatus.values.map((status) {
                final isSelected = _selectedStatus == status;
                return Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: GestureDetector(
                    onTap: _isLoading ? null : () {
                      HapticFeedback.lightImpact();
                      setState(() => _selectedStatus = status);
                    },
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? status.color.withValues(alpha: 0.2)
                            : Colors.white.withValues(alpha: 0.05),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: isSelected
                              ? status.color.withValues(alpha: 0.6)
                              : Colors.white.withValues(alpha: 0.1),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            status.icon,
                            size: 14,
                            color: isSelected ? status.color : Colors.white.withValues(alpha: 0.4),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            status.displayName,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                              color: isSelected ? status.color : Colors.white.withValues(alpha: 0.5),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  /// 日期並排一行
  Widget _buildDatesRow() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Row(
        children: [
          Expanded(
            child: _buildDateCell(
              icon: Icons.play_circle_outline,
              iconColor: Colors.blue,
              label: '開始',
              date: _selectedStartDate,
              dateColor: Colors.blue,
              onTap: () => _pickDate(
                current: _selectedStartDate,
                onSelected: (date) => setState(() => _selectedStartDate = date),
              ),
              onLongPress: _selectedStartDate != null
                  ? () { setState(() => _selectedStartDate = null); }
                  : null,
            ),
          ),
          Container(
            height: 24, width: 0.5,
            color: Colors.white.withValues(alpha: 0.15),
            margin: const EdgeInsets.symmetric(horizontal: 12),
          ),
          Expanded(
            child: _buildDateCell(
              icon: Icons.flag_outlined,
              iconColor: Colors.orange,
              label: '截止',
              date: _selectedDueDate,
              dateColor: _selectedDueDate != null && _selectedDueDate!.isBefore(DateTime.now())
                  ? Colors.red
                  : Colors.orange,
              onTap: () => _pickDate(
                current: _selectedDueDate,
                onSelected: (date) => setState(() => _selectedDueDate = date),
              ),
              onLongPress: _selectedDueDate != null
                  ? () { setState(() => _selectedDueDate = null); }
                  : null,
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
    VoidCallback? onLongPress,
  }) {
    return InkWell(
      onTap: onTap,
      onLongPress: onLongPress,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            Icon(icon, size: 18, color: iconColor),
            const SizedBox(width: 6),
            Text(label, style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 14)),
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

  /// 提醒行
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
          Text('提醒', style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 14)),
          const Spacer(),
          if (_reminderEnabled && _selectedRemindAt != null)
            GestureDetector(
              onTap: _showReminderTimePicker,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Text(
                  DateFormat('MM/dd HH:mm').format(_selectedRemindAt!),
                  style: const TextStyle(color: Color(0xFFFFB020), fontSize: 13, fontWeight: FontWeight.w600),
                ),
              ),
            )
          else if (_reminderEnabled)
            GestureDetector(
              onTap: _showReminderTimePicker,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Text('設定時間', style: TextStyle(color: Colors.white.withValues(alpha: 0.3), fontSize: 13)),
              ),
            ),
          SizedBox(
            height: 32,
            child: FittedBox(
              child: Switch(
                value: _reminderEnabled,
                onChanged: _isLoading ? null : (value) {
                  setState(() {
                    _reminderEnabled = value;
                    if (value && _selectedRemindAt == null) {
                      _showReminderTimePicker();
                    }
                    if (!value) _selectedRemindAt = null;
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

  /// 分類 chips
  Widget _buildCategoryChips() {
    final areasAsync = ref.watch(areasProvider);
    final productsAsync = ref.watch(productsProvider);

    // 初始化 _selectedAreaId
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
                  setState(() => _selectedAreaId = currentProduct.areaId);
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
            child: Text('分類', style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 14)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Wrap(
              spacing: 8,
              runSpacing: 6,
              children: [
                // Area chip
                areasAsync.when(
                  data: (eitherAreas) => eitherAreas.fold(
                    (_) => _buildChip('載入失敗', Colors.red),
                    (areas) {
                      if (areas.isEmpty) return _buildChip('無領域', Colors.grey);
                      if (_selectedAreaId == null) {
                        return const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2));
                      }
                      final selectedArea = areas.firstWhere(
                        (a) => a.id == _selectedAreaId,
                        orElse: () => areas.first,
                      );
                      return _buildChip(selectedArea.name, const Color(0xFF6C63FF),
                        onTap: () => _showAreaSelector(areas));
                    },
                  ),
                  loading: () => const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
                  error: (_, __) => _buildChip('載入失敗', Colors.red),
                ),
                // Product chip
                productsAsync.when(
                  data: (eitherProducts) => eitherProducts.fold(
                    (_) => _buildChip('載入失敗', Colors.red),
                    (products) {
                      if (_selectedAreaId == null) {
                        return const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2));
                      }
                      final filtered = products.where((p) => p.areaId == _selectedAreaId).toList();
                      if (filtered.isEmpty) return _buildChip('無專案', Colors.grey);
                      final inArea = filtered.any((p) => p.id == _selectedProductId);
                      if (!inArea) {
                        WidgetsBinding.instance.addPostFrameCallback((_) {
                          if (mounted) {
                            setState(() {
                              _selectedProductId = filtered.first.id;
                              _selectedTopicId = null;
                            });
                          }
                        });
                      }
                      final selected = filtered.firstWhere(
                        (p) => p.id == _selectedProductId,
                        orElse: () => filtered.first,
                      );
                      return _buildChip(selected.name, Colors.green,
                        onTap: () => _showProductSelector(filtered));
                    },
                  ),
                  loading: () => const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
                  error: (_, __) => _buildChip('載入失敗', Colors.red),
                ),
                // Topic chip
                if (_selectedTopicId != null)
                  _buildChip(widget.task.topicName ?? '未分類', Colors.purple),
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
          style: TextStyle(color: color.withValues(alpha: 0.9), fontSize: 12, fontWeight: FontWeight.w500),
        ),
      ),
    );
  }

  /// Sub-items
  Widget _buildSubItemsSection() {
    final completedCount = _subItems.where((s) => s.completed).length;
    final total = _subItems.length;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.checklist, size: 18, color: Color(0xFF6C63FF)),
              const SizedBox(width: 6),
              Text('待辦 $completedCount/$total',
                style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 14)),
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
                    children: [
                      Icon(Icons.drag_handle, size: 20, color: Colors.white.withValues(alpha: 0.5)),
                      const SizedBox(width: 8),
                      Icon(
                        sub.completed ? Icons.check_circle : Icons.circle_outlined,
                        size: 18,
                        color: sub.completed ? Colors.green : Colors.white.withValues(alpha: 0.4),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(sub.content, style: TextStyle(
                          color: sub.completed ? Colors.white.withValues(alpha: 0.5) : Colors.white,
                          fontSize: 14,
                          decoration: sub.completed ? TextDecoration.lineThrough : null,
                        )),
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
                        color: sub.completed ? Colors.white.withValues(alpha: 0.5) : Colors.white,
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

  /// 專注模式行
  Widget _buildFocusModeRow() {
    return InkWell(
      onTap: _isLoading ? null : _handleStartFocus,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        child: Row(
          children: [
            const Icon(Icons.center_focus_strong_rounded, size: 18, color: Color(0xFF6C63FF)),
            const SizedBox(width: 8),
            const Text(
              '專注模式',
              style: TextStyle(color: Colors.white, fontSize: 15),
            ),
            const Spacer(),
            Icon(Icons.chevron_right, size: 20, color: Colors.white.withValues(alpha: 0.3)),
          ],
        ),
      ),
    );
  }

  /// 標記已完成行
  Widget _buildCompleteRow() {
    return InkWell(
      onTap: _isLoading ? null : _handleComplete,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        child: Row(
          children: [
            const Icon(Icons.check_circle_outline, size: 18, color: Color(0xFF4ADE80)),
            const SizedBox(width: 8),
            const Text(
              '標記為已完成',
              style: TextStyle(color: Color(0xFF4ADE80), fontSize: 15),
            ),
            const Spacer(),
            Icon(Icons.chevron_right, size: 20, color: Colors.white.withValues(alpha: 0.3)),
          ],
        ),
      ),
    );
  }

  /// 刪除任務行
  Widget _buildDeleteRow() {
    return InkWell(
      onTap: _isLoading ? null : _handleDelete,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        child: Row(
          children: [
            Icon(Icons.delete_outline, size: 18, color: Colors.red.withValues(alpha: 0.6)),
            const SizedBox(width: 8),
            Text(
              '刪除任務',
              style: TextStyle(color: Colors.red.withValues(alpha: 0.6), fontSize: 15),
            ),
          ],
        ),
      ),
    );
  }

  /// 底部操作按鈕 — 只保留儲存
  Widget _buildActionButtons() {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 8, 20, 20 + MediaQuery.of(context).padding.bottom),
      child: SizedBox(
        width: double.infinity,
        child: FilledButton.icon(
          onPressed: _isLoading ? null : _handleSave,
          icon: _isLoading
            ? const SizedBox(width: 18, height: 18,
                child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation<Color>(Colors.white)))
            : const Icon(Icons.save_rounded, size: 18),
          label: Text(_isLoading ? "儲存中..." : "儲存"),
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFF6C63FF),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 16),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
        ),
      ),
    );
  }
}

/// Sub-item 編輯狀態
class _SubItemState {
  final String id;
  final String content;
  final bool completed;

  _SubItemState({required this.id, required this.content, required this.completed});

  _SubItemState copyWith({String? id, String? content, bool? completed}) {
    return _SubItemState(
      id: id ?? this.id,
      content: content ?? this.content,
      completed: completed ?? this.completed,
    );
  }
}
