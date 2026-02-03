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
import '../../../../application/use_cases/reorder_sub_items_use_case.dart';
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
    final picked = await showDatePicker(
      context: context,
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
  }

  Future<void> _handleSaveChanges() async {
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
      startDate: _selectedStartDate,
      dueDate: _selectedDueDate,
      productId: _selectedProductId,
      topicId: _selectedTopicId,
    ));

    setState(() => _isLoading = false);

    result.fold(
      (failure) {
        if (mounted) {
          // 在頁面內顯示錯誤，而非 SnackBar（避免被 BottomSheet 蓋住）
          setState(() {
            _errorMessage = '儲存失敗: ${failure.message}';
          });
          // 3 秒後自動清除錯誤
          Future.delayed(const Duration(seconds: 3), () {
            if (mounted) {
              setState(() => _errorMessage = null);
            }
          });
        }
      },
      (updatedTask) async {
        // 觸發靜默刷新
        await silentRefreshTasks(ref);

        if (mounted) {
          Navigator.pop(context);
          // 關閉後的 SnackBar 會正確顯示在主頁面
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('變更已儲存')),
          );
        }
      },
    );
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
                child: GestureDetector(
                  onTap: () => FocusScope.of(context).unfocus(),
                  behavior: HitTestBehavior.opaque,
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildContentSection(),
                        const SizedBox(height: 16),
                        _buildDatesSection(),
                        const SizedBox(height: 16),
                        _buildAreaProductTopicSection(),
                        if (_subItems.isNotEmpty) ...[
                          const SizedBox(height: 16),
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
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Row(
        children: [
          const Icon(Icons.edit_rounded, color: Color(0xFF6C63FF), size: 24),
          const SizedBox(width: 8),
          const Text(
            '編輯任務',
            style: TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContentSection() {
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
            "任務內容",
            style: TextStyle(
              color: Colors.white70,
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _contentController,
            maxLines: 3,
            style: const TextStyle(color: Colors.white, fontSize: 16),
            decoration: InputDecoration(
              hintText: '輸入任務內容...',
              hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.3)),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.2)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.2)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFF6C63FF), width: 2),
              ),
            ),
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
          Row(
            children: [
              const Icon(Icons.play_circle_outline, size: 18, color: Colors.blue),
              const SizedBox(width: 8),
              const Text(
                "開始",
                style: TextStyle(color: Colors.white70, fontSize: 14),
              ),
              const Spacer(),
              if (_selectedStartDate != null) ...[
                Text(
                  DateFormat('yyyy/MM/dd').format(_selectedStartDate!),
                  style: const TextStyle(
                    fontSize: 14,
                    color: Colors.blue,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(width: 8),
              ],
              IconButton(
                icon: Icon(
                  _selectedStartDate == null ? Icons.add_circle_outline : Icons.edit_calendar,
                  color: const Color(0xFF6C63FF),
                  size: 20,
                ),
                onPressed: () => _showDatePicker(
                  title: '選擇開始日期',
                  initialDate: _selectedStartDate,
                  onDateSelected: (date) => setState(() => _selectedStartDate = date),
                ),
              ),
              if (_selectedStartDate != null)
                IconButton(
                  icon: Icon(Icons.clear, color: Colors.white.withValues(alpha: 0.5), size: 20),
                  onPressed: () => setState(() => _selectedStartDate = null),
                ),
            ],
          ),
          const SizedBox(height: 8),
          // 截止日期
          Row(
            children: [
              const Icon(Icons.calendar_today_outlined, size: 18, color: Colors.orange),
              const SizedBox(width: 8),
              const Text(
                "截止",
                style: TextStyle(color: Colors.white70, fontSize: 14),
              ),
              const Spacer(),
              if (_selectedDueDate != null) ...[
                Text(
                  DateFormat('yyyy/MM/dd').format(_selectedDueDate!),
                  style: const TextStyle(
                    fontSize: 14,
                    color: Colors.orange,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(width: 8),
              ],
              IconButton(
                icon: Icon(
                  _selectedDueDate == null ? Icons.add_circle_outline : Icons.edit_calendar,
                  color: const Color(0xFF6C63FF),
                  size: 20,
                ),
                onPressed: () => _showDatePicker(
                  title: '選擇截止日期',
                  initialDate: _selectedDueDate,
                  onDateSelected: (date) => setState(() => _selectedDueDate = date),
                ),
              ),
              if (_selectedDueDate != null)
                IconButton(
                  icon: Icon(Icons.clear, color: Colors.white.withValues(alpha: 0.5), size: 20),
                  onPressed: () => setState(() => _selectedDueDate = null),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAreaProductTopicSection() {
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
            "分類",
            style: TextStyle(
              color: Colors.white70,
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 12),
          // 橫向排列的選擇器
          Row(
            children: [
              // Area 選擇器
              Flexible(
                flex: 1,
                child: areasAsync.when(
                  data: (eitherAreas) {
                    return eitherAreas.fold(
                      (failure) => const Text("載入失敗",
                        style: TextStyle(color: Colors.red, fontSize: 12)),
                      (areas) {
                        if (areas.isEmpty) {
                          return const Text("無領域",
                            style: TextStyle(color: Colors.white70, fontSize: 12));
                        }

                        if (_selectedAreaId == null) {
                          return const SizedBox(
                            width: 40,
                            height: 40,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          );
                        }

                        final selectedArea = areas.firstWhere(
                          (area) => area.id == _selectedAreaId,
                          orElse: () => areas.first,
                        );

                        return InkWell(
                          onTap: () => _showAreaSelector(areas),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                            decoration: BoxDecoration(
                              color: const Color(0xFF6C63FF).withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: const Color(0xFF6C63FF).withValues(alpha: 0.5)),
                            ),
                            child: Center(
                              child: Text(
                                selectedArea.name,
                                style: const TextStyle(color: Colors.white, fontSize: 11),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                textAlign: TextAlign.center,
                              ),
                            ),
                          ),
                        );
                      },
                    );
                  },
                  loading: () => const SizedBox(
                    width: 40,
                    height: 40,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                  error: (err, _) => const Text("載入失敗", style: TextStyle(color: Colors.red, fontSize: 12)),
                ),
              ),
              const SizedBox(width: 8),
              // Product 選擇器
              Flexible(
                flex: 1,
                child: productsAsync.when(
                  data: (eitherProducts) {
                    return eitherProducts.fold(
                      (failure) => const Text("載入失敗",
                        style: TextStyle(color: Colors.red, fontSize: 12)),
                      (products) {
                        if (_selectedAreaId == null) {
                          return const SizedBox(
                            width: 40,
                            height: 40,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          );
                        }

                        final filteredProducts = products
                            .where((product) => product.areaId == _selectedAreaId)
                            .toList();

                        if (filteredProducts.isEmpty) {
                          return Text(
                            "無專案",
                            style: TextStyle(color: Colors.white.withValues(alpha: 0.3), fontSize: 12),
                          );
                        }

                        // 檢查當前選中的 Product 是否屬於選中的 Area
                        final currentProductInArea = filteredProducts.any(
                          (product) => product.id == _selectedProductId
                        );

                        if (!currentProductInArea) {
                          WidgetsBinding.instance.addPostFrameCallback((_) {
                            if (mounted) {
                              setState(() {
                                _selectedProductId = filteredProducts.first.id;
                                _selectedTopicId = null; // 重置 topic
                              });
                            }
                          });
                        }

                        final selectedProduct = filteredProducts.firstWhere(
                          (product) => product.id == _selectedProductId,
                          orElse: () => filteredProducts.first,
                        );

                        return InkWell(
                          onTap: () => _showProductSelector(filteredProducts),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                            decoration: BoxDecoration(
                              color: Colors.green.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: Colors.green.withValues(alpha: 0.5)),
                            ),
                            child: Center(
                              child: Text(
                                selectedProduct.name,
                                style: const TextStyle(color: Colors.white, fontSize: 11),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                textAlign: TextAlign.center,
                              ),
                            ),
                          ),
                        );
                      },
                    );
                  },
                  loading: () => const SizedBox(
                    width: 40,
                    height: 40,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                  error: (err, _) => const Text("載入失敗", style: TextStyle(color: Colors.red, fontSize: 12)),
                ),
              ),
              // Topic 選擇器
              if (_selectedTopicId != null) ...[
                const SizedBox(width: 8),
                Flexible(
                  flex: 1,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.purple.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.purple.withValues(alpha: 0.5)),
                    ),
                    child: Center(
                      child: Text(
                        widget.task.topicName ?? '未分類',
                        style: const TextStyle(color: Colors.white, fontSize: 11),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSubItemsSection() {
    final completedCount = _subItems.where((s) => s.completed).length;
    final total = _subItems.length;

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
          // 標題列 - 加入編輯模式切換按鈕
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
              // 編輯模式切換按鈕
              if (_subItems.isNotEmpty)
                TextButton.icon(
                  icon: Icon(
                    _isSubItemEditMode ? Icons.check : Icons.edit,
                    size: 16,
                    color: _isSubItemEditMode ? Colors.orange : Colors.white54,
                  ),
                  label: Text(
                    _isSubItemEditMode ? '完成' : '排序',
                    style: TextStyle(
                      fontSize: 12,
                      color: _isSubItemEditMode ? Colors.orange : Colors.white54,
                    ),
                  ),
                  onPressed: () {
                    setState(() {
                      _isSubItemEditMode = !_isSubItemEditMode;
                    });
                  },
                ),
              Text(
                "$completedCount/$total 完成",
                style: const TextStyle(
                  fontSize: 12,
                  color: Colors.white54,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.add_circle_outline, color: Color(0xFF6C63FF), size: 20),
                onPressed: _handleAddSubItem,
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Divider(height: 1, color: Colors.white10),
          const SizedBox(height: 8),
          // Sub-items 列表 - 根據編輯模式切換顯示方式
          if (_isSubItemEditMode)
            // 編輯模式: 使用 ReorderableListView 支援拖拽
            ReorderableListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _subItems.length,
              onReorder: _handleReorderSubItems,
              itemBuilder: (context, index) {
                final sub = _subItems[index];
                return Container(
                  key: ValueKey(sub.id),
                  margin: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // 拖拽手柄
                      Icon(
                        Icons.drag_handle,
                        size: 20,
                        color: Colors.white.withValues(alpha: 0.5),
                      ),
                      const SizedBox(width: 8),
                      // 完成狀態圖示
                      Icon(
                        sub.completed ? Icons.check_circle : Icons.circle_outlined,
                        size: 20,
                        color: sub.completed ? Colors.green : Colors.white.withValues(alpha: 0.4),
                      ),
                      const SizedBox(width: 10),
                      // 內容
                      Expanded(
                        child: Text(
                          sub.content,
                          style: TextStyle(
                            color: sub.completed
                                ? Colors.white.withValues(alpha: 0.5)
                                : Colors.white,
                            fontSize: 14,
                            height: 1.4,
                            decoration: sub.completed ? TextDecoration.lineThrough : null,
                          ),
                        ),
                      ),
                      // 刪除按鈕
                      IconButton(
                        icon: Icon(Icons.close, color: Colors.white.withValues(alpha: 0.3), size: 18),
                        onPressed: () => _handleDeleteSubItem(sub.id),
                      ),
                    ],
                  ),
                );
              },
            )
          else
            // 一般模式: 可勾選、刪除
            ..._subItems.map((sub) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
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
                              size: 20,
                              color: sub.completed ? Colors.green : Colors.white.withValues(alpha: 0.4),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: AnimatedDefaultTextStyle(
                          duration: const Duration(milliseconds: 200),
                          style: TextStyle(
                            color: sub.completed
                                ? Colors.white.withValues(alpha: 0.5)
                                : Colors.white,
                            fontSize: 14,
                            height: 1.4,
                            decoration: sub.completed ? TextDecoration.lineThrough : null,
                          ),
                          child: Text(sub.content),
                        ),
                      ),
                      IconButton(
                        icon: Icon(Icons.close, color: Colors.white.withValues(alpha: 0.3), size: 18),
                        onPressed: () => _handleDeleteSubItem(sub.id),
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
