import 'package:equatable/equatable.dart';

/// Brain Dump 結果類型
enum BrainDumpAction { createNewTasks, appendSubItem }

class BrainDumpResult extends Equatable {
  final bool success;
  final BrainDumpAction action;
  final List<BrainDumpResultItem> items;

  // append_sub_item 專用欄位
  final AppendSubItemInfo? appendInfo;

  const BrainDumpResult({
    required this.success,
    this.action = BrainDumpAction.createNewTasks,
    required this.items,
    this.appendInfo,
  });

  /// 是否為追加 sub-item 操作
  bool get isAppendSubItem => action == BrainDumpAction.appendSubItem;

  @override
  List<Object?> get props => [success, action, items, appendInfo];
}

/// 追加 sub-item 的資訊
class AppendSubItemInfo extends Equatable {
  final String targetTaskId;
  final String targetTaskContent;
  final String targetProductName;
  final List<String> appendedItems;
  final String reasoning;

  const AppendSubItemInfo({
    required this.targetTaskId,
    required this.targetTaskContent,
    required this.targetProductName,
    required this.appendedItems,
    required this.reasoning,
  });

  @override
  List<Object?> get props => [
    targetTaskId,
    targetTaskContent,
    targetProductName,
    appendedItems,
    reasoning,
  ];
}

class BrainDumpResultItem extends Equatable {
  final String id;
  final String title;
  final String narrative;
  final String drawer;
  final String areaName;
  final String productName;
  final String? topicName;
  final String? strategyUsed;
  final String? reasoning;
  final DateTime? dueDate;
  final double? timeConfidence;
  final String? timeReasoning;

  const BrainDumpResultItem({
    required this.id,
    required this.title,
    required this.narrative,
    required this.drawer,
    required this.areaName,
    required this.productName,
    this.topicName,
    this.strategyUsed,
    this.reasoning,
    this.dueDate,
    this.timeConfidence,
    this.timeReasoning,
  });

  @override
  List<Object?> get props => [
    id,
    title,
    narrative,
    drawer,
    areaName,
    productName,
    topicName,
    strategyUsed,
    reasoning,
    dueDate,
    timeConfidence,
    timeReasoning,
  ];
}
