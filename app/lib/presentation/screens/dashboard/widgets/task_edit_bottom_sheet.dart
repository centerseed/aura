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
import '../../../../application/use_cases/update_task_details_use_case.dart';
import '../../../providers/task_provider.dart';
import '../../../providers/area_provider.dart';
import '../../../providers/product_provider.dart';

class TaskEditBottomSheet extends ConsumerStatefulWidget {
  final Task task;

  const TaskEditBottomSheet({super.key, required this.task});

  @override
  ConsumerState<TaskEditBottomSheet> createState() =>
      _TaskEditBottomSheetState();
}

class _TaskEditBottomSheetState extends ConsumerState<TaskEditBottomSheet> {
  late DateTime? _selectedDueDate;
  late String _selectedProductId;
  String? _selectedAreaId;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _selectedDueDate = widget.task.dueDate;
    _selectedProductId = widget.task.productId;
  }

  Future<void> _showDatePicker(Function(DateTime?) onDateSelected) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
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
    setState(() => _isLoading = true);

    final useCase = ref.read(updateTaskDetailsUseCaseProvider);
    final result = await useCase(UpdateTaskDetailsParams(
      taskId: widget.task.id,
      dueDate: _selectedDueDate,
      productId: _selectedProductId,
    ));

    setState(() => _isLoading = false);

    result.fold(
      (failure) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('儲存失敗: ${failure.message}')),
          );
        }
      },
      (updatedTask) {
        if (mounted) {
          ref.invalidate(activeTasksProvider);
          Navigator.pop(context);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('變更已儲存')),
          );
        }
      },
    );
  }

  Future<void> _handleComplete() async {
    HapticFeedback.mediumImpact();

    // 先儲存當前變更
    setState(() => _isLoading = true);

    final useCase = ref.read(updateTaskDetailsUseCaseProvider);

    // 儲存變更
    await useCase(UpdateTaskDetailsParams(
      taskId: widget.task.id,
      dueDate: _selectedDueDate,
      productId: _selectedProductId,
    ));

    // 然後標記完成
    await useCase(UpdateTaskDetailsParams(
      taskId: widget.task.id,
      status: TaskStatus.archive,
    ));

    setState(() => _isLoading = false);

    if (mounted) {
      ref.invalidate(activeTasksProvider);
      ref.invalidate(completedTodayTasksProvider);
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('太棒了!任務已完成!')),
      );
    }
  }

  void _handleStartFocus() {
    Navigator.pop(context);
    context.push('/focus/${widget.task.id}', extra: widget.task);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 700,
      decoration: BoxDecoration(
        color: const Color(0xFF1c1c1e).withOpacity(0.95),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
        border: Border.all(color: Colors.white.withOpacity(0.1)),
      ),
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
        child: BackdropFilter(
          filter: dart_ui.ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: Column(
            children: [
              _buildHandle(),
              _buildHeader(),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    children: [
                      _buildDueDateSection(),
                      const SizedBox(height: 16),
                      _buildAreaProductSection(),
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
        color: Colors.white.withOpacity(0.3),
        borderRadius: BorderRadius.circular(2),
      ),
    );
  }

  Widget _buildHeader() {
    final contextParts = [
      widget.task.areaName,
      widget.task.productName,
      widget.task.topicName,
    ].whereType<String>().where((s) => s.trim().isNotEmpty).toList();
    final contextString = contextParts.join(' > ');

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (contextString.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                contextString,
                style: const TextStyle(
                  fontSize: 12,
                  color: Color(0xFF6C63FF),
                ),
              ),
            ),
          Text(
            widget.task.content,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDueDateSection() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            "截止日期",
            style: TextStyle(
              color: Colors.white70,
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _selectedDueDate != null
                    ? Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.orange.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.calendar_today_outlined,
                              size: 12,
                              color: Colors.orange,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              DateFormat('yyyy/MM/dd')
                                  .format(_selectedDueDate!),
                              style: const TextStyle(
                                fontSize: 14,
                                color: Colors.orange,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      )
                    : Text(
                        "未設定",
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.3),
                          fontSize: 14,
                        ),
                      ),
              ),
              IconButton(
                icon: const Icon(Icons.edit_calendar, color: Color(0xFF6C63FF)),
                onPressed: () => _showDatePicker((date) {
                  setState(() => _selectedDueDate = date);
                }),
              ),
              if (_selectedDueDate != null)
                IconButton(
                  icon: Icon(Icons.clear, color: Colors.white.withOpacity(0.5)),
                  onPressed: () => setState(() => _selectedDueDate = null),
                ),
            ],
          ),
        ],
      ),
    );
  }


  Widget _buildAreaProductSection() {
    final areasAsync = ref.watch(areasProvider);
    final productsAsync = ref.watch(productsProvider);

    // 初始化 _selectedAreaId：從 products 中反向查找
    if (_selectedAreaId == null) {
      productsAsync.whenData((eitherProducts) {
        eitherProducts.fold(
          (_) {},
          (products) {
            if (products.isNotEmpty) {
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
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            "領域與專案",
            style: TextStyle(
              color: Colors.white70,
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 12),
          // Area 選擇器
          areasAsync.when(
            data: (eitherAreas) {
              return eitherAreas.fold(
                (failure) => Text("載入失敗: ${failure.message}",
                  style: const TextStyle(color: Colors.red)),
                (areas) {
                  if (areas.isEmpty) {
                    return const Text("無領域資料",
                      style: TextStyle(color: Colors.white70));
                  }

                  // 如果還在初始化中，顯示 loading
                  if (_selectedAreaId == null) {
                    return const CircularProgressIndicator();
                  }

                  final selectedArea = areas.firstWhere(
                    (area) => area.id == _selectedAreaId,
                    orElse: () => areas.first,
                  );

                  return InkWell(
                    onTap: () => _showAreaSelector(areas),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: const Color(0xFF6C63FF).withOpacity(0.2),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFF6C63FF).withOpacity(0.5)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.category, size: 16, color: Color(0xFF6C63FF)),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              selectedArea.name,
                              style: const TextStyle(color: Colors.white),
                            ),
                          ),
                          const Icon(Icons.arrow_drop_down, color: Colors.white70),
                        ],
                      ),
                    ),
                  );
                },
              );
            },
            loading: () => const CircularProgressIndicator(),
            error: (err, _) => Text("載入失敗: $err", style: const TextStyle(color: Colors.red)),
          ),
          const SizedBox(height: 12),
          // Product 選擇器
          productsAsync.when(
            data: (eitherProducts) {
              return eitherProducts.fold(
                (failure) => Text("載入失敗: ${failure.message}",
                  style: const TextStyle(color: Colors.red)),
                (products) {
                  // 如果 _selectedAreaId 還在初始化中，顯示 loading
                  if (_selectedAreaId == null) {
                    return const CircularProgressIndicator();
                  }

                  // 過濾出屬於選定 Area 的 Products
                  final filteredProducts = products
                      .where((product) => product.areaId == _selectedAreaId)
                      .toList();

                  if (filteredProducts.isEmpty) {
                    return Text(
                      "此領域無專案",
                      style: TextStyle(color: Colors.white.withOpacity(0.3)),
                    );
                  }

                  // 檢查當前選中的 Product 是否屬於選中的 Area
                  final currentProductInArea = filteredProducts.any(
                    (product) => product.id == _selectedProductId
                  );

                  // 如果不屬於,自動選擇第一個
                  if (!currentProductInArea) {
                    WidgetsBinding.instance.addPostFrameCallback((_) {
                      if (mounted) {
                        setState(() {
                          _selectedProductId = filteredProducts.first.id;
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
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: Colors.green.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.green.withOpacity(0.5)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.work_outline, size: 16, color: Colors.green),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              selectedProduct.name,
                              style: const TextStyle(color: Colors.white),
                            ),
                          ),
                          const Icon(Icons.arrow_drop_down, color: Colors.white70),
                        ],
                      ),
                    ),
                  );
                },
              );
            },
            loading: () => const CircularProgressIndicator(),
            error: (err, _) => Text("載入失敗: $err", style: const TextStyle(color: Colors.red)),
          ),
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
              selectedTileColor: const Color(0xFF6C63FF).withOpacity(0.2),
              onTap: () => Navigator.pop(context, area),
            )),
          ],
        ),
      ),
    );

    if (selected != null) {
      setState(() {
        _selectedAreaId = selected.id;
        // Area 改變時,_selectedProductId 會在下次渲染時自動更新為該 Area 的第一個 Product
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
              selectedTileColor: Colors.green.withOpacity(0.2),
              onTap: () => Navigator.pop(context, product),
            )),
          ],
        ),
      ),
    );

    if (selected != null) {
      setState(() {
        _selectedProductId = selected.id;
      });
    }
  }

  Widget _buildActionButtons() {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          // 主操作:儲存變更 (最顯眼)
          SizedBox(
            width: double.infinity,
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
              label: Text(_isLoading ? "儲存中..." : "儲存變更"),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF6C63FF),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 18),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                elevation: 4,
                shadowColor: const Color(0xFF6C63FF).withOpacity(0.5),
              ),
            ),
          ),
          const SizedBox(height: 12),
          // 次要操作:進入專注模式
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _isLoading ? null : _handleStartFocus,
              icon: const Icon(Icons.center_focus_strong_rounded),
              label: const Text("進入專注模式"),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.white,
                side: BorderSide(color: Colors.white.withOpacity(0.3)),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          // 完成操作:標記為已完成 (移至最下方)
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
