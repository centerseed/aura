import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/di/providers.dart';
import '../../../../domain/entities/task.dart';
import '../../../../domain/entities/product.dart';
import '../../../../domain/entities/area.dart';
import '../../../../domain/entities/reference.dart';
import '../../../../application/use_cases/add_product_reference_use_case.dart';
import '../../../../application/use_cases/delete_product_reference_use_case.dart';
import '../../../../application/use_cases/reorganize_product_topics_use_case.dart';
import '../../../../application/use_cases/apply_reorganization_use_case.dart';
import '../../../providers/dashboard_provider.dart';
import '../../../providers/product_provider.dart';
import '../../../providers/product_reference_provider.dart';
import '../widgets/task_detail_bottom_sheet.dart';
import '../widgets/reorganize_bottom_sheet.dart';
import '../../project/widgets/reference_bottom_sheet.dart';
import '../../project/project_detail_screen.dart';

/// 全視圖分頁 - 顯示 Area-Product 層級結構
class OverviewTab extends ConsumerStatefulWidget {
  const OverviewTab({super.key});

  @override
  ConsumerState<OverviewTab> createState() => _OverviewTabState();
}

class _OverviewTabState extends ConsumerState<OverviewTab> {
  // 追蹤展開的Product
  final Set<String> _expandedProducts = {};

  // Reorganization state
  bool _isReorganizing = false;

  @override
  Widget build(BuildContext context) {
    // 使用 Dashboard API 統一載入 Areas + Products（單一 HTTP 請求）
    final areasAsync = ref.watch(dashboardAreasProvider);
    final productsAsync = ref.watch(dashboardProductsProvider);

    return SafeArea(
      child: RefreshIndicator(
        onRefresh: () async {
          // 只需 invalidate dashboardProvider，areas 和 products 會自動重新載入
          ref.invalidate(dashboardProvider);
        },
        color: const Color(0xFF6C63FF),
        backgroundColor: const Color(0xFF161B22),
        child: CustomScrollView(
          slivers: [
            // Header
            SliverToBoxAdapter(
              child: _buildHeader(),
            ),
            // Area-Product List
            productsAsync.when(
              data: (productsEither) => areasAsync.when(
                data: (areasEither) {
                  return productsEither.fold(
                    (failure) => SliverToBoxAdapter(
                      child: _buildErrorState(failure.message),
                    ),
                    (products) => areasEither.fold(
                      (failure) => SliverToBoxAdapter(
                        child: _buildErrorState(failure.message),
                      ),
                      (areas) => _buildAreaProductList(areas, products),
                    ),
                  );
                },
                loading: () => const SliverToBoxAdapter(
                  child: Center(
                    child: Padding(
                      padding: EdgeInsets.all(48.0),
                      child: CircularProgressIndicator(color: Color(0xFF6C63FF)),
                    ),
                  ),
                ),
                error: (error, _) => SliverToBoxAdapter(
                  child: _buildErrorState(error.toString()),
                ),
              ),
              loading: () => const SliverToBoxAdapter(
                child: Center(
                  child: Padding(
                    padding: EdgeInsets.all(48.0),
                    child: CircularProgressIndicator(color: Color(0xFF6C63FF)),
                  ),
                ),
              ),
              error: (error, _) => SliverToBoxAdapter(
                child: _buildErrorState(error.toString()),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.all(20.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                '全視圖',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.person_outline, color: Colors.white70),
                onPressed: () => context.push('/profile'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Area → Product 結構',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.6),
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAreaProductList(List<Area> areas, List<Product> products) {
    if (areas.isEmpty) {
      return SliverToBoxAdapter(
        child: _buildEmptyState(),
      );
    }

    // 按 Area 分組 Products
    final Map<String, List<Product>> productsByArea = {};
    for (final product in products) {
      if (!productsByArea.containsKey(product.areaId)) {
        productsByArea[product.areaId] = [];
      }
      productsByArea[product.areaId]!.add(product);
    }

    return SliverList(
      delegate: SliverChildListDelegate([
        ...areas.expand((area) {
          final areaProducts = productsByArea[area.id] ?? [];
          if (areaProducts.isEmpty) return <Widget>[];

          return [
            _buildAreaHeader(area),
            ...areaProducts.map((product) => _buildProductCard(product)),
            const SizedBox(height: 16),
          ];
        }),
        const SizedBox(height: 100), // Space for FAB
      ]),
    );
  }

  Widget _buildAreaHeader(Area area) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
      child: Row(
        children: [
          Container(
            width: 4,
            height: 24,
            decoration: BoxDecoration(
              color: const Color(0xFF6C63FF),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  area.name,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (area.description != null && area.description!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      area.description!,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.4),
                        fontSize: 12,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProductCard(Product product) {
    // 優先使用完整任務列表，回退到最近任務
    final displayTasks = product.tasks ?? product.recentTasks ?? [];
    final hasReferences = product.referenceCount > 0;
    final isExpanded = _expandedProducts.contains(product.id);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFF161B22),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Product Header
            Row(
              children: [
                // 展開/折疊圖示 - 點擊展開/折疊任務
                GestureDetector(
                  onTap: () {
                    setState(() {
                      if (isExpanded) {
                        _expandedProducts.remove(product.id);
                      } else {
                        _expandedProducts.add(product.id);
                      }
                    });
                  },
                  child: Icon(
                    isExpanded ? Icons.expand_less : Icons.expand_more,
                    color: Colors.white.withValues(alpha: 0.5),
                    size: 24,
                  ),
                ),
                const SizedBox(width: 8),
                // Product 名稱 - 點擊進入詳情頁
                Expanded(
                  child: GestureDetector(
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => ProjectDetailScreen(product: product),
                        ),
                      );
                    },
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          product.name,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        if (product.description != null && product.description!.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              product.description!,
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.5),
                                fontSize: 13,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                // References Button
                if (hasReferences)
                  _buildActionButton(
                    icon: Icons.library_books,
                    label: '${product.referenceCount}',
                    color: const Color(0xFFF59E0B),
                    onTap: () => _showReferences(product),
                  ),
                const SizedBox(width: 8),
                // AI Reorganize Button
                _buildActionButton(
                  icon: Icons.auto_awesome,
                  label: 'AI',
                  color: const Color(0xFF6C63FF),
                  onTap: () => _handleReorganize(product),
                ),
              ],
            ),
            // 縮略模式：顯示最近3個任務
            if (!isExpanded && displayTasks.isNotEmpty) ...[
              const SizedBox(height: 12),
              const Divider(color: Colors.white10, height: 1),
              const SizedBox(height: 8),
              ...displayTasks.take(3).map((task) => _buildTaskPreview(task)),
              if (product.taskCount > 3)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    '+ ${product.taskCount - 3} 更多任務',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.4),
                      fontSize: 12,
                    ),
                  ),
                ),
            ],
            // 展開模式：顯示所有任務及子項
            if (isExpanded) ...[
              const SizedBox(height: 12),
              const Divider(color: Colors.white10, height: 1),
              const SizedBox(height: 12),
              // 調試：顯示任務數量
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  '任務數：${displayTasks.length}',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.5),
                    fontSize: 12,
                  ),
                ),
              ),
              if (displayTasks.isNotEmpty)
                Column(
                  children: displayTasks.map((task) => _buildExpandedTaskCard(task)).toList(),
                )
              else
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  child: Center(
                    child: Text(
                      '無任務',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.4),
                        fontSize: 14,
                      ),
                    ),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }

  /// 展開模式中的任務卡片 - 使用今日畫面的樣式
  Widget _buildExpandedTaskCard(Task task) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.03),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Task Header
            InkWell(
              onTap: () => _showTaskDetails(task),
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    // 移除誤導性的完成按鈕圓圈，改用更簡潔的樣式
                    Container(
                      width: 4,
                      height: 4,
                      decoration: BoxDecoration(
                        color: task.isOverdue
                            ? const Color(0xFFEF4444)
                            : const Color(0xFF3B82F6),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        task.content,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    // 日期標籤
                    if (task.dueDate != null)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: task.isOverdue
                              ? const Color(0xFFEF4444).withValues(alpha: 0.15)
                              : const Color(0xFF3B82F6).withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: task.isOverdue
                                ? const Color(0xFFEF4444).withValues(alpha: 0.3)
                                : const Color(0xFF3B82F6).withValues(alpha: 0.3),
                          ),
                        ),
                        child: Text(
                          _formatDueDate(task.dueDate!),
                          style: TextStyle(
                            color: task.isOverdue
                                ? const Color(0xFFEF4444)
                                : const Color(0xFF3B82F6),
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            // Sub-items (如果有)
            if (task.subItems != null && task.subItems!.isNotEmpty) ...[
              const SizedBox(height: 10),
              Padding(
                padding: const EdgeInsets.only(left: 30),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: task.subItems!.map((subItem) {
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Row(
                        children: [
                          Container(
                            width: 16,
                            height: 16,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: subItem.completed
                                  ? const Color(0xFF4ADE80)
                                  : Colors.transparent,
                              border: Border.all(
                                color: subItem.completed
                                    ? const Color(0xFF4ADE80)
                                    : Colors.white.withValues(alpha: 0.3),
                                width: 1.5,
                              ),
                            ),
                            child: subItem.completed
                                ? const Icon(
                                    Icons.check,
                                    size: 10,
                                    color: Colors.white,
                                  )
                                : null,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              subItem.content,
                              style: TextStyle(
                                color: subItem.completed
                                    ? Colors.white.withValues(alpha: 0.4)
                                    : Colors.white.withValues(alpha: 0.7),
                                fontSize: 13,
                                decoration: subItem.completed
                                    ? TextDecoration.lineThrough
                                    : null,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    );
                  }).toList(),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildActionButton({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTaskPreview(Task task) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: InkWell(
        onTap: () => _showTaskDetails(task),
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Row(
            children: [
              // 移除誤導性的圓圈圖標，改用小點指示
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.3),
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  task.content,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (task.dueDate != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: task.isOverdue
                        ? const Color(0xFFEF4444).withValues(alpha: 0.2)
                        : const Color(0xFF3B82F6).withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    _formatDueDate(task.dueDate!),
                    style: TextStyle(
                      color: task.isOverdue
                          ? const Color(0xFFEF4444)
                          : const Color(0xFF3B82F6),
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatDueDate(DateTime date) {
    final now = DateTime.now();
    final diff = date.difference(now).inDays;

    if (diff < 0) return '逾期';
    if (diff == 0) return '今天';
    if (diff == 1) return '明天';
    if (diff < 7) return '$diff 天';
    return '${date.month}/${date.day}';
  }

  void _showReferences(Product product) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
        ),
        child: ReferenceBottomSheet(
          productId: product.id,
          productName: product.name,
          onAddReference: (type, content, title) async {
            final addUseCase = ref.read(addProductReferenceUseCaseProvider);

            // 將 String 轉換為 ReferenceType enum
            final referenceType = type.toLowerCase() == 'url'
                ? ReferenceType.url
                : ReferenceType.note;

            final result = await addUseCase(
              AddProductReferenceParams(
                productId: product.id,
                type: referenceType,
                content: content,
                title: title,
              ),
            );

            if (!mounted) return;

            result.fold(
              (failure) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('新增失敗：${failure.message}'),
                    backgroundColor: const Color(0xFFEF4444),
                  ),
                );
              },
              (_) {
                // 新增成功，刷新 reference 快取
                ref.read(referenceCachedRepositoryProvider(product.id)).silentRefresh();
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('已新增 Reference'),
                    backgroundColor: Color(0xFF4ADE80),
                  ),
                );
              },
            );
          },
          onDeleteReference: (referenceId) async {
            final deleteUseCase = ref.read(deleteProductReferenceUseCaseProvider);
            final result = await deleteUseCase(
              DeleteProductReferenceParams(
                productId: product.id,
                referenceId: referenceId,
              ),
            );

            if (!mounted) return;

            result.fold(
              (failure) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('刪除失敗：${failure.message}'),
                    backgroundColor: const Color(0xFFEF4444),
                  ),
                );
              },
              (_) {
                // 刪除成功，刷新 reference 快取
                ref.read(referenceCachedRepositoryProvider(product.id)).silentRefresh();
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('已刪除 Reference'),
                    backgroundColor: Color(0xFF4ADE80),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }

  void _handleReorganize(Product product) async {
    if (_isReorganizing) return;

    // 立即顯示loading dialog
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF6C63FF)),
            ),
            const SizedBox(height: 16),
            Text(
              'AI 分析中...',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.white,
                  ),
            ),
          ],
        ),
      ),
    );

    setState(() {
      _isReorganizing = true;
    });

    try {
      final useCase = ref.read(reorganizeProductTopicsUseCaseProvider);
      final result = await useCase(
        ReorganizeProductTopicsParams(productId: product.id),
      );

      if (!mounted) return;

      // 關閉loading dialog
      Navigator.pop(context);

      result.fold(
        (failure) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('AI 分析失敗：${failure.message}'),
              backgroundColor: const Color(0xFFEF4444),
            ),
          );
        },
        (proposal) {
          showModalBottomSheet(
            context: context,
            isScrollControlled: true,
            backgroundColor: Colors.transparent,
            builder: (context) => ReorganizeBottomSheet(
              proposal: proposal,
              isApplying: false,
              onApply: () => _handleApplyReorganization(proposal),
            ),
          );
        },
      );
    } catch (e) {
      if (!mounted) return;
      Navigator.pop(context); // 關閉loading dialog
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('發生錯誤：$e'),
          backgroundColor: const Color(0xFFEF4444),
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isReorganizing = false;
        });
      }
    }
  }

  Future<void> _handleApplyReorganization(
    dynamic proposal,
  ) async {
    try {
      final useCase = ref.read(applyReorganizationUseCaseProvider);
      final result = await useCase(
        ApplyReorganizationParams(
          productId: proposal.productId,
          proposal: proposal,
        ),
      );

      if (!mounted) return;

      result.fold(
        (failure) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('應用失敗：${failure.message}'),
              backgroundColor: const Color(0xFFEF4444),
            ),
          );
        },
        (_) {
          Navigator.pop(context);
          ref.invalidate(productsProvider);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('已應用 AI 整理建議'),
              backgroundColor: Color(0xFF4ADE80),
            ),
          );
        },
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('發生錯誤：$e'),
          backgroundColor: const Color(0xFFEF4444),
        ),
      );
    }
  }


  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(48.0),
        child: Column(
          children: [
            Icon(
              Icons.check_circle_outline,
              size: 64,
              color: Colors.white.withValues(alpha: 0.3),
            ),
            const SizedBox(height: 16),
            Text(
              '太棒了！沒有待辦事項',
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.5),
                fontSize: 16,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorState(String message) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(48.0),
        child: Column(
          children: [
            const Icon(
              Icons.error_outline,
              size: 64,
              color: Colors.red,
            ),
            const SizedBox(height: 16),
            Text(
              message,
              style: const TextStyle(color: Colors.white70),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () {
                ref.invalidate(dashboardProvider);
              },
              child: const Text('重試'),
            ),
          ],
        ),
      ),
    );
  }

  void _showTaskDetails(Task task) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => TaskDetailBottomSheet(task: task),
    );
  }

}
