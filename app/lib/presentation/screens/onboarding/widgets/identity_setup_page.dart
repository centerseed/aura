import 'package:flutter/material.dart';
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

    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 簡化標題
            Text(
              '選擇你的身份 (至少 1 個)',
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.9),
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),

            const SizedBox(height: 16),

            // 預設身份卡片（2x2 網格）
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
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
                            const Color(0xFF6366F1).withValues(alpha: 0.15),
                            const Color(0xFF8B5CF6).withValues(alpha: 0.15),
                          ],
                        ),
                        border: Border.all(
                          color: const Color(0xFF6366F1).withValues(alpha: 0.4),
                          width: 1.5,
                        ),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              color: const Color(0xFF6366F1).withValues(alpha: 0.3),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: AnimatedRotation(
                              duration: const Duration(milliseconds: 300),
                              turns: _showCustomArea ? 0.25 : 0,
                              child: const Icon(
                                Icons.add,
                                color: Color(0xFF6366F1),
                                size: 20,
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          const Text(
                            '新增自定義身份',
                            style: TextStyle(
                              color: Colors.white,
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
                        color: Colors.white.withValues(alpha: 0.05),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: const Color(0xFF6C63FF).withValues(alpha: 0.3),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            '身份名稱',
                            style: TextStyle(
                              color: Colors.white70,
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
                            style: const TextStyle(color: Colors.white),
                            decoration: InputDecoration(
                              hintText: '例如：健康',
                              hintStyle: TextStyle(
                                color: Colors.white.withValues(alpha: 0.3),
                              ),
                              filled: true,
                              fillColor: Colors.white.withValues(alpha: 0.05),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                                borderSide: BorderSide.none,
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          const Text(
                            '包含內容',
                            style: TextStyle(
                              color: Colors.white70,
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
                            style: const TextStyle(color: Colors.white),
                            maxLines: 2,
                            decoration: InputDecoration(
                              hintText: '例如：運動健身、飲食規劃、健康檢查',
                              hintStyle: TextStyle(
                                color: Colors.white.withValues(alpha: 0.3),
                              ),
                              filled: true,
                              fillColor: Colors.white.withValues(alpha: 0.05),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                                borderSide: BorderSide.none,
                              ),
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
                      ? const Color(0xFF4ADE80)
                      : Colors.white.withValues(alpha: 0.5),
                  fontSize: 13,
                ),
              ),
            ),

            const SizedBox(height: 80), // 為底部指示器留空間
          ],
        ),
      ),
    );
  }
}
