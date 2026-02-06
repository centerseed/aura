import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// 首次使用引導狀態管理

// 是否已完成首次引導
final hasCompletedTutorialProvider = FutureProvider<bool>((ref) async {
  final prefs = await SharedPreferences.getInstance();
  return prefs.getBool('has_completed_tutorial') ?? false;
});

// 目前引導步驟 (0 = 未開始, 1-4 = 步驟)
final tutorialStepProvider = StateProvider<int>((ref) => 0);

// 是否顯示引導
final showTutorialProvider = StateProvider<bool>((ref) => false);

/// 標記引導為已完成
Future<void> markTutorialCompleted() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setBool('has_completed_tutorial', true);
}

/// 重置引導狀態 (for testing)
Future<void> resetTutorial() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setBool('has_completed_tutorial', false);
}

/// 引導步驟定義
enum TutorialStep {
  welcome, // 0: 歡迎訊息
  addTask, // 1: 引導點擊 + 按鈕
  overview, // 2: 引導到負載頁面
  milestone, // 3: 說明里程碑編輯
  complete, // 4: 完成
}

extension TutorialStepExtension on TutorialStep {
  int get index {
    switch (this) {
      case TutorialStep.welcome:
        return 0;
      case TutorialStep.addTask:
        return 1;
      case TutorialStep.overview:
        return 2;
      case TutorialStep.milestone:
        return 3;
      case TutorialStep.complete:
        return 4;
    }
  }

  String get title {
    switch (this) {
      case TutorialStep.welcome:
        return '歡迎來到 Zentropy!';
      case TutorialStep.addTask:
        return '記錄第一個想法';
      case TutorialStep.overview:
        return '查看你的專案';
      case TutorialStep.milestone:
        return '設定里程碑';
      case TutorialStep.complete:
        return '準備就緒!';
    }
  }

  String get message {
    switch (this) {
      case TutorialStep.welcome:
        return '讓我們開始記錄第一個想法';
      case TutorialStep.addTask:
        return '點擊這裡,隨時記錄你的想法和任務\nAI 會自動幫你分類到對應的身份和專案';
      case TutorialStep.overview:
        return '切換到這裡查看你的專案和身份地圖';
      case TutorialStep.milestone:
        return '點擊專案卡片可以設定里程碑\n設定里程碑後,AI 會自動依據里程碑安排任務到期日';
      case TutorialStep.complete:
        return '就是這麼簡單!開始使用 Zentropy 吧!';
    }
  }
}
