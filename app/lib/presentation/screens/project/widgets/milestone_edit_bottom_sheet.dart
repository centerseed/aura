import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:app/core/theme/app_colors.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../domain/entities/milestone.dart';
import '../../../providers/milestone_provider.dart';

/// 里程碑編輯 Bottom Sheet
///
/// 支援新增和編輯模式
class MilestoneEditBottomSheet extends ConsumerStatefulWidget {
  final String productId;
  final String productName;
  final Milestone? editingMilestone;

  const MilestoneEditBottomSheet({
    super.key,
    required this.productId,
    required this.productName,
    this.editingMilestone,
  });

  @override
  ConsumerState<MilestoneEditBottomSheet> createState() =>
      _MilestoneEditBottomSheetState();
}

class _MilestoneEditBottomSheetState
    extends ConsumerState<MilestoneEditBottomSheet> {
  late TextEditingController _nameController;
  late TextEditingController _descriptionController;

  DateTime? _targetDate;
  MilestoneStatus _status = MilestoneStatus.planned;
  int _priority = 5;

  bool _isLoading = false;
  String? _errorMessage;

  bool get isEditing => widget.editingMilestone != null;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController();
    _descriptionController = TextEditingController();

    // 如果是編輯模式，填充現有資料
    if (widget.editingMilestone != null) {
      final m = widget.editingMilestone!;
      _nameController.text = m.name;
      _descriptionController.text = m.description ?? '';
      _targetDate = m.targetDate;
      _status = m.status;
      _priority = m.priority;
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return BackdropFilter(
      filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
      child: Container(
        decoration: BoxDecoration(
          color: colorScheme.surface.withValues(alpha: 0.95),
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          border: Border.all(
            color: colorScheme.outlineVariant.withValues(alpha: 0.2),
          ),
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Handle
              Center(
                child: Container(
                  margin: const EdgeInsets.only(top: 12, bottom: 16),
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: colorScheme.onSurface.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),

              // 標題
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: colorScheme.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(
                        Icons.flag_rounded,
                        color: colorScheme.primary,
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            isEditing ? '編輯里程碑' : '新增里程碑',
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.bold,
                              color: colorScheme.onSurface,
                            ),
                          ),
                          Text(
                            widget.productName,
                            style: TextStyle(
                              fontSize: 12,
                              color: colorScheme.onSurfaceVariant
                                  .withValues(alpha: 0.7),
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: Icon(
                        Icons.close_rounded,
                        color: colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // 錯誤訊息
              if (_errorMessage != null)
                Container(
                  margin: const EdgeInsets.symmetric(horizontal: 20),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: colorScheme.error.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
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
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _errorMessage!,
                          style: TextStyle(
                            fontSize: 13,
                            color: colorScheme.error,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

              if (_errorMessage != null) const SizedBox(height: 12),

              // 表單內容
              Flexible(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // 名稱
                      _buildLabel('里程碑名稱', isRequired: true),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _nameController,
                        decoration: InputDecoration(
                          hintText: '例如：MVP Release、Beta 測試完成',
                          hintStyle: TextStyle(
                            color: colorScheme.onSurfaceVariant
                                .withValues(alpha: 0.4),
                          ),
                          filled: true,
                          fillColor: colorScheme.surfaceContainerHighest
                              .withValues(alpha: 0.5),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: BorderSide.none,
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: BorderSide(
                              color: colorScheme.primary,
                              width: 1.5,
                            ),
                          ),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 12,
                          ),
                        ),
                        style: TextStyle(color: colorScheme.onSurface),
                        textInputAction: TextInputAction.next,
                      ),

                      const SizedBox(height: 20),

                      // 目標日期
                      _buildLabel('目標日期', isRequired: true),
                      const SizedBox(height: 8),
                      InkWell(
                        onTap: _selectDate,
                        borderRadius: BorderRadius.circular(10),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 12,
                          ),
                          decoration: BoxDecoration(
                            color: colorScheme.surfaceContainerHighest
                                .withValues(alpha: 0.5),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                Icons.calendar_today_rounded,
                                size: 18,
                                color: _targetDate != null
                                    ? colorScheme.primary
                                    : colorScheme.onSurfaceVariant
                                        .withValues(alpha: 0.4),
                              ),
                              const SizedBox(width: 10),
                              Text(
                                _targetDate != null
                                    ? DateFormat('yyyy年M月d日')
                                        .format(_targetDate!)
                                    : '選擇日期',
                                style: TextStyle(
                                  color: _targetDate != null
                                      ? colorScheme.onSurface
                                      : colorScheme.onSurfaceVariant
                                          .withValues(alpha: 0.4),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),

                      const SizedBox(height: 20),

                      // 狀態（僅編輯模式顯示）
                      if (isEditing) ...[
                        _buildLabel('狀態'),
                        const SizedBox(height: 8),
                        _buildStatusSelector(colorScheme),
                        const SizedBox(height: 20),
                      ],

                      // 優先級
                      _buildLabel('優先級'),
                      const SizedBox(height: 8),
                      _buildPrioritySlider(colorScheme),

                      const SizedBox(height: 20),

                      // 描述
                      _buildLabel('描述（選填）'),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _descriptionController,
                        maxLines: 3,
                        decoration: InputDecoration(
                          hintText: '說明這個里程碑的具體目標或注意事項...',
                          hintStyle: TextStyle(
                            color: colorScheme.onSurfaceVariant
                                .withValues(alpha: 0.4),
                          ),
                          filled: true,
                          fillColor: colorScheme.surfaceContainerHighest
                              .withValues(alpha: 0.5),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: BorderSide.none,
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: BorderSide(
                              color: colorScheme.primary,
                              width: 1.5,
                            ),
                          ),
                          contentPadding: const EdgeInsets.all(14),
                        ),
                        style: TextStyle(color: colorScheme.onSurface),
                      ),

                      const SizedBox(height: 24),
                    ],
                  ),
                ),
              ),

              // 底部按鈕
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: colorScheme.surface,
                  border: Border(
                    top: BorderSide(
                      color: colorScheme.outlineVariant.withValues(alpha: 0.2),
                    ),
                  ),
                ),
                child: Row(
                  children: [
                    // 刪除按鈕（僅編輯模式）
                    if (isEditing)
                      TextButton.icon(
                        onPressed: _isLoading ? null : _handleDelete,
                        icon: Icon(
                          Icons.delete_outline,
                          size: 18,
                          color: colorScheme.error,
                        ),
                        label: Text(
                          '刪除',
                          style: TextStyle(color: colorScheme.error),
                        ),
                      ),

                    const Spacer(),

                    // 取消按鈕
                    TextButton(
                      onPressed:
                          _isLoading ? null : () => Navigator.pop(context),
                      child: Text(
                        '取消',
                        style: TextStyle(
                          color: colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ),

                    const SizedBox(width: 12),

                    // 儲存按鈕
                    FilledButton(
                      onPressed: _isLoading ? null : _handleSubmit,
                      style: FilledButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 24,
                          vertical: 12,
                        ),
                      ),
                      child: _isLoading
                          ? SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: colorScheme.onPrimary,
                              ),
                            )
                          : Text(isEditing ? '更新' : '建立'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLabel(String text, {bool isRequired = false}) {
    final colorScheme = Theme.of(context).colorScheme;
    return Row(
      children: [
        Text(
          text,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: colorScheme.onSurfaceVariant,
          ),
        ),
        if (isRequired)
          Text(
            ' *',
            style: TextStyle(
              fontSize: 13,
              color: colorScheme.error,
            ),
          ),
      ],
    );
  }

  Widget _buildStatusSelector(ColorScheme colorScheme) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: MilestoneStatus.values.map((status) {
        final isSelected = _status == status;
        return ChoiceChip(
          label: Text(status.displayName),
          selected: isSelected,
          onSelected: (selected) {
            if (selected) {
              setState(() => _status = status);
              HapticFeedback.selectionClick();
            }
          },
          selectedColor: colorScheme.primaryContainer,
          labelStyle: TextStyle(
            color: isSelected
                ? colorScheme.onPrimaryContainer
                : colorScheme.onSurfaceVariant,
            fontSize: 12,
          ),
        );
      }).toList(),
    );
  }

  Widget _buildPrioritySlider(ColorScheme colorScheme) {
    return Column(
      children: [
        Row(
          children: [
            Text(
              '$_priority',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: _priority >= 8
                    ? AppColors.statusInbox
                    : _priority >= 5
                        ? colorScheme.primary
                        : colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              _priority >= 8
                  ? '高優先級'
                  : _priority >= 5
                      ? '一般'
                      : '低優先級',
              style: TextStyle(
                fontSize: 12,
                color: colorScheme.onSurfaceVariant.withValues(alpha: 0.6),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        SliderTheme(
          data: SliderTheme.of(context).copyWith(
            activeTrackColor: _priority >= 8
                ? AppColors.statusInbox
                : _priority >= 5
                    ? colorScheme.primary
                    : colorScheme.onSurfaceVariant.withValues(alpha: 0.3),
            inactiveTrackColor:
                colorScheme.onSurfaceVariant.withValues(alpha: 0.1),
            thumbColor: _priority >= 8
                ? AppColors.statusInbox
                : _priority >= 5
                    ? colorScheme.primary
                    : colorScheme.onSurfaceVariant,
            overlayColor: colorScheme.primary.withValues(alpha: 0.1),
          ),
          child: Slider(
            value: _priority.toDouble(),
            min: 1,
            max: 10,
            divisions: 9,
            onChanged: (value) {
              setState(() => _priority = value.round());
              HapticFeedback.selectionClick();
            },
          ),
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              '低',
              style: TextStyle(
                fontSize: 10,
                color: colorScheme.onSurfaceVariant.withValues(alpha: 0.4),
              ),
            ),
            Text(
              '中',
              style: TextStyle(
                fontSize: 10,
                color: colorScheme.onSurfaceVariant.withValues(alpha: 0.4),
              ),
            ),
            Text(
              '高',
              style: TextStyle(
                fontSize: 10,
                color: colorScheme.onSurfaceVariant.withValues(alpha: 0.4),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Future<void> _selectDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _targetDate ?? now.add(const Duration(days: 30)),
      firstDate: now.subtract(const Duration(days: 365)),
      lastDate: now.add(const Duration(days: 365 * 3)),
      locale: const Locale('zh', 'TW'),
    );
    if (picked != null) {
      setState(() => _targetDate = picked);
      HapticFeedback.selectionClick();
    }
  }

  Future<void> _handleSubmit() async {
    // 驗證
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      setState(() => _errorMessage = '請輸入里程碑名稱');
      return;
    }
    if (_targetDate == null) {
      setState(() => _errorMessage = '請選擇目標日期');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final controller = ref.read(milestoneControllerProvider.notifier);
    final description = _descriptionController.text.trim();

    try {
      if (isEditing) {
        // 更新
        final result = await controller.updateMilestone(
          id: widget.editingMilestone!.id,
          entityId: widget.productId,
          name: name,
          targetDate: _targetDate,
          status: _status,
          priority: _priority,
          description: description.isEmpty ? null : description,
        );

        if (result != null && mounted) {
          Navigator.pop(context);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('里程碑已更新')),
          );
        }
      } else {
        // 新增
        final result = await controller.createMilestone(
          name: name,
          targetDate: _targetDate!,
          entityType: MilestoneEntityType.product,
          entityId: widget.productId,
          priority: _priority,
          description: description.isEmpty ? null : description,
        );

        if (result != null && mounted) {
          Navigator.pop(context);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('里程碑已建立')),
          );
        }
      }
    } finally {
      if (mounted) {
        // 檢查是否有錯誤
        final state = ref.read(milestoneControllerProvider);
        if (state.error != null) {
          setState(() {
            _isLoading = false;
            _errorMessage = state.error!.message;
          });
          ref.read(milestoneControllerProvider.notifier).clearError();
        } else {
          setState(() => _isLoading = false);
        }
      }
    }
  }

  Future<void> _handleDelete() async {
    if (!isEditing) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('刪除里程碑'),
        content: Text('確定要刪除「${widget.editingMilestone!.name}」嗎？'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(
              foregroundColor: Theme.of(context).colorScheme.error,
            ),
            child: const Text('刪除'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final controller = ref.read(milestoneControllerProvider.notifier);
    final success = await controller.deleteMilestone(
      id: widget.editingMilestone!.id,
      entityId: widget.productId,
    );

    if (mounted) {
      if (success) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('里程碑已刪除')),
        );
      } else {
        final state = ref.read(milestoneControllerProvider);
        setState(() {
          _isLoading = false;
          _errorMessage = state.error?.message ?? '刪除失敗';
        });
        ref.read(milestoneControllerProvider.notifier).clearError();
      }
    }
  }
}
