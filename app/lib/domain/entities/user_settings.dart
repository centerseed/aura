import 'package:equatable/equatable.dart';

/// 用戶設定實體
class UserSettings extends Equatable {
  final NotificationSettings notifications;
  final String theme;
  final String locale;

  const UserSettings({
    required this.notifications,
    this.theme = 'dark',
    this.locale = 'zh_TW',
  });

  factory UserSettings.fromJson(Map<String, dynamic> json) {
    return UserSettings(
      notifications: json['notifications'] != null
          ? NotificationSettings.fromJson(json['notifications'])
          : const NotificationSettings(),
      theme: json['theme'] ?? 'dark',
      locale: json['locale'] ?? 'zh_TW',
    );
  }

  Map<String, dynamic> toJson() => {
        'notifications': notifications.toJson(),
        'theme': theme,
        'locale': locale,
      };

  UserSettings copyWith({
    NotificationSettings? notifications,
    String? theme,
    String? locale,
  }) {
    return UserSettings(
      notifications: notifications ?? this.notifications,
      theme: theme ?? this.theme,
      locale: locale ?? this.locale,
    );
  }

  @override
  List<Object?> get props => [notifications, theme, locale];
}

/// 通知設定
class NotificationSettings extends Equatable {
  final bool morningReport;
  final bool eveningReport;
  final bool taskDueReminder;

  const NotificationSettings({
    this.morningReport = true,
    this.eveningReport = true,
    this.taskDueReminder = true,
  });

  factory NotificationSettings.fromJson(Map<String, dynamic> json) {
    return NotificationSettings(
      morningReport: json['morningReport'] ?? true,
      eveningReport: json['eveningReport'] ?? true,
      taskDueReminder: json['taskDueReminder'] ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'morningReport': morningReport,
        'eveningReport': eveningReport,
        'taskDueReminder': taskDueReminder,
      };

  NotificationSettings copyWith({
    bool? morningReport,
    bool? eveningReport,
    bool? taskDueReminder,
  }) {
    return NotificationSettings(
      morningReport: morningReport ?? this.morningReport,
      eveningReport: eveningReport ?? this.eveningReport,
      taskDueReminder: taskDueReminder ?? this.taskDueReminder,
    );
  }

  @override
  List<Object?> get props => [morningReport, eveningReport, taskDueReminder];
}
