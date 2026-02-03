import 'package:equatable/equatable.dart';

/// Milestone 狀態
enum MilestoneStatus {
  planned,
  inProgress,
  completed,
  delayed,
  cancelled,
}

/// Milestone 關聯實體類型
enum MilestoneEntityType {
  area,
  product,
  topic,
}

/// Milestone 實體
class Milestone extends Equatable {
  final String id;
  final String name;
  final DateTime targetDate;
  final MilestoneStatus status;
  final MilestoneEntityType entityType;
  final String entityId;
  final int priority;
  final String? description;
  // 關聯資訊（顯示用）
  final String? productName;
  final String? areaName;
  final String? topicName;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const Milestone({
    required this.id,
    required this.name,
    required this.targetDate,
    required this.status,
    required this.entityType,
    required this.entityId,
    required this.priority,
    this.description,
    this.productName,
    this.areaName,
    this.topicName,
    this.createdAt,
    this.updatedAt,
  });

  @override
  List<Object?> get props => [
        id,
        name,
        targetDate,
        status,
        entityType,
        entityId,
        priority,
        description,
      ];

  /// 計算剩餘天數
  int get daysRemaining {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final target = DateTime(targetDate.year, targetDate.month, targetDate.day);
    return target.difference(today).inDays;
  }

  /// 是否緊急（7天內）
  bool get isUrgent => daysRemaining <= 7 && daysRemaining >= 0;

  /// 是否已逾期
  bool get isOverdue => daysRemaining < 0;

  /// 是否為活躍狀態（可顯示在列表中）
  bool get isActive =>
      status != MilestoneStatus.completed && status != MilestoneStatus.cancelled;

  /// 取得關聯實體名稱（根據 entityType）
  String? get relatedEntityName {
    switch (entityType) {
      case MilestoneEntityType.product:
        return productName;
      case MilestoneEntityType.area:
        return areaName;
      case MilestoneEntityType.topic:
        return topicName;
    }
  }

  /// copyWith
  Milestone copyWith({
    String? id,
    String? name,
    DateTime? targetDate,
    MilestoneStatus? status,
    MilestoneEntityType? entityType,
    String? entityId,
    int? priority,
    String? description,
    String? productName,
    String? areaName,
    String? topicName,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Milestone(
      id: id ?? this.id,
      name: name ?? this.name,
      targetDate: targetDate ?? this.targetDate,
      status: status ?? this.status,
      entityType: entityType ?? this.entityType,
      entityId: entityId ?? this.entityId,
      priority: priority ?? this.priority,
      description: description ?? this.description,
      productName: productName ?? this.productName,
      areaName: areaName ?? this.areaName,
      topicName: topicName ?? this.topicName,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

/// 狀態顯示文字
extension MilestoneStatusExtension on MilestoneStatus {
  String get displayName {
    switch (this) {
      case MilestoneStatus.planned:
        return '計畫中';
      case MilestoneStatus.inProgress:
        return '進行中';
      case MilestoneStatus.completed:
        return '已完成';
      case MilestoneStatus.delayed:
        return '延遲';
      case MilestoneStatus.cancelled:
        return '已取消';
    }
  }

  /// API 格式（snake_case）
  String get apiValue {
    switch (this) {
      case MilestoneStatus.planned:
        return 'planned';
      case MilestoneStatus.inProgress:
        return 'in_progress';
      case MilestoneStatus.completed:
        return 'completed';
      case MilestoneStatus.delayed:
        return 'delayed';
      case MilestoneStatus.cancelled:
        return 'cancelled';
    }
  }

  /// 從 API 字串解析
  static MilestoneStatus fromApiValue(String value) {
    switch (value) {
      case 'planned':
        return MilestoneStatus.planned;
      case 'in_progress':
        return MilestoneStatus.inProgress;
      case 'completed':
        return MilestoneStatus.completed;
      case 'delayed':
        return MilestoneStatus.delayed;
      case 'cancelled':
        return MilestoneStatus.cancelled;
      default:
        return MilestoneStatus.planned;
    }
  }
}

/// 實體類型擴展
extension MilestoneEntityTypeExtension on MilestoneEntityType {
  String get displayName {
    switch (this) {
      case MilestoneEntityType.area:
        return 'Area';
      case MilestoneEntityType.product:
        return 'Product';
      case MilestoneEntityType.topic:
        return 'Topic';
    }
  }

  /// API 格式（大寫）
  String get apiValue {
    switch (this) {
      case MilestoneEntityType.area:
        return 'AREA';
      case MilestoneEntityType.product:
        return 'PRODUCT';
      case MilestoneEntityType.topic:
        return 'TOPIC';
    }
  }

  /// 從 API 字串解析
  static MilestoneEntityType fromApiValue(String value) {
    switch (value.toUpperCase()) {
      case 'AREA':
        return MilestoneEntityType.area;
      case 'PRODUCT':
        return MilestoneEntityType.product;
      case 'TOPIC':
        return MilestoneEntityType.topic;
      default:
        return MilestoneEntityType.product;
    }
  }
}
