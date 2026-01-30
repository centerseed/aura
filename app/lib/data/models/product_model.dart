import 'package:freezed_annotation/freezed_annotation.dart';
import '../../domain/entities/product.dart';

part 'product_model.freezed.dart';
part 'product_model.g.dart';

@freezed
class ProductModel with _$ProductModel {
  const factory ProductModel({
    required String id,
    @JsonKey(name: 'user_id') required String userId,
    @JsonKey(name: 'area_id') required String areaId,
    required String name,
    String? description,
    required String status,
    required String lifecycle,
    @JsonKey(name: 'display_order', defaultValue: 0) required int displayOrder,
    @JsonKey(name: 'created_at') DateTime? createdAt,
    @JsonKey(name: 'updated_at') DateTime? updatedAt,
    @JsonKey(name: 'deleted_at') DateTime? deletedAt,
  }) = _ProductModel;

  factory ProductModel.fromJson(Map<String, dynamic> json) =>
      _$ProductModelFromJson(json);

  const ProductModel._();

  Product toEntity() => Product(
    id: id,
    name: name,
    description: description ?? '',
    status: _parseStatus(status),
    lifecycle: _parseLifecycle(lifecycle),
    areaId: areaId,
    displayOrder: displayOrder,
    createdAt: createdAt,
    updatedAt: updatedAt,
  );

  ProductStatus _parseStatus(String status) {
    switch (status.toUpperCase()) {
      case 'INBOX':
        return ProductStatus.inbox;
      case 'ACTIVE':
        return ProductStatus.active;
      case 'MAINTAIN':
        return ProductStatus.maintain;
      case 'REFERENCE':
        return ProductStatus.reference;
      case 'ARCHIVE':
        return ProductStatus.archive;
      default:
        return ProductStatus.active;
    }
  }

  ProductLifecycle _parseLifecycle(String lifecycle) {
    switch (lifecycle.toUpperCase()) {
      case 'FINITE':
        return ProductLifecycle.finite;
      case 'PERPETUAL':
        return ProductLifecycle.perpetual;
      default:
        return ProductLifecycle.finite;
    }
  }
}
