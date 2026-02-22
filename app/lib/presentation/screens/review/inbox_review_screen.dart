import 'package:flutter/material.dart';
import 'package:app/core/theme/app_colors.dart';
import 'package:flutter_dual_cache/flutter_dual_cache.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/di/providers.dart';
import '../../../data/repositories/unified/unified_repositories.dart';
import '../../../domain/entities/area.dart';
import '../../../domain/entities/product.dart';
import '../../../domain/entities/task.dart';
import '../project/project_detail_screen.dart';

class InboxReviewScreen extends ConsumerStatefulWidget {
  const InboxReviewScreen({super.key});

  @override
  ConsumerState<InboxReviewScreen> createState() => _InboxReviewScreenState();
}

class _InboxReviewScreenState extends ConsumerState<InboxReviewScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 20),
            Expanded(child: _buildStructureView()),
          ],
        ),
      ),
    );
  }

  Widget _buildStructureView() {
    final areasAsync = ref.watch(cachedAreasStreamProvider);
    final productsAsync = ref.watch(cachedProductsStreamProvider);
    final tasksAsync = ref.watch(cachedTasksStreamProvider);

    return RefreshIndicator(
      onRefresh: () async {
        await Future.wait([
          (ref.read(taskRepositoryProvider) as TaskUnifiedRepository).refresh(),
          (ref.read(areaRepositoryProvider) as AreaUnifiedRepository).refresh(),
          (ref.read(productRepositoryProvider) as ProductUnifiedRepository)
              .refresh(),
        ]);
      },
      child: _buildContentFromAsync(areasAsync, productsAsync, tasksAsync),
    );
  }

  Widget _buildContentFromAsync(
    AsyncValue<CacheState<List<Area>>> areasAsync,
    AsyncValue<CacheState<List<Product>>> productsAsync,
    AsyncValue<CacheState<List<Task>>> tasksAsync,
  ) {
    // Extract cache states (handle AsyncValue)
    final areasState = areasAsync.valueOrNull;
    final productsState = productsAsync.valueOrNull;
    final tasksState = tasksAsync.valueOrNull;

    // If all streams are not yet loaded
    if (areasState == null && productsState == null && tasksState == null) {
      return const Center(child: CircularProgressIndicator());
    }

    return _buildContent(
      areasState ?? const CacheState(),
      productsState ?? const CacheState(),
      tasksState ?? const CacheState(),
    );
  }

  Widget _buildContent(
    CacheState<List<Area>> areasState,
    CacheState<List<Product>> productsState,
    CacheState<List<Task>> tasksState,
  ) {
    // 顯示 Loading（只有在完全沒有資料時）
    if (!areasState.hasData && !productsState.hasData && !tasksState.hasData) {
      if (areasState.isLoading ||
          productsState.isLoading ||
          tasksState.isLoading) {
        return const Center(child: CircularProgressIndicator());
      }
    }

    // 顯示錯誤（只有在沒有資料且有錯誤時）
    final error =
        areasState.errorMessage ??
        productsState.errorMessage ??
        tasksState.errorMessage;
    if (!areasState.hasData && !productsState.hasData && error != null) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: 200),
          Center(
            child: Column(
              children: [
                Text(
                  '載入失敗: $error',
                  style: const TextStyle(color: Colors.red),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () {
                    (ref.read(taskRepositoryProvider) as TaskUnifiedRepository)
                        .refresh();
                    (ref.read(areaRepositoryProvider) as AreaUnifiedRepository)
                        .refresh();
                    (ref.read(productRepositoryProvider)
                            as ProductUnifiedRepository)
                        .refresh();
                  },
                  child: const Text('重試'),
                ),
              ],
            ),
          ),
        ],
      );
    }

    // 優先顯示快取資料
    final areas = areasState.data ?? [];
    final products = productsState.data ?? [];
    final tasks = tasksState.data ?? [];

    if (areas.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: 200),
          Center(
            child: Text(
              "尚未建立身份地圖",
              style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.5)),
            ),
          ),
        ],
      );
    }

    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(top: 16, bottom: 100),
      itemCount: areas.length,
      separatorBuilder: (context, index) => const SizedBox(height: 32),
      itemBuilder: (context, index) {
        final area = areas[index];
        final areaProducts =
            products.where((p) => p.areaId == area.id).toList();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Area Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24.0),
              child: Row(
                children: [
                  Container(
                    width: 4,
                    height: 24,
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    area.name,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurface,
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '${areaProducts.length} 專案',
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurface.withOpacity(0.4),
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Project Horizontal List
            if (areaProducts.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24.0),
                child: Text(
                  "尚無專案",
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface.withOpacity(0.3),
                    fontSize: 14,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              )
            else
              SizedBox(
                height: 160,
                child: ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  scrollDirection: Axis.horizontal,
                  itemCount: areaProducts.length,
                  separatorBuilder: (context, index) =>
                      const SizedBox(width: 12),
                  itemBuilder: (context, pIndex) {
                    final product = areaProducts[pIndex];
                    final projectTasks =
                        tasks
                            .where((t) => t.productId == product.id)
                            .take(3)
                            .toList();

                    return _buildProductCard(context, product, projectTasks);
                  },
                ),
              ),
          ],
        );
      },
    );
  }

  Widget _buildProductCard(
    BuildContext context,
    Product product,
    List<Task> projectTasks,
  ) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      width: 260,
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colorScheme.onSurface.withOpacity(0.08)),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => ProjectDetailScreen(product: product),
              ),
            );
          },
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header
                Row(
                  children: [
                    Icon(
                      Icons.folder_open_rounded,
                      size: 18,
                      color: colorScheme.onSurface.withOpacity(0.5),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        product.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: colorScheme.onSurface,
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Task List
                if (projectTasks.isEmpty)
                  Expanded(
                    child: Center(
                      child: Text(
                        "暫無待辦",
                        style: TextStyle(
                          color: colorScheme.onSurface.withOpacity(0.3),
                          fontSize: 12,
                        ),
                      ),
                    ),
                  )
                else
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children:
                        projectTasks
                            .map(
                              (t) => Padding(
                                padding: const EdgeInsets.only(bottom: 6.0),
                                child: Row(
                                  children: [
                                    Container(
                                      width: 4,
                                      height: 4,
                                      decoration: BoxDecoration(
                                        color: colorScheme.onSurface.withOpacity(
                                          0.5,
                                        ),
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        t.content,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          color: colorScheme.onSurface.withOpacity(
                                            0.7,
                                          ),
                                          fontSize: 13,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            )
                            .toList(),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
