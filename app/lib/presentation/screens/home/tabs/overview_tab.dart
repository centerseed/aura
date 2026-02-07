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
              ShaderMask(
                shaderCallback: (bounds) => const LinearGradient(
                  colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                ).createShader(bounds),
                child: const Text(
                  '全視圖',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              Container(
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.1),
                  ),
                ),
                child: IconButton(
                  icon: const Icon(Icons.person_outline, color: Colors.white70),
                  onPressed: () => context.push('/profile'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Area → Product 結構',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.5),
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
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFF6366F1).withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(
              Icons.folder_outlined,
              color: Color(0xFF6366F1),
              size: 18,
            ),
          ),
          const SizedBox(width: 12),
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
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 5),
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              const Color(0xFF3B82F6).withValues(alpha: 0.08),
              Colors.white.withValues(alpha: 0.03),
            ],
          ),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: const Color(0xFF3B82F6).withValues(alpha: 0.18),
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 左側色條
            Container(
              width: 4,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Color(0xFF3B82F6),
                    Color(0xFF6366F1),
                  ],
                ),
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(16),
                  bottomLeft: Radius.circular(16),
                ),
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Product Header
                    Row(
                      children: [
                        // 展開/折疊圖示
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
                          child: Container(
                            width: 28,
                            height: 28,
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.06),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Icon(
                              isExpanded ? Icons.expand_less : Icons.expand_more,
                              color: Colors.white.withValues(alpha: 0.5),
                              size: 20,
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        // Product 名稱
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
                                        color: Colors.white.withValues(alpha: 0.45),
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
                        const SizedBox(width: 8),
                        // References Button
                        if (hasReferences) ...[
                          _buildActionButton(
                            icon: Icons.library_books,
                            label: '${product.referenceCount}',
                            color: const Color(0xFFF59E0B),
                            onTap: () => _showReferences(product),
                          ),
                          const SizedBox(width: 6),
                        ],
                        // AI Reorganize Button
                        _buildActionButton(
                          icon: Icons.auto_awesome,
                          label: 'AI',
                          color: const Color(0xFF8B5CF6),
                          onTap: () => _handleReorganize(product),
                        ),
                      ],
                    ),
                    // 縮略模式：顯示最近3個任務
                    if (!isExpanded && displayTasks.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      Container(
                        height: 1,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              Colors.white.withValues(alpha: 0.1),
                              Colors.transparent,
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      ...displayTasks.take(3).map((task) => _buildTaskPreview(task)),
                      if (product.taskCount > 3)
                        Padding(
                          padding: const EdgeInsets.only(top: 4, left: 18),
                          child: Text(
                            '+ ${product.taskCount - 3} 更多任務',
                            style: TextStyle(
                              color: const Color(0xFF6366F1).withValues(alpha: 0.6),
                              fontSize: 12,
                            ),
                          ),
                        ),
                    ],
                    // 展開模式：顯示所有任務及子項
                    if (isExpanded) ...[
                      const SizedBox(height: 12),
                      Container(
                        height: 1,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              Colors.white.withValues(alpha: 0.1),
                              Colors.transparent,
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: const Color(0xFF3B82F6).withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              '${displayTasks.length} 個任務',
                              style: TextStyle(
                                color: const Color(0xFF3B82F6).withValues(alpha: 0.8),
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
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
            ),
          ],
        ),
      ),
    );
  }

  /// 展開模式中的任務卡片
  Widget _buildExpandedTaskCard(Task task) {
    final accentColor = task.isOverdue
        ? const Color(0xFFEF4444)
        : task.isToday
            ? const Color(0xFFF59E0B)
            : const Color(0xFF6366F1);

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.centerLeft,
            end: Alignment.centerRight,
            colors: [
              accentColor.withValues(alpha: 0.06),
              Colors.transparent,
            ],
          ),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: accentColor.withValues(alpha: 0.12),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Task Header
            InkWell(
              onTap: () => _showTaskDetails(task),
              borderRadius: BorderRadius.circular(8),
              child: Row(
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: accentColor,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: accentColor.withValues(alpha: 0.4),
                          blurRadius: 4,
                        ),
                      ],
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
                        color: accentColor.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: accentColor.withValues(alpha: 0.2),
                        ),
                      ),
                      child: Text(
                        _formatDueDate(task.dueDate!),
                        style: TextStyle(
                          color: accentColor,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            // Sub-items
            if (task.subItems != null && task.subItems!.isNotEmpty) ...[
              const SizedBox(height: 10),
              Padding(
                padding: const EdgeInsets.only(left: 18),
                child: Container(
                  padding: const EdgeInsets.only(left: 12),
                  decoration: BoxDecoration(
                    border: Border(
                      left: BorderSide(
                        color: Colors.white.withValues(alpha: 0.08),
                        width: 1,
                      ),
                    ),
                  ),
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
                                borderRadius: BorderRadius.circular(4),
                                color: subItem.completed
                                    ? const Color(0xFF10B981)
                                    : Colors.transparent,
                                border: Border.all(
                                  color: subItem.completed
                                      ? const Color(0xFF10B981)
                                      : Colors.white.withValues(alpha: 0.2),
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
                                      ? Colors.white.withValues(alpha: 0.35)
                                      : Colors.white.withValues(alpha: 0.7),
                                  fontSize: 13,
                                  decoration: subItem.completed
                                      ? TextDecoration.lineThrough
                                      : null,
                                  decorationColor: Colors.white.withValues(alpha: 0.3),
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
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              color.withValues(alpha: 0.2),
              color.withValues(alpha: 0.1),
            ],
          ),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withValues(alpha: 0.25)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 13, color: color),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTaskPreview(Task task) {
    final dotColor = task.isOverdue
        ? const Color(0xFFEF4444)
        : task.isToday
            ? const Color(0xFFF59E0B)
            : const Color(0xFF6366F1);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: InkWell(
        onTap: () => _showTaskDetails(task),
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          child: Row(
            children: [
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: dotColor,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: dotColor.withValues(alpha: 0.4),
                      blurRadius: 4,
                    ),
                  ],
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
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(
                    color: dotColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: dotColor.withValues(alpha: 0.2),
                    ),
                  ),
                  child: Text(
                    _formatDueDate(task.dueDate!),
                    style: TextStyle(
                      color: dotColor,
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
    final today = DateTime(now.year, now.month, now.day);
    final dueDay = DateTime(date.year, date.month, date.day);

    final diff = dueDay.difference(today).inDays;

    if (diff < 0) return '逾期 ${-diff} 天';
    if (diff == 0) return '今天';
    if (diff == 1) return '明天';
    if (diff < 7) return '$diff 天後';
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
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  colors: [
                    const Color(0xFF6366F1).withValues(alpha: 0.2),
                    const Color(0xFF8B5CF6).withValues(alpha: 0.2),
                  ],
                ),
              ),
              child: const Icon(
                Icons.dashboard_outlined,
                size: 40,
                color: Color(0xFF6366F1),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              '尚未建立任何專案',
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.6),
                fontSize: 16,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '開始記錄你的第一個想法吧',
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.4),
                fontSize: 14,
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
      builder: (context) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: TaskDetailBottomSheet(task: task),
      ),
    );
  }

}
