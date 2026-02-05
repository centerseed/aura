import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/onboarding_provider.dart';
import 'widgets/identity_setup_page.dart';
import 'widgets/architecture_intro_page.dart';
import 'widgets/milestone_intro_page.dart';
import 'widgets/ai_scheduling_page.dart';
import 'widgets/ready_page.dart';
import 'widgets/page_indicator.dart';
import 'widgets/onboarding_background.dart';

/// Onboarding 主畫面
class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  late final PageController _pageController;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _onPageChanged(int page) {
    ref.read(onboardingPageProvider.notifier).state = page;
  }

  void _nextPage() {
    if (_pageController.page! < 4) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
  }

  void _previousPage() {
    if (_pageController.page! > 0) {
      _pageController.previousPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentPage = ref.watch(onboardingPageProvider);
    final canProceed = ref.watch(canProceedProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF0D1117),
      body: Stack(
        children: [
          // 背景漸層
          const OnboardingBackground(),

          // 頁面內容
          PageView(
            controller: _pageController,
            onPageChanged: _onPageChanged,
            physics: currentPage == 0 && !canProceed
                ? const NeverScrollableScrollPhysics() // 第一頁未選擇時禁止滑動
                : const ClampingScrollPhysics(),
            children: const [
              IdentitySetupPage(),
              ArchitectureIntroPage(),
              MilestoneIntroPage(),
              AiSchedulingPage(),
              ReadyPage(),
            ],
          ),

          // 進度指示器
          Positioned(
            left: 0,
            right: 0,
            bottom: 48,
            child: PageIndicator(
              currentPage: currentPage,
              totalPages: 5,
              onNext: _nextPage,
              onPrevious: _previousPage,
              canProceed: canProceed,
            ),
          ),
        ],
      ),
    );
  }
}
