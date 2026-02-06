import 'package:flutter_riverpod/flutter_riverpod.dart';

/// 選中的預設身份
final selectedAreasProvider = StateProvider<Set<String>>((ref) => {});

/// 自定義身份資料
final customAreaProvider = StateProvider<({String name, String scope})>((ref) {
  return (name: '', scope: '');
});

/// 當前頁面索引
final onboardingPageProvider = StateProvider<int>((ref) => 0);

/// 是否正在提交 Areas
final isSubmittingAreasProvider = StateProvider<bool>((ref) => false);

/// 總計選中的身份數量（預設 + 自定義）
final totalSelectedProvider = Provider<int>((ref) {
  final selected = ref.watch(selectedAreasProvider);
  final custom = ref.watch(customAreaProvider);
  final hasValidCustom =
      custom.name.trim().isNotEmpty && custom.scope.trim().isNotEmpty;
  return selected.length + (hasValidCustom ? 1 : 0);
});

/// 是否可以繼續到下一頁（至少選擇 1 個身份）
final canProceedProvider = Provider<bool>((ref) {
  return ref.watch(totalSelectedProvider) > 0;
});
