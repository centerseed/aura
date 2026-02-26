import 'package:flutter/material.dart';
import 'package:app/core/theme/app_colors.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../providers/onboarding_provider.dart';
import '../models/preset_area.dart';
import 'identity_card.dart';

/// Page 1: 身份地圖設定頁面
class IdentitySetupPage extends ConsumerStatefulWidget {
  const IdentitySetupPage({super.key});

  @override
  ConsumerState<IdentitySetupPage> createState() => _IdentitySetupPageState();
}

class _IdentitySetupPageState extends ConsumerState<IdentitySetupPage> {
  bool _showCustomArea = false;
  final _customNameController = TextEditingController();
  final _customScopeController = TextEditingController();

  @override
  void dispose() {
    _customNameController.dispose();
    _customScopeController.dispose();
    super.dispose();
  }

  void _toggleArea(String areaName) {
    final selected = ref.read(selectedAreasProvider.notifier);
    final current = selected.state;

    if (current.contains(areaName)) {
      selected.state = {...current}..remove(areaName);
    } else {
      selected.state = {...current, areaName};
    }
  }

  @override
  Widget build(BuildContext context) {
    final selectedAreas = ref.watch(selectedAreasProvider);
    final totalSelected = ref.watch(totalSelectedProvider);
    final screenWidth = MediaQuery.of(context).size.width;
    final crossAxisCount = screenWidth > 700 ? 3 : 2;
    final hPadding = screenWidth > 700 ? 32.0 : 16.0;
    final onSurface = Theme.of(context).colorScheme.onSurface;

    return SafeArea(
      child: SingleChildScrollView(
        padding: EdgeInsets.all(hPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 簡化標題
            Text(
              '選擇你的身份 (至少 1 個)',
              style: TextStyle(
                color: onSurface,
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),

            const SizedBox(height: 16),

            // 預設身份卡片（響應式網格）
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: crossAxisCount,
                mainAxisSpacing: 8,
                crossAxisSpacing: 10,
                childAspectRatio: 1.5,
              ),
              itemCount: PresetArea.defaults.length,
              itemBuilder: (context, index) {
                final area = PresetArea.defaults[index];
                return IdentityCard(
                  name: area.name,
                  scope: area.scope,
                  icon: area.icon,
                  color: area.color,
                  isSelected: selectedAreas.contains(area.name),
                  onTap: () => _toggleArea(area.name),
                );
              },
            ),

            const SizedBox(height: 16),

            // 自定義身份區域
            AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              curve: Curves.easeOut,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 展開/收起按鈕 - 增強視覺提示
                  InkWell(
                    onTap: () {
                      setState(() {
                        _showCustomArea = !_showCustomArea;
                      });
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            AppColors.brandTeal.withValues(alpha: 0.15),
                            AppColors.brandBlue.withValues(alpha: 0.15),
                          ],
                        ),
                        border: Border.all(
                          color: AppColors.brandTeal.withValues(alpha: 0.4),
                          width: 1.5,
                        ),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              color: AppColors.brandTeal.withValues(alpha: 0.3),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: AnimatedRotation(
                              duration: const Duration(milliseconds: 300),
                              turns: _showCustomArea ? 0.25 : 0,
                              child: const Icon(
                                Icons.add,
                                color: AppColors.brandTeal,
                                size: 20,
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Text(
                            '新增自定義身份',
                            style: TextStyle(
                              color: AppColors.brandTeal,
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // 自定義表單
                  if (_showCustomArea) ...[
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.surfaceContainer,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: AppColors.primary.withValues(alpha: 0.3),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '身份名稱',
                            style: TextStyle(
                              color: onSurface.withValues(alpha: 0.7),
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(height: 8),
                          TextField(
                            controller: _customNameController,
                            onChanged: (value) {
                              final custom = ref.read(customAreaProvider);
                              ref.read(customAreaProvider.notifier).state =
                                  (name: value, scope: custom.scope);
                            },
                            decoration: const InputDecoration(
                              hintText: '例如：健康',
                              border: OutlineInputBorder(),
                            ),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            '包含內容',
                            style: TextStyle(
                              color: onSurface.withValues(alpha: 0.7),
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(height: 8),
                          TextField(
                            controller: _customScopeController,
                            onChanged: (value) {
                              final custom = ref.read(customAreaProvider);
                              ref.read(customAreaProvider.notifier).state =
                                  (name: custom.name, scope: value);
                            },
                            maxLines: 2,
                            decoration: const InputDecoration(
                              hintText: '例如：運動健身、飲食規劃、健康檢查',
                              border: OutlineInputBorder(),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 20),

            // 選擇狀態提示
            Center(
              child: Text(
                totalSelected > 0
                    ? '已選擇 $totalSelected 個身份'
                    : '請至少選擇 1 個身份',
                style: TextStyle(
                  color: totalSelected > 0
                      ? AppColors.success
                      : onSurface.withValues(alpha: 0.5),
                  fontSize: 13,
                ),
              ),
            ),

            const SizedBox(height: 120), // 為底部指示器留空間
          ],
        ),
      ),
    );
  }
}
