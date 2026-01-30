import 'package:equatable/equatable.dart';

/// Product 實體
class Product extends Equatable {
  final String id;
  final String name;
  final String description;
  final ProductStatus status;
  final ProductLifecycle lifecycle;
  final String areaId;
  final int displayOrder;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const Product({
    required this.id,
    required this.name,
    required this.description,
    required this.status,
    required this.lifecycle,
    required this.areaId,
    required this.displayOrder,
    this.createdAt,
    this.updatedAt,
  });

  @override
  List<Object?> get props => [id, name, areaId];
}

/// Product 狀態
enum ProductStatus { inbox, active, maintain, reference, archive }

/// Product 生命週期
enum ProductLifecycle {
  finite, // 有終點的專案
  perpetual, // 永續維護
}
