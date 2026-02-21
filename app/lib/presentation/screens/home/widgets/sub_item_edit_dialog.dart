import 'package:flutter/material.dart';
import 'package:app/core/theme/app_colors.dart';
import '../../../../domain/entities/task.dart';

/// SubItem 編輯對話框
class SubItemEditDialog extends StatefulWidget {
  final SubItem subItem;
  final DateTime? taskDueDate;
  final Function(String content, DateTime? startDate, DateTime? dueDate) onSave;
  final VoidCallback onDelete;
  final Function(bool completed) onToggleCompleted;

  const SubItemEditDialog({
    super.key,
    required this.subItem,
    required this.taskDueDate,
    required this.onSave,
    required this.onDelete,
    required this.onToggleCompleted,
  });

  @override
  State<SubItemEditDialog> createState() => _SubItemEditDialogState();
}

class _SubItemEditDialogState extends State<SubItemEditDialog> {
  late TextEditingController _contentController;
  DateTime? _selectedStartDate;
  DateTime? _selectedDueDate;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _contentController = TextEditingController(text: widget.subItem.content);
    _selectedStartDate = widget.subItem.startDate;
    _selectedDueDate = widget.subItem.dueDate;
  }

  @override
  void dispose() {
    _contentController.dispose();
    super.dispose();
  }

  void _handleSave() {
    final content = _contentController.text.trim();
    if (content.isEmpty) {
      setState(() {
        _errorMessage = '內容不能為空';
      });
      return;
    }

    // 驗證：subtask dueDate 不能晚於 task dueDate
    if (_selectedDueDate != null && widget.taskDueDate != null) {
      final subDue = DateTime(
        _selectedDueDate!.year,
        _selectedDueDate!.month,
        _selectedDueDate!.day,
      );
      final taskDue = DateTime(
        widget.taskDueDate!.year,
        widget.taskDueDate!.month,
        widget.taskDueDate!.day,
      );
      if (subDue.isAfter(taskDue)) {
        setState(() {
          _errorMessage = '待辦項目的截止日期不能晚於任務的截止日期';
        });
        return;
      }
    }

    widget.onSave(content, _selectedStartDate, _selectedDueDate);
    Navigator.pop(context);
  }

  Future<void> _pickStartDate() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _selectedStartDate ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (date != null) {
      setState(() {
        _selectedStartDate = date;
        _errorMessage = null;
      });
    }
  }

  Future<void> _pickDueDate() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _selectedDueDate ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (date != null) {
      setState(() {
        _selectedDueDate = date;
        _errorMessage = null;
      });
    }
  }

  void _clearStartDate() {
    setState(() {
      _selectedStartDate = null;
      _errorMessage = null;
    });
  }

  void _clearDueDate() {
    setState(() {
      _selectedDueDate = null;
      _errorMessage = null;
    });
  }

  String _formatDate(DateTime date) {
    return '${date.year}/${date.month}/${date.day}';
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: const Color(0xFF1E1E1E),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 500),
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 標題與完成狀態切換
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  '編輯待辦項目',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                GestureDetector(
                  onTap: () {
                    widget.onToggleCompleted(!widget.subItem.completed);
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: widget.subItem.completed
                          ? AppColors.success.withOpacity(0.2)
                          : Colors.grey.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          widget.subItem.completed
                              ? Icons.check_circle
                              : Icons.circle_outlined,
                          size: 16,
                          color: widget.subItem.completed
                              ? AppColors.success
                              : Colors.grey,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          widget.subItem.completed ? '已完成' : '未完成',
                          style: TextStyle(
                            color: widget.subItem.completed
                                ? AppColors.success
                                : Colors.grey,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // 內容編輯
            TextField(
              controller: _contentController,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                labelText: '內容',
                labelStyle: TextStyle(color: Colors.white.withOpacity(0.7)),
                enabledBorder: OutlineInputBorder(
                  borderSide: BorderSide(color: Colors.white.withOpacity(0.3)),
                  borderRadius: BorderRadius.circular(8),
                ),
                focusedBorder: OutlineInputBorder(
                  borderSide: const BorderSide(color: Colors.blue),
                  borderRadius: BorderRadius.circular(8),
                ),
                errorBorder: OutlineInputBorder(
                  borderSide: const BorderSide(color: Colors.red),
                  borderRadius: BorderRadius.circular(8),
                ),
                focusedErrorBorder: OutlineInputBorder(
                  borderSide: const BorderSide(color: Colors.red),
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              maxLines: 3,
              onChanged: (_) {
                if (_errorMessage != null) {
                  setState(() {
                    _errorMessage = null;
                  });
                }
              },
            ),
            const SizedBox(height: 16),

            // 開始日期
            _buildDateField(
              label: '開始日期',
              date: _selectedStartDate,
              onTap: _pickStartDate,
              onClear: _clearStartDate,
            ),
            const SizedBox(height: 12),

            // 截止日期
            _buildDateField(
              label: '截止日期',
              date: _selectedDueDate,
              onTap: _pickDueDate,
              onClear: _clearDueDate,
            ),
            const SizedBox(height: 4),

            // 提示訊息
            if (widget.taskDueDate != null)
              Padding(
                padding: const EdgeInsets.only(left: 12),
                child: Text(
                  '任務截止日：${_formatDate(widget.taskDueDate!)}',
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.5),
                    fontSize: 12,
                  ),
                ),
              ),

            // 錯誤訊息
            if (_errorMessage != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(
                  _errorMessage!,
                  style: const TextStyle(
                    color: Colors.red,
                    fontSize: 14,
                  ),
                ),
              ),

            const SizedBox(height: 24),

            // 按鈕列
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // 刪除按鈕
                TextButton.icon(
                  onPressed: () {
                    Navigator.pop(context);
                    widget.onDelete();
                  },
                  icon: const Icon(Icons.delete_outline, color: Colors.red),
                  label: const Text(
                    '刪除',
                    style: TextStyle(color: Colors.red),
                  ),
                ),

                // 取消與儲存
                Row(
                  children: [
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: Text(
                        '取消',
                        style: TextStyle(color: Colors.white.withOpacity(0.7)),
                      ),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton(
                      onPressed: _handleSave,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.blue,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 24,
                          vertical: 12,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      child: const Text('儲存'),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDateField({
    required String label,
    required DateTime? date,
    required VoidCallback onTap,
    required VoidCallback onClear,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        decoration: BoxDecoration(
          border: Border.all(color: Colors.white.withOpacity(0.3)),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Icon(
                  Icons.calendar_today,
                  size: 16,
                  color: Colors.white.withOpacity(0.7),
                ),
                const SizedBox(width: 8),
                Text(
                  date == null ? label : _formatDate(date),
                  style: TextStyle(
                    color: date == null
                        ? Colors.white.withOpacity(0.5)
                        : Colors.white,
                    fontSize: 14,
                  ),
                ),
              ],
            ),
            if (date != null)
              GestureDetector(
                onTap: onClear,
                child: Icon(
                  Icons.close,
                  size: 18,
                  color: Colors.white.withOpacity(0.5),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
