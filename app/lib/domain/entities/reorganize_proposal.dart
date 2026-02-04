import 'package:equatable/equatable.dart';

class ReorganizeProposal extends Equatable {
  final String productId;
  final String productName;
  final List<String> currentTopics;
  final int? currentTopicCount;
  final List<TopicCluster> proposedClusters;
  final List<TaskConsolidation> taskConsolidations;
  final List<TaskContext> tasksContext;
  final String? logId;
  final String reasoning;
  final List<TimeInference> timeInferences;

  const ReorganizeProposal({
    required this.productId,
    required this.productName,
    required this.currentTopics,
    this.currentTopicCount,
    required this.proposedClusters,
    required this.taskConsolidations,
    required this.tasksContext,
    this.logId,
    this.reasoning = '',
    this.timeInferences = const [],
  });

  factory ReorganizeProposal.fromJson(Map<String, dynamic> json) {
    return ReorganizeProposal(
      productId: json['product_id'] ?? '',
      productName: json['product_name'] ?? '',
      currentTopics: List<String>.from(json['current_topics'] ?? []),
      currentTopicCount: json['current_topic_count'],
      proposedClusters:
          (json['proposed_clusters'] as List<dynamic>?)
              ?.map((e) => TopicCluster.fromJson(e))
              .toList() ??
          [],
      taskConsolidations:
          (json['task_consolidations'] as List<dynamic>?)
              ?.map((e) => TaskConsolidation.fromJson(e))
              .toList() ??
          [],
      tasksContext:
          (json['tasks_context'] as List<dynamic>?)
              ?.map((e) => TaskContext.fromJson(e))
              .toList() ??
          [],
      logId: json['logId'],
      reasoning: json['reasoning'] ?? '',
      timeInferences:
          (json['time_inferences'] as List<dynamic>?)
              ?.map((e) => TimeInference.fromJson(e))
              .toList() ??
          [],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'product_id': productId,
      'product_name': productName,
      'current_topics': currentTopics,
      'current_topic_count': currentTopicCount,
      'proposed_clusters': proposedClusters.map((e) => e.toJson()).toList(),
      'task_consolidations': taskConsolidations.map((e) => e.toJson()).toList(),
      'tasks_context': tasksContext.map((e) => e.toJson()).toList(),
      'logId': logId,
      'reasoning': reasoning,
      'time_inferences': timeInferences.map((e) => e.toJson()).toList(),
    };
  }

  @override
  List<Object?> get props => [
    productId,
    productName,
    currentTopics,
    currentTopicCount,
    proposedClusters,
    taskConsolidations,
    tasksContext,
    logId,
    reasoning,
    timeInferences,
  ];
}

class TopicCluster extends Equatable {
  final String topicName;
  final List<String> taskIds;
  final String? description;
  final double confidence;

  const TopicCluster({
    required this.topicName,
    required this.taskIds,
    this.description,
    this.confidence = 0.0,
  });

  factory TopicCluster.fromJson(Map<String, dynamic> json) {
    return TopicCluster(
      topicName: json['topic_name'] ?? '',
      taskIds: List<String>.from(json['task_ids'] ?? []),
      description: json['description'],
      confidence: (json['confidence'] ?? 0.0).toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'topic_name': topicName,
      'task_ids': taskIds,
      'description': description,
      'confidence': confidence,
    };
  }

  @override
  List<Object?> get props => [topicName, taskIds, description, confidence];
}

class TaskConsolidation extends Equatable {
  final String parentTaskId;
  final List<String> subTaskIds;
  final String consolidatedTitle;
  final String reasoning;
  final String consolidatedNarrative;
  final double confidence;

  const TaskConsolidation({
    required this.parentTaskId,
    required this.subTaskIds,
    required this.consolidatedTitle,
    required this.reasoning,
    this.consolidatedNarrative = '',
    this.confidence = 0.0,
  });

  factory TaskConsolidation.fromJson(Map<String, dynamic> json) {
    return TaskConsolidation(
      parentTaskId: json['parent_task_id'] ?? '',
      subTaskIds: List<String>.from(json['sub_task_ids'] ?? []),
      consolidatedTitle: json['consolidated_title'] ?? '',
      reasoning: json['reasoning'] ?? '',
      consolidatedNarrative: json['consolidated_narrative'] ?? '',
      confidence: (json['confidence'] ?? 0.0).toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'parent_task_id': parentTaskId,
      'sub_task_ids': subTaskIds,
      'consolidated_title': consolidatedTitle,
      'reasoning': reasoning,
      'consolidated_narrative': consolidatedNarrative,
      'confidence': confidence,
    };
  }

  @override
  List<Object?> get props => [
    parentTaskId,
    subTaskIds,
    consolidatedTitle,
    reasoning,
    consolidatedNarrative,
    confidence,
  ];
}

class TaskContext extends Equatable {
  final String id;
  final String title;
  final String currentTopic;
  final String? currentDueDate;
  final String? cRole; // 'p' = parent, 's' = sub

  const TaskContext({
    required this.id,
    required this.title,
    required this.currentTopic,
    this.currentDueDate,
    this.cRole,
  });

  factory TaskContext.fromJson(Map<String, dynamic> json) {
    return TaskContext(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      currentTopic: json['current_topic'] ?? '未分類',
      currentDueDate: json['current_due_date'],
      cRole: json['c_role'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'current_topic': currentTopic,
      'current_due_date': currentDueDate,
      'c_role': cRole,
    };
  }

  @override
  List<Object?> get props => [id, title, currentTopic, currentDueDate, cRole];
}

class TimeInference extends Equatable {
  final String taskId;
  final String? suggestedDueDate;
  final String reasoning;
  final double confidence;
  final String urgencyLevel;

  const TimeInference({
    required this.taskId,
    this.suggestedDueDate,
    required this.reasoning,
    this.confidence = 0.0,
    this.urgencyLevel = 'normal',
  });

  factory TimeInference.fromJson(Map<String, dynamic> json) {
    return TimeInference(
      taskId: json['task_id'] ?? '',
      suggestedDueDate: json['suggested_due_date'],
      reasoning: json['reasoning'] ?? '',
      confidence: (json['confidence'] ?? 0.0).toDouble(),
      urgencyLevel: json['urgency_level'] ?? 'normal',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'task_id': taskId,
      'suggested_due_date': suggestedDueDate,
      'reasoning': reasoning,
      'confidence': confidence,
      'urgency_level': urgencyLevel,
    };
  }

  @override
  List<Object?> get props => [taskId, suggestedDueDate, reasoning, confidence, urgencyLevel];
}
