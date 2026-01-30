import 'package:equatable/equatable.dart';

class ReorganizeProposal extends Equatable {
  final String productId;
  final String productName;
  final List<String> currentTopics;
  final int? currentTopicCount;
  final List<TopicCluster> proposedClusters;
  final List<TaskTimeInference> timeInferences;
  final List<TaskConsolidation> taskConsolidations;
  final List<TaskContext> tasksContext;
  final String reasoning;
  final String? logId;

  const ReorganizeProposal({
    required this.productId,
    required this.productName,
    required this.currentTopics,
    this.currentTopicCount,
    required this.proposedClusters,
    required this.timeInferences,
    required this.taskConsolidations,
    required this.tasksContext,
    required this.reasoning,
    this.logId,
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
      timeInferences:
          (json['time_inferences'] as List<dynamic>?)
              ?.map((e) => TaskTimeInference.fromJson(e))
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
      reasoning: json['reasoning'] ?? '',
      logId: json['logId'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'product_id': productId,
      'product_name': productName,
      'current_topics': currentTopics,
      'current_topic_count': currentTopicCount,
      'proposed_clusters': proposedClusters.map((e) => e.toJson()).toList(),
      'time_inferences': timeInferences.map((e) => e.toJson()).toList(),
      'task_consolidations': taskConsolidations.map((e) => e.toJson()).toList(),
      'tasks_context': tasksContext.map((e) => e.toJson()).toList(),
      'reasoning': reasoning,
      'logId':
          logId, // Keep camelCase as per API response? Or snake_case? API returns 'logId'.
    };
  }

  @override
  List<Object?> get props => [
    productId,
    productName,
    currentTopics,
    currentTopicCount,
    proposedClusters,
    timeInferences,
    taskConsolidations,
    tasksContext,
    reasoning,
    logId,
  ];
}

class TopicCluster extends Equatable {
  final String topicName;
  final String? description;
  final List<String> taskIds;
  final double confidence;

  const TopicCluster({
    required this.topicName,
    this.description,
    required this.taskIds,
    this.confidence = 0.0,
  });

  factory TopicCluster.fromJson(Map<String, dynamic> json) {
    return TopicCluster(
      topicName: json['topic_name'] ?? '',
      description: json['description'],
      taskIds: List<String>.from(json['task_ids'] ?? []),
      confidence: (json['confidence'] ?? 0).toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'topic_name': topicName,
      'description': description,
      'task_ids': taskIds,
      'confidence': confidence,
    };
  }

  @override
  List<Object?> get props => [topicName, description, taskIds, confidence];
}

class TaskTimeInference extends Equatable {
  final String taskId;
  final String? suggestedDueDate;
  final String? inferredFromMilestoneId;
  final double timeConfidence;
  final String urgencyLevel;
  final String reasoning;

  const TaskTimeInference({
    required this.taskId,
    this.suggestedDueDate,
    this.inferredFromMilestoneId,
    required this.timeConfidence,
    required this.urgencyLevel,
    required this.reasoning,
  });

  factory TaskTimeInference.fromJson(Map<String, dynamic> json) {
    return TaskTimeInference(
      taskId: json['task_id'] ?? '',
      suggestedDueDate: json['suggested_due_date'],
      inferredFromMilestoneId: json['inferred_from_milestone_id'],
      timeConfidence: (json['time_confidence'] ?? 0).toDouble(),
      urgencyLevel: json['urgency_level'] ?? 'medium',
      reasoning: json['reasoning'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'task_id': taskId,
      'suggested_due_date': suggestedDueDate,
      'inferred_from_milestone_id': inferredFromMilestoneId,
      'time_confidence': timeConfidence,
      'urgency_level': urgencyLevel,
      'reasoning': reasoning,
    };
  }

  @override
  List<Object?> get props => [
    taskId,
    suggestedDueDate,
    inferredFromMilestoneId,
    timeConfidence,
    urgencyLevel,
    reasoning,
  ];
}

class TaskConsolidation extends Equatable {
  final String parentTaskId;
  final List<String> subTaskIds;
  final String consolidatedTitle;
  final String consolidatedNarrative;
  final String reasoning;
  final double confidence;

  const TaskConsolidation({
    required this.parentTaskId,
    required this.subTaskIds,
    required this.consolidatedTitle,
    required this.consolidatedNarrative,
    required this.reasoning,
    required this.confidence,
  });

  factory TaskConsolidation.fromJson(Map<String, dynamic> json) {
    return TaskConsolidation(
      parentTaskId: json['parent_task_id'] ?? '',
      subTaskIds: List<String>.from(json['sub_task_ids'] ?? []),
      consolidatedTitle: json['consolidated_title'] ?? '',
      consolidatedNarrative: json['consolidated_narrative'] ?? '',
      reasoning: json['reasoning'] ?? '',
      confidence: (json['confidence'] ?? 0).toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'parent_task_id': parentTaskId,
      'sub_task_ids': subTaskIds,
      'consolidated_title': consolidatedTitle,
      'consolidated_narrative': consolidatedNarrative,
      'reasoning': reasoning,
      'confidence': confidence,
    };
  }

  @override
  List<Object?> get props => [
    parentTaskId,
    subTaskIds,
    consolidatedTitle,
    consolidatedNarrative,
    reasoning,
    confidence,
  ];
}

class TaskContext extends Equatable {
  final String id;
  final String title;
  final String currentTopic;
  final String? currentDueDate;

  const TaskContext({
    required this.id,
    required this.title,
    required this.currentTopic,
    this.currentDueDate,
  });

  factory TaskContext.fromJson(Map<String, dynamic> json) {
    return TaskContext(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      currentTopic: json['current_topic'] ?? '未分類',
      currentDueDate: json['current_due_date'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'current_topic': currentTopic,
      'current_due_date': currentDueDate,
    };
  }

  @override
  List<Object?> get props => [id, title, currentTopic, currentDueDate];
}
