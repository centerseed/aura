import 'package:equatable/equatable.dart';

class BrainDumpResult extends Equatable {
  final bool success;
  final List<BrainDumpResultItem> items;

  const BrainDumpResult({required this.success, required this.items});

  @override
  List<Object?> get props => [success, items];
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
