import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:flutter/foundation.dart';

/// Analytics 服務 - 封裝 Firebase Analytics
///
/// 自動追蹤的指標（無需額外程式碼）：
/// - DAU/WAU/MAU（每日/每週/每月活躍用戶）
/// - User Engagement（用戶參與時間）
/// - Session Duration（平均使用時長）
/// - Retention（用戶留存率）
class AnalyticsService {
  final FirebaseAnalytics _analytics;

  AnalyticsService({FirebaseAnalytics? analytics})
      : _analytics = analytics ?? FirebaseAnalytics.instance;

  /// 取得 FirebaseAnalyticsObserver 供 GoRouter 使用
  /// 自動追蹤畫面瀏覽
  FirebaseAnalyticsObserver get observer =>
      FirebaseAnalyticsObserver(analytics: _analytics);

  /// 設定用戶 ID（登入後呼叫）
  Future<void> setUserId(String? userId) async {
    await _analytics.setUserId(id: userId);
    debugPrint('[Analytics] User ID set: ${userId ?? 'null'}');
  }

  /// 設定用戶屬性
  Future<void> setUserProperty({
    required String name,
    required String? value,
  }) async {
    await _analytics.setUserProperty(name: name, value: value);
  }

  /// 記錄登入事件
  Future<void> logLogin({String? method}) async {
    await _analytics.logLogin(loginMethod: method);
    debugPrint('[Analytics] Login logged: $method');
  }

  /// 記錄登出事件
  Future<void> logLogout() async {
    await _analytics.logEvent(name: 'logout');
    await setUserId(null);
    debugPrint('[Analytics] Logout logged');
  }

  /// 記錄畫面瀏覽（手動呼叫，通常 observer 會自動處理）
  Future<void> logScreenView({
    required String screenName,
    String? screenClass,
  }) async {
    await _analytics.logScreenView(
      screenName: screenName,
      screenClass: screenClass,
    );
  }

  /// 記錄自訂事件
  Future<void> logEvent({
    required String name,
    Map<String, Object>? parameters,
  }) async {
    await _analytics.logEvent(name: name, parameters: parameters);
    debugPrint('[Analytics] Event logged: $name');
  }

  // ============ 業務相關事件 ============

  /// 記錄建立任務
  Future<void> logTaskCreated({String? projectId}) async {
    await logEvent(
      name: 'task_created',
      parameters: {
        if (projectId != null) 'project_id': projectId,
      },
    );
  }

  /// 記錄完成任務
  Future<void> logTaskCompleted({String? taskId}) async {
    await logEvent(
      name: 'task_completed',
      parameters: {
        if (taskId != null) 'task_id': taskId,
      },
    );
  }

  /// 記錄使用 Brain Dump
  Future<void> logBrainDumpUsed() async {
    await logEvent(name: 'brain_dump_used');
  }

  /// 記錄使用語音輸入
  Future<void> logVoiceInputUsed() async {
    await logEvent(name: 'voice_input_used');
  }
}
