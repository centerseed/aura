import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:app/core/theme/app_colors.dart';

import '../../../../core/di/providers.dart';
import '../../../../domain/entities/product.dart';
import '../../../../domain/entities/area.dart';
import '../../../../domain/entities/task.dart';
import '../../../../application/use_cases/update_product_use_case.dart';
import '../../../utils/product_priority_colors.dart';
import '../../../widgets/product_priority_badge.dart';
import '../../../providers/dashboard_provider.dart';

/// 優先度視圖分頁 — 將所有 Product 依 P0~P3 分組呈現，支援拖曳改變優先度
class PriorityViewTab extends ConsumerStatefulWidget {
  const PriorityViewTab({super.key});

  @override
  ConsumerState<PriorityViewTab> createState() => _PriorityViewTabState();
}

class _PriorityViewTabState extends ConsumerState<PriorityViewTab> {
  @override
  Widget build(BuildContext context) {
    final areasAsync = ref.watch(dashboardAreasProvider);
    final productsAsync = ref.watch(dashboardProductsProvider);
    final colorScheme = Theme.of(context).colorScheme;

    return SafeArea(
      child: RefreshIndicator(
        onRefresh: () async => ref.invalidate(dashboardProvider),
        color: AppColors.primary,
        backgroundColor: colorScheme.surfaceContainer,
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(child: _buildHeader(context)),
            productsAsync.when(
              data: (productsEither) => areasAsync.when(
                data: (areasEither) => productsEither.fold(
                  (failure) => SliverToBoxAdapter(
                    child: _buildError(context, failure.message),
                  ),
                  (products) => areasEither.fold(
                    (failure) => SliverToBoxAdapter(
                      child: _buildError(context, failure.message),
                    ),
                    (areas) => _buildPriorityList(context, areas, products),
                  ),
                ),
                loading: () => _buildLoading(),
                error: (e, _) =>
                    SliverToBoxAdapter(child: _buildError(context, e.toString())),
              ),
              loading: () => _buildLoading(),
              error: (e, _) =>
                  SliverToBoxAdapter(child: _buildError(context, e.toString())),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 100)),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '優先度視圖',
            style: TextStyle(
              color: colorScheme.onSurface,
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '依優先度管理所有專案',
            style: TextStyle(color: colorScheme.onSurfaceVariant, fontSize: 14),
          ),
        ],
      ),
    );
  }

  SliverToBoxAdapter _buildLoading() {
    return const SliverToBoxAdapter(
      child: Center(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
      ),
    );
  }

  Widget _buildError(BuildContext context, String message) {
    return Padding(
      padding: const EdgeInsets.all(48),
      child: Center(
        child: Text(
          message,
          style: TextStyle(color: Theme.of(context).colorScheme.error),
          textAlign: TextAlign.center,
        ),
      ),
    );
  }

  SliverList _buildPriorityList(
    BuildContext context,
    List<Area> areas,
    List<Product> products,
  ) {
    final areaMap = {for (final a in areas) a.id: a.name};

    final productsWithArea =
        products.map((p) => (product: p, areaName: areaMap[p.areaId] ?? '')).toList();

    final grouped = <ProductPriority, List<({Product product, String areaName})>>{};
    for (final e in productsWithArea) {
      grouped.putIfAbsent(e.product.priority, () => []).add(e);
    }

    const priorityOrder = [
      ProductPriority.p0,
      ProductPriority.p1,
      ProductPriority.p2,
      ProductPriority.p3,
    ];

    return SliverList(
      delegate: SliverChildBuilderDelegate(
        (context, index) => _buildPriorityGroup(
          context,
          priorityOrder[index],
          grouped[priorityOrder[index]] ?? [],
        ),
        childCount: priorityOrder.length,
      ),
    );
  }

  Widget _buildPriorityGroup(
    BuildContext context,
    ProductPriority priority,
    List<({Product product, String areaName})> items,
  ) {
    final colorScheme = Theme.of(context).colorScheme;
    final pColor = priority.color;

    return DragTarget<Product>(
      onWillAcceptWithDetails: (details) =>
          details.data.priority != priority,
      onAcceptWithDetails: (details) =>
          _handlePriorityChange(context, details.data, priority),
      builder: (context, candidateData, rejectedData) {
        final isHovered = candidateData.isNotEmpty;
        return Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            decoration: BoxDecoration(
              border: Border.all(
                color: isHovered
                    ? pColor.withValues(alpha: 0.8)
                    : pColor.withValues(alpha: 0.3),
                width: isHovered ? 2 : 1,
              ),
              borderRadius: BorderRadius.circular(16),
              color: isHovered
                  ? pColor.withValues(alpha: 0.12)
                  : pColor.withValues(alpha: 0.05),
            ),
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(color: pColor, shape: BoxShape.circle),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        '${priority.label} — ${priority.description}',
                        style: TextStyle(
                          color: colorScheme.onSurface,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    Text(
                      '${items.length} 個',
                      style: TextStyle(color: colorScheme.onSurfaceVariant, fontSize: 12),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                if (items.isEmpty)
                  Padding(
                    padding: const EdgeInsets.only(left: 18, bottom: 2),
                    child: Text(
                      isHovered ? '放開以移入此優先度' : '此優先度目前沒有專案',
                      style: TextStyle(
                        color: isHovered
                            ? pColor.withValues(alpha: 0.8)
                            : colorScheme.onSurface.withValues(alpha: 0.35),
                        fontSize: 12,
                      ),
                    ),
                  )
                else
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: items
                        .map((e) => _buildDraggableCard(context, e.product, e.areaName))
                        .toList(),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildDraggableCard(
    BuildContext context,
    Product product,
    String areaName,
  ) {
    final cardWidth =
        (MediaQuery.of(context).size.width - 16 * 2 - 16 * 2 - 10) / 2;

    return LongPressDraggable<Product>(
      data: product,
      delay: const Duration(milliseconds: 300),
      onDragStarted: () => setState(() {}),
      onDragEnd: (_) => setState(() {}),
      onDraggableCanceled: (velocity, offset) => setState(() {}),
      feedback: Material(
        color: Colors.transparent,
        child: Opacity(
          opacity: 0.85,
          child: SizedBox(
            width: cardWidth,
            child: _buildCardContent(context, product, areaName, isDragging: true),
          ),
        ),
      ),
      childWhenDragging: SizedBox(
        width: cardWidth,
        child: Opacity(
          opacity: 0.3,
          child: _buildCardContent(context, product, areaName),
        ),
      ),
      child: SizedBox(
        width: cardWidth,
        child: _buildCardContent(context, product, areaName),
      ),
    );
  }

  Widget _buildCardContent(
    BuildContext context,
    Product product,
    String areaName, {
    bool isDragging = false,
  }) {
    final colorScheme = Theme.of(context).colorScheme;
    final tasks = product.tasks ?? [];
    final activeTasks = tasks.where((t) => t.status != TaskStatus.archive).length;
    final totalTasks = tasks.length;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainer.withValues(alpha: isDragging ? 0.9 : 0.6),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDragging
              ? product.priority.color.withValues(alpha: 0.6)
              : colorScheme.outlineVariant.withValues(alpha: 0.5),
        ),
        boxShadow: isDragging
            ? [
                BoxShadow(
                  color: product.priority.color.withValues(alpha: 0.3),
                  blurRadius: 12,
                  spreadRadius: 2,
                ),
              ]
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            product.name,
            style: TextStyle(
              color: colorScheme.onSurface,
              fontSize: 13,
              fontWeight: FontWeight.w600,
              height: 1.3,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 4),
          Text(
            areaName,
            style: TextStyle(color: colorScheme.onSurfaceVariant, fontSize: 11),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 6),
          Text(
            '活躍 $activeTasks / $totalTasks',
            style: TextStyle(
              color: colorScheme.onSurfaceVariant.withValues(alpha: 0.8),
              fontSize: 11,
            ),
          ),
          const SizedBox(height: 8),
          ProductPriorityBadge(
            priority: product.priority,
            onChanged: (p) => _handlePriorityChange(context, product, p),
          ),
        ],
      ),
    );
  }

  Future<void> _handlePriorityChange(
    BuildContext context,
    Product product,
    ProductPriority priority,
  ) async {
    final useCase = ref.read(updateProductUseCaseProvider);
    final result = await useCase(UpdateProductParams(
      productId: product.id,
      priority: priority,
    ));
    result.fold(
      (failure) {
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('優先度更新失敗，請稍後再試')),
        );
      },
      (_) => ref.invalidate(dashboardProvider),
    );
  }
}
