import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/auth_provider.dart';
import '../../providers/user_provider.dart';
import 'widgets/statistics_card.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final statisticsAsync = ref.watch(userStatisticsProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF000000),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          '個人檔案',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 18,
          ),
        ),
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            const SizedBox(height: 24),

            // ========== 優化後的 Avatar Section ==========
            _buildAvatarSection(user),

            const SizedBox(height: 32),

            // ========== 統計卡片區塊 (新增) ==========
            statisticsAsync.when(
              data: (stats) => Column(
                children: [
                  _buildStatisticsSection(stats),
                  const SizedBox(height: 32),
                ],
              ),
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: Center(
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
              error: (error, stack) => Padding(
                padding: const EdgeInsets.all(24),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1c1c1e),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    children: [
                      Icon(
                        Icons.error_outline,
                        color: Colors.orange.withOpacity(0.7),
                        size: 32,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '統計數據載入失敗',
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.7),
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '請檢查網路連接或稍後再試',
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.4),
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // ========== 設定項目 ==========
            _buildSection(context, '帳戶設定', [
              _buildTile(
                context,
                icon: Icons.person_outline_rounded,
                title: '個人資料',
                onTap: () {
                  // TODO: 導航到 EditProfileScreen
                },
              ),
              _buildTile(
                context,
                icon: Icons.notifications_none_rounded,
                title: '通知偏好',
                onTap: () {
                  // TODO: 導航到 NotificationSettingsScreen
                },
              ),
              _buildTile(
                context,
                icon: Icons.palette_outlined,
                title: '主題外觀',
                onTap: () {
                  // TODO: 導航到 ThemeSettingsScreen
                },
              ),
            ]),

            const SizedBox(height: 24),

            _buildSection(context, '關於', [
              _buildTile(
                context,
                icon: Icons.info_outline_rounded,
                title: '關於 Naruvia',
                subtitle: 'v1.0.0',
                onTap: () {
                  // TODO: 導航到 AboutScreen
                },
              ),
            ]),

            const SizedBox(height: 24),

            _buildSection(context, '系統', [
              _buildTile(
                context,
                icon: Icons.logout_rounded,
                title: '登出帳號',
                titleColor: const Color(0xFFFF453A),
                iconColor: const Color(0xFFFF453A),
                onTap: () async {
                  final authRepo = ref.read(authRepositoryProvider);
                  await authRepo.signOut();
                  if (context.mounted) {
                    Navigator.pop(context);
                  }
                },
              ),
            ]),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  // ========== 優化後的 Avatar Section ==========
  Widget _buildAvatarSection(user) {
    return Center(
      child: Column(
        children: [
          Stack(
            alignment: Alignment.center,
            children: [
              // 發光效果（優化）
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF6C63FF).withOpacity(0.2),
                      blurRadius: 15,
                      spreadRadius: 2,
                    ),
                  ],
                ),
              ),
              // 漸變邊框 + Avatar
              Container(
                padding: const EdgeInsets.all(2),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: const LinearGradient(
                    colors: [Color(0xFF6C63FF), Color(0xFF8F8AFF)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: CircleAvatar(
                  radius: 36, // 從 50 減至 36
                  backgroundImage: user?.photoURL != null
                      ? NetworkImage(user!.photoURL!)
                      : null,
                  backgroundColor: const Color(0xFF1c1c1e),
                  child: user?.photoURL == null
                      ? const Icon(Icons.person, size: 36, color: Colors.white24)
                      : null,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            user?.displayName ?? '未設定名稱',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.05),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              user?.email ?? '無電子郵件',
              style: TextStyle(
                color: Colors.white.withOpacity(0.5),
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ========== 統計卡片區塊 (新增) ==========
  Widget _buildStatisticsSection(stats) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '數據統計',
            style: TextStyle(
              color: Colors.white.withOpacity(0.5),
              fontSize: 12,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 12),
          Column(
              children: [
                // 第一行
                Row(
                  children: [
                    Expanded(
                      child: StatisticsCard(
                        value: stats.totalTasks,
                        label: '總任務',
                        icon: Icons.task_alt,
                        color: const Color(0xFF5E9FFF), // 藍色
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: StatisticsCard(
                        value: stats.totalProducts,
                        label: '專案',
                        icon: Icons.folder_outlined,
                        color: const Color(0xFFFF9F0A), // 橙色
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: StatisticsCard(
                        value: stats.totalAreas,
                        label: '領域',
                        icon: Icons.category_outlined,
                        color: const Color(0xFFFF375F), // 粉紅色
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: StatisticsCard(
                        value: stats.daysActive,
                        label: '使用天數',
                        icon: Icons.calendar_today,
                        suffix: '天',
                        color: const Color(0xFF32D7C9), // 青色
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                // 第二行
                Row(
                  children: [
                    Expanded(
                      child: StatisticsCard(
                        value: stats.activeTasks,
                        label: '進行中',
                        icon: Icons.play_circle_outline,
                        color: const Color(0xFF6C63FF), // 紫色
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: StatisticsCard(
                        value: stats.archivedTasks,
                        label: '已歸檔',
                        icon: Icons.archive_outlined,
                        color: const Color(0xFF98A2B3), // 灰藍色
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: StatisticsCard(
                        value: stats.completedToday,
                        label: '今日完成',
                        icon: Icons.check_circle_outline,
                        color: const Color(0xFF30D158), // 綠色
                        showSparkle: stats.completedToday > 0,
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(child: SizedBox()), // 預留位
                  ],
                ),
              ],
            ),
        ],
      ),
    );
  }

  Widget _buildSection(
    BuildContext context,
    String title,
    List<Widget> children,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 24, bottom: 12),
          child: Text(
            title,
            style: TextStyle(
              color: Colors.white.withOpacity(0.3),
              fontSize: 12,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.2,
            ),
          ),
        ),
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: const Color(0xFF1c1c1e),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white.withOpacity(0.05)),
          ),
          child: Column(children: children),
        ),
      ],
    );
  }

  Widget _buildTile(
    BuildContext context, {
    required IconData icon,
    required String title,
    String? subtitle,
    required VoidCallback onTap,
    Color? titleColor,
    Color? iconColor,
  }) {
    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      leading: Icon(
        icon,
        color: iconColor ?? Colors.white.withOpacity(0.7),
        size: 22,
      ),
      title: Text(
        title,
        style: TextStyle(
          color: titleColor ?? Colors.white,
          fontSize: 16,
          fontWeight: FontWeight.w500,
        ),
      ),
      subtitle: subtitle != null
          ? Text(
              subtitle,
              style: TextStyle(
                color: Colors.white.withOpacity(0.5),
                fontSize: 12,
              ),
            )
          : null,
      trailing: Icon(
        Icons.chevron_right_rounded,
        color: Colors.white.withOpacity(0.2),
        size: 20,
      ),
    );
  }
}
