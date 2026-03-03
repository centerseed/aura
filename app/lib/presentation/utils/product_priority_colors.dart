import 'package:flutter/material.dart';
import '../../domain/entities/product.dart';

/// ProductPriority 顏色擴展（Presentation 層）
extension ProductPriorityColor on ProductPriority {
  Color get color => switch (this) {
    ProductPriority.p0 => const Color(0xFFEA4335), // 橘紅
    ProductPriority.p1 => const Color(0xFF4285F4), // 藍
    ProductPriority.p2 => const Color(0xFF9E9E9E), // 灰藍
    ProductPriority.p3 => const Color(0xFFBDBDBD), // 灰
  };

  String get label => switch (this) {
    ProductPriority.p0 => 'P0',
    ProductPriority.p1 => 'P1',
    ProductPriority.p2 => 'P2',
    ProductPriority.p3 => 'P3',
  };

  String get description => switch (this) {
    ProductPriority.p0 => '最高優先，本週必推進',
    ProductPriority.p1 => '重要，本月目標',
    ProductPriority.p2 => '一般，有空再做',
    ProductPriority.p3 => '低優先，長期擱置',
  };
}
