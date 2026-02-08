import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';

import '../../core/utils/date_utils.dart' as utils;

/// Task 實體 (Domain Layer)
class Task extends Equatable {
  final String id;
  final String content;
  final TaskStatus status;
  final DateTime? dueDate;
  final DateTime? startDate; // Added start date for logic
  final double? timeConfidence;
  final String? productId;
  final String? topicId;
  final List<SubItem>? subItems;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final DateTime? deletedAt;

  // Context fields (Display only)
  final String? areaName;
  final String? productName;
  final String? topicName;

  // Custom tags (User-defined labels)
  final List<String>? tags;

  // Reminder fields (Task notification)
  final DateTime? remindAt;         // 提醒時間（本地時區）
  final bool reminderEnabled;        // 提醒開關
  final String? reminderTimezone;    // IANA 時區（如 "Asia/Taipei"）
  final int? notificationId;         // 本地通知 ID

  const Task({
    required this.id,
    required this.content,
    required this.status,
    this.dueDate,
    this.startDate,
    this.timeConfidence,
    this.productId,
    this.topicId,
    this.subItems,
    this.createdAt,
    this.updatedAt,
    this.deletedAt,
    this.areaName,
    this.productName,
    this.topicName,
    this.tags,
    this.remindAt,
    this.reminderEnabled = false,
    this.reminderTimezone,
    this.notificationId,
  });

  /// 是否逾期 (截止日 < 今天)
  bool get isOverdue {
    if (dueDate == null) return false;
    if (status == TaskStatus.archive) return false;

    return utils.DateUtils.isOverdue(dueDate!);
  }

  /// 是否今日任務 (截止日 == 今天)
  bool get isToday {
    if (dueDate == null) return false;
    return utils.DateUtils.isToday(dueDate!);
  }

  /// 是否已開始 (In Progress / Workload)
  bool get isStarted {
    if (startDate == null) return false;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);

    final start = startDate!.toLocal();
    final startDateOnly = DateTime(start.year, start.month, start.day);

    // If start date is today or before today
    return startDateOnly.isBefore(today) ||
        startDateOnly.isAtSameMomentAs(today);
  }

  @override
  List<Object?> get props => [
    id,
    content,
    status,
    dueDate,
    startDate,
    productId,
    topicId,
    tags,
    remindAt,
    reminderEnabled,
    reminderTimezone,
    notificationId,
  ];

  Task copyWith({
    String? content,
    TaskStatus? status,
    DateTime? dueDate,
    DateTime? startDate,
    double? timeConfidence,
    String? productId,
    String? topicId,
    List<SubItem>? subItems,
    String? areaName,
    String? productName,
    String? topicName,
    List<String>? tags,
    DateTime? remindAt,
    bool? reminderEnabled,
    String? reminderTimezone,
    int? notificationId,
  }) {
    return Task(
      id: this.id,
      content: content ?? this.content,
      status: status ?? this.status,
      dueDate: dueDate ?? this.dueDate,
      startDate: startDate ?? this.startDate,
      timeConfidence: timeConfidence ?? this.timeConfidence,
      productId: productId ?? this.productId,
      topicId: topicId ?? this.topicId,
      subItems: subItems ?? this.subItems,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deletedAt: this.deletedAt,
      areaName: areaName ?? this.areaName,
      productName: productName ?? this.productName,
      topicName: topicName ?? this.topicName,
      tags: tags ?? this.tags,
      remindAt: remindAt ?? this.remindAt,
      reminderEnabled: reminderEnabled ?? this.reminderEnabled,
      reminderTimezone: reminderTimezone ?? this.reminderTimezone,
      notificationId: notificationId ?? this.notificationId,
    );
  }
}

/// Sub-item 實體
class SubItem extends Equatable {
  final String id;
  final String content;
  final bool completed;
  final DateTime? completedAt;

  const SubItem({
    required this.id,
    required this.content,
    required this.completed,
    this.completedAt,
  });

  @override
  List<Object?> get props => [id, content, completed];

  SubItem copyWith({
    String? id,
    String? content,
    bool? completed,
    DateTime? completedAt,
  }) {
    return SubItem(
      id: id ?? this.id,
      content: content ?? this.content,
      completed: completed ?? this.completed,
      completedAt: completedAt ?? this.completedAt,
    );
  }
}

/// Task 狀態枚舉
enum TaskStatus { inbox, active, maintain, reference, archive }

/// Task 狀態顯示擴展
extension TaskStatusDisplay on TaskStatus {
  String get displayName => switch (this) {
    TaskStatus.inbox => '規劃中',
    TaskStatus.active => '進行中',
    TaskStatus.maintain => '維護中',
    TaskStatus.reference => '參考資料',
    TaskStatus.archive => '已歸檔',
  };

  Color get color => switch (this) {
    TaskStatus.inbox => const Color(0xFFF59E0B),
    TaskStatus.active => const Color(0xFF3B82F6),
    TaskStatus.maintain => const Color(0xFF8B5CF6),
    TaskStatus.reference => const Color(0xFF22C55E),
    TaskStatus.archive => const Color(0xFF64748B),
  };

  IconData get icon => switch (this) {
    TaskStatus.inbox => Icons.assignment_outlined,
    TaskStatus.active => Icons.rocket_launch_outlined,
    TaskStatus.maintain => Icons.sync_outlined,
    TaskStatus.reference => Icons.menu_book_outlined,
    TaskStatus.archive => Icons.archive_outlined,
  };
}
