import 'package:equatable/equatable.dart';

class TopicOperation extends Equatable {
  final String action; // "keep", "rename", "merge"
  final String? topicName; // for keep
  final String? oldName; // for rename
  final String? newName; // for rename
  final List<String>? sourceNames; // for merge
  final String? targetName; // for merge
  final String? reasoning; // for rename/merge

  const TopicOperation({
    required this.action,
    this.topicName,
    this.oldName,
    this.newName,
    this.sourceNames,
    this.targetName,
    this.reasoning,
  });

  factory TopicOperation.fromJson(Map<String, dynamic> json) {
    return TopicOperation(
      action: json['action'] ?? '',
      topicName: json['topic_name'],
      oldName: json['old_name'],
      newName: json['new_name'],
      sourceNames: json['source_names'] != null
          ? List<String>.from(json['source_names'])
          : null,
      targetName: json['target_name'],
      reasoning: json['reasoning'],
    );
  }

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{'action': action};
    if (topicName != null) map['topic_name'] = topicName;
    if (oldName != null) map['old_name'] = oldName;
    if (newName != null) map['new_name'] = newName;
    if (sourceNames != null) map['source_names'] = sourceNames;
    if (targetName != null) map['target_name'] = targetName;
    if (reasoning != null) map['reasoning'] = reasoning;
    return map;
  }

  @override
  List<Object?> get props => [action, topicName, oldName, newName, sourceNames, targetName, reasoning];
}

class ReorganizeProposal extends Equatable {
  final String productId;
  final String productName;
  final List<String> currentTopics;
  final int? currentTopicCount;
  final List<TopicOperation> topicOperations;
  final List<TopicCluster> proposedClusters;
  final List<TaskConsolidation> taskConsolidations;
  final List<TaskContext> tasksContext;
  final String? logId;
  final String reasoning;
  final List<TimeInference> timeInferences;
  final bool? applyTopicOperations;
  final bool? applyTaskConsolidations;

  const ReorganizeProposal({
    required this.productId,
    required this.productName,
    required this.currentTopics,
    this.currentTopicCount,
    this.topicOperations = const [],
    required this.proposedClusters,
    required this.taskConsolidations,
    required this.tasksContext,
    this.logId,
    this.reasoning = '',
    this.timeInferences = const [],
    this.applyTopicOperations,
    this.applyTaskConsolidations,
  });

  factory ReorganizeProposal.fromJson(Map<String, dynamic> json) {
    return ReorganizeProposal(
      productId: json['product_id'] ?? '',
      productName: json['product_name'] ?? '',
      currentTopics: List<String>.from(json['current_topics'] ?? []),
      currentTopicCount: json['current_topic_count'],
      topicOperations:
          (json['topic_operations'] as List<dynamic>?)
              ?.map((e) => TopicOperation.fromJson(e))
              .toList() ??
          [],
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
      applyTopicOperations: json['apply_topic_operations'],
      applyTaskConsolidations: json['apply_task_consolidations'],
    );
  }

  Map<String, dynamic> toJson() {
    final map = {
      'product_id': productId,
      'product_name': productName,
      'current_topics': currentTopics,
      'current_topic_count': currentTopicCount,
      'topic_operations': topicOperations.map((e) => e.toJson()).toList(),
      'proposed_clusters': proposedClusters.map((e) => e.toJson()).toList(),
      'task_consolidations': taskConsolidations.map((e) => e.toJson()).toList(),
      'tasks_context': tasksContext.map((e) => e.toJson()).toList(),
      'logId': logId,
      'reasoning': reasoning,
      'time_inferences': timeInferences.map((e) => e.toJson()).toList(),
    };
    if (applyTopicOperations != null) map['apply_topic_operations'] = applyTopicOperations;
    if (applyTaskConsolidations != null) map['apply_task_consolidations'] = applyTaskConsolidations;
    return map;
  }

  ReorganizeProposal copyWith({
    bool? applyTopicOperations,
    bool? applyTaskConsolidations,
  }) {
    return ReorganizeProposal(
      productId: productId,
      productName: productName,
      currentTopics: currentTopics,
      currentTopicCount: currentTopicCount,
      topicOperations: topicOperations,
      proposedClusters: proposedClusters,
      taskConsolidations: taskConsolidations,
      tasksContext: tasksContext,
      logId: logId,
      reasoning: reasoning,
      timeInferences: timeInferences,
      applyTopicOperations: applyTopicOperations ?? this.applyTopicOperations,
      applyTaskConsolidations: applyTaskConsolidations ?? this.applyTaskConsolidations,
    );
  }

  @override
  List<Object?> get props => [
    productId,
    productName,
    currentTopics,
    currentTopicCount,
    topicOperations,
    proposedClusters,
    taskConsolidations,
    tasksContext,
    logId,
    reasoning,
    timeInferences,
    applyTopicOperations,
    applyTaskConsolidations,
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
