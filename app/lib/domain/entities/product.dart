import 'package:equatable/equatable.dart';
import 'reference.dart';
import 'task.dart';

/// Product 實體
class Product extends Equatable {
  final String id;
  final String name;
  final String description;
  final ProductStatus status;
  final ProductLifecycle lifecycle;
  final ProductPriority priority;
  final String areaId;
  final int displayOrder;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  // 關聯資料
  final List<Reference>? references;
  final int? totalReferenceCount; // product + task 層級的總數
  final List<Task>? tasks; // 完整的 tasks 列表
  final List<Task>? recentTasks; // 最近的 3 個 tasks (向後兼容)

  const Product({
    required this.id,
    required this.name,
    required this.description,
    required this.status,
    required this.lifecycle,
    this.priority = ProductPriority.p1,
    required this.areaId,
    required this.displayOrder,
    this.createdAt,
    this.updatedAt,
    this.references,
    this.totalReferenceCount,
    this.tasks,
    this.recentTasks,
  });

  @override
  List<Object?> get props => [id, name, areaId];

  /// 獲取 reference 數量（優先使用 API 提供的總數，回退到本地計算）
  int get referenceCount => totalReferenceCount ?? references?.length ?? 0;

  /// 獲取任務數量（優先使用完整的 tasks,回退到 recentTasks）
  int get taskCount => tasks?.length ?? recentTasks?.length ?? 0;
}

/// Product 狀態
enum ProductStatus { inbox, active, maintain, reference, archive }

/// Product 生命週期
enum ProductLifecycle {
  finite, // 有終點的專案
  perpetual, // 永續維護
}

/// Product 優先度
enum ProductPriority {
  p0, // 最高優先，本週必推進
  p1, // 重要，本月目標
  p2, // 一般，有空再做
  p3, // 低優先，長期擱置
}

/// 從 API 字串解析 Priority（domain layer utility）
ProductPriority parsePriority(String? value) {
  switch (value?.toUpperCase()) {
    case 'P0': return ProductPriority.p0;
    case 'P1': return ProductPriority.p1;
    case 'P2': return ProductPriority.p2;
    case 'P3': return ProductPriority.p3;
    default: return ProductPriority.p1;
  }
}
