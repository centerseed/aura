import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../providers/first_time_tutorial_provider.dart';

/// 首次使用引導 Overlay
class TutorialOverlay extends ConsumerWidget {
  const TutorialOverlay({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final showTutorial = ref.watch(showTutorialProvider);
    final currentStep = ref.watch(tutorialStepProvider);

    if (!showTutorial || currentStep >= TutorialStep.complete.index) {
      return const SizedBox.shrink();
    }

    final step = TutorialStep.values[currentStep];

    return Stack(
      children: [
        // 半透明遮罩
        Positioned.fill(
          child: GestureDetector(
            onTap: () {
              // 防止點擊穿透
            },
            child: Container(
              color: Colors.black.withValues(alpha: 0.7),
            ),
          ),
        ),

        // 根據步驟顯示不同的高亮和提示
        _buildStepContent(context, ref, step),
      ],
    );
  }

  Widget _buildStepContent(
    BuildContext context,
    WidgetRef ref,
    TutorialStep step,
  ) {
    switch (step) {
      case TutorialStep.welcome:
        return _buildWelcomeStep(context, ref);
      case TutorialStep.addTask:
        return _buildAddTaskStep(context, ref);
      case TutorialStep.overview:
        return _buildOverviewStep(context, ref);
      case TutorialStep.milestone:
        return _buildMilestoneStep(context, ref);
      case TutorialStep.complete:
        return _buildCompleteStep(context, ref);
    }
  }

  /// 步驟 0: 歡迎訊息
  Widget _buildWelcomeStep(BuildContext context, WidgetRef ref) {
    return Center(
      child: _buildMessageCard(
        context,
        ref,
        title: TutorialStep.welcome.title,
        message: TutorialStep.welcome.message,
        buttonText: '開始',
        onNext: () {
          ref.read(tutorialStepProvider.notifier).state =
              TutorialStep.addTask.index;
        },
      ),
    );
  }

  /// 步驟 1: 引導點擊 + 按鈕
  Widget _buildAddTaskStep(BuildContext context, WidgetRef ref) {
    return Stack(
      children: [
        // 高亮右下角 + 按鈕區域
        Positioned(
          right: 16,
          bottom: 88, // 底部導航高度 + 間距
          child: Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: const Color(0xFF6366F1),
                width: 3,
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF6366F1).withValues(alpha: 0.5),
                  blurRadius: 20,
                  spreadRadius: 5,
                ),
              ],
            ),
          ),
        ),

        // 箭頭指向 + 按鈕
        Positioned(
          right: 100,
          bottom: 130,
          child: Icon(
            Icons.arrow_downward,
            size: 40,
            color: const Color(0xFF6366F1),
          ),
        ),

        // 訊息卡片
        Positioned(
          left: 20,
          right: 20,
          bottom: 200,
          child: _buildMessageCard(
            context,
            ref,
            title: TutorialStep.addTask.title,
            message: TutorialStep.addTask.message,
            buttonText: '下一步',
            onNext: () {
              ref.read(tutorialStepProvider.notifier).state =
                  TutorialStep.overview.index;
            },
            showSkip: true,
          ),
        ),
      ],
    );
  }

  /// 步驟 2: 引導到負載頁面
  Widget _buildOverviewStep(BuildContext context, WidgetRef ref) {
    return Stack(
      children: [
        // 高亮底部導航的負載 tab
        Positioned(
          left: MediaQuery.of(context).size.width * 0.65, // 假設在第三個位置
          right: MediaQuery.of(context).size.width * 0.02,
          bottom: 0,
          height: 70,
          child: Container(
            decoration: BoxDecoration(
              border: Border.all(
                color: const Color(0xFF6366F1),
                width: 3,
              ),
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF6366F1).withValues(alpha: 0.5),
                  blurRadius: 20,
                  spreadRadius: 5,
                ),
              ],
            ),
          ),
        ),

        // 箭頭指向負載 tab
        Positioned(
          right: MediaQuery.of(context).size.width * 0.2,
          bottom: 75,
          child: Icon(
            Icons.arrow_downward,
            size: 40,
            color: const Color(0xFF6366F1),
          ),
        ),

        // 訊息卡片
        Positioned(
          left: 20,
          right: 20,
          bottom: 150,
          child: _buildMessageCard(
            context,
            ref,
            title: TutorialStep.overview.title,
            message: TutorialStep.overview.message,
            buttonText: '下一步',
            onNext: () {
              ref.read(tutorialStepProvider.notifier).state =
                  TutorialStep.milestone.index;
            },
            showSkip: true,
          ),
        ),
      ],
    );
  }

  /// 步驟 3: 說明里程碑編輯
  Widget _buildMilestoneStep(BuildContext context, WidgetRef ref) {
    return Center(
      child: _buildMessageCard(
        context,
        ref,
        title: TutorialStep.milestone.title,
        message: TutorialStep.milestone.message,
        buttonText: '下一步',
        onNext: () {
          ref.read(tutorialStepProvider.notifier).state =
              TutorialStep.complete.index;
        },
        showSkip: true,
      ),
    );
  }

  /// 步驟 4: 完成
  Widget _buildCompleteStep(BuildContext context, WidgetRef ref) {
    return Center(
      child: _buildMessageCard(
        context,
        ref,
        title: TutorialStep.complete.title,
        message: TutorialStep.complete.message,
        buttonText: '開始使用',
        onNext: () async {
          // 標記為已完成
          await markTutorialCompleted();
          // 關閉引導
          ref.read(showTutorialProvider.notifier).state = false;
          ref.read(tutorialStepProvider.notifier).state = 0;
        },
      ),
    );
  }

  /// 訊息卡片
  Widget _buildMessageCard(
    BuildContext context,
    WidgetRef ref, {
    required String title,
    required String message,
    required String buttonText,
    required VoidCallback onNext,
    bool showSkip = false,
  }) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            const Color(0xFF1E293B),
            const Color(0xFF0F172A),
          ],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: const Color(0xFF6366F1).withValues(alpha: 0.5),
          width: 2,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF6366F1).withValues(alpha: 0.3),
            blurRadius: 30,
            spreadRadius: 5,
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // 標題
          Text(
            title,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
            textAlign: TextAlign.center,
          ),

          const SizedBox(height: 16),

          // 訊息
          Text(
            message,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.9),
              fontSize: 16,
              height: 1.5,
            ),
            textAlign: TextAlign.center,
          ),

          const SizedBox(height: 24),

          // 按鈕
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // 跳過按鈕
              if (showSkip)
                TextButton(
                  onPressed: () async {
                    await markTutorialCompleted();
                    ref.read(showTutorialProvider.notifier).state = false;
                    ref.read(tutorialStepProvider.notifier).state = 0;
                  },
                  child: Text(
                    '跳過',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.6),
                      fontSize: 16,
                    ),
                  ),
                ),

              if (showSkip) const SizedBox(width: 16),

              // 下一步按鈕
              ElevatedButton(
                onPressed: onNext,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF6366F1),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 32,
                    vertical: 16,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: Text(
                  buttonText,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
