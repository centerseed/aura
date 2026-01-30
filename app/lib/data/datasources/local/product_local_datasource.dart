import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';

import '../../../core/cache/cache_config.dart';
import '../../../domain/entities/product.dart';
import '../../models/product_model.dart';

/// Product 本地數據源介面
abstract class ProductLocalDataSource {
  /// 從快取讀取所有 Products
  Future<List<Product>> getCachedProducts();

  /// 儲存 Products 到快取
  Future<void> cacheProducts(List<ProductModel> products);

  /// 取得上次同步時間
  DateTime? getLastSyncTime();

  /// 更新同步時間
  Future<void> updateSyncTime();

  /// 清除快取
  Future<void> clearCache();

  /// 快取是否過期
  bool isCacheStale(Duration ttl);
}

/// Hive 實作
class ProductLocalDataSourceImpl implements ProductLocalDataSource {
  final Box<Map> _productsBox;

  ProductLocalDataSourceImpl(this._productsBox);

  @override
  Future<List<Product>> getCachedProducts() async {
    final List<Product> products = [];

    for (final key in _productsBox.keys) {
      if (key == CacheConfig.lastSyncKey) continue;

      final data = _productsBox.get(key);
      if (data != null) {
        try {
          final model = ProductModel.fromJson(Map<String, dynamic>.from(data));
          products.add(model.toEntity());
        } catch (e) {
          debugPrint('Failed to parse cached product: $e');
        }
      }
    }

    return products;
  }

  @override
  Future<void> cacheProducts(List<ProductModel> products) async {
    final keysToDelete =
        _productsBox.keys.where((k) => k != CacheConfig.lastSyncKey).toList();
    await _productsBox.deleteAll(keysToDelete);

    for (final product in products) {
      await _productsBox.put(product.id, product.toJson());
    }

    await updateSyncTime();
  }

  @override
  DateTime? getLastSyncTime() {
    final timestamp = _productsBox.get(CacheConfig.lastSyncKey)?['timestamp'];
    if (timestamp is int) {
      return DateTime.fromMillisecondsSinceEpoch(timestamp);
    }
    return null;
  }

  @override
  Future<void> updateSyncTime() async {
    await _productsBox.put(CacheConfig.lastSyncKey, {
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    });
  }

  @override
  Future<void> clearCache() async {
    await _productsBox.clear();
  }

  @override
  bool isCacheStale(Duration ttl) {
    final lastSync = getLastSyncTime();
    if (lastSync == null) return true;
    return DateTime.now().difference(lastSync) > ttl;
  }
}
