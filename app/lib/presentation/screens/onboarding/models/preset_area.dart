import 'package:flutter/material.dart';

/// 預設身份定義
class PresetArea {
  final String name;
  final String scope;
  final IconData icon;
  final Color color;

  const PresetArea({
    required this.name,
    required this.scope,
    required this.icon,
    required this.color,
  });

  /// 預設的四個身份
  static const List<PresetArea> defaults = [
    PresetArea(
      name: '事業',
      scope: '職涯發展、專案管理、技能提升、事業規劃',
      icon: Icons.work_outline,
      color: Color(0xFF3B82F6), // Blue
    ),
    PresetArea(
      name: '個人',
      scope: '興趣愛好、自我學習、心靈成長、休閒娛樂',
      icon: Icons.person_outline,
      color: Color(0xFF6366F1), // Indigo
    ),
    PresetArea(
      name: '人際',
      scope: '家庭關係、朋友社交、親子教育、人脈經營',
      icon: Icons.people_outline,
      color: Color(0xFF22C55E), // Green
    ),
    PresetArea(
      name: '財務',
      scope: '投資理財、資產配置、預算管理、被動收入',
      icon: Icons.account_balance_wallet_outlined,
      color: Color(0xFFF59E0B), // Amber
    ),
  ];
}
