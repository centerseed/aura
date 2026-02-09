import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:timezone/timezone.dart' as tz;
import '../../../core/di/providers.dart' show analyticsServiceProvider;
import '../../providers/app_lifecycle_provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/user_provider.dart';
import 'widgets/statistics_card.dart';
import '../../providers/first_time_tutorial_provider.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final statisticsAsync = ref.watch(userStatisticsProvider);
    final authRepo = ref.watch(authRepositoryProvider);
    final isAnonymous = authRepo.isAnonymous;

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
            _buildAvatarSection(user, isAnonymous),

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

            // ========== 匿名用戶綁定提示 ==========
            if (isAnonymous) ...[
              _buildAnonymousBindingCard(context, ref),
              const SizedBox(height: 16),
            ],

            // ========== 設定項目 ==========
            _buildSection(context, '帳戶設定', [
              _buildTile(
                context,
                icon: Icons.person_outline_rounded,
                title: '個人資料',
                onTap: () => _showEditProfileSheet(context, ref),
              ),
              _buildTile(
                context,
                icon: Icons.notifications_none_rounded,
                title: '通知偏好',
                onTap: () => _showNotificationSettings(context),
              ),
              _buildTile(
                context,
                icon: Icons.palette_outlined,
                title: '主題外觀',
                onTap: () => _showThemeSettings(context),
              ),
              _buildTile(
                context,
                icon: Icons.tour_outlined,
                title: '重新觀看導覽',
                onTap: () async {
                  await resetTutorial();
                  ref.read(showTutorialProvider.notifier).state = true;
                  ref.read(tutorialStepProvider.notifier).state =
                      TutorialStep.welcome.index;
                  if (context.mounted) {
                    Navigator.pop(context);
                  }
                },
              ),
            ]),

            const SizedBox(height: 24),

            _buildSection(context, '關於', [
              _buildTile(
                context,
                icon: Icons.info_outline_rounded,
                title: '關於 Zentropy',
                subtitle: 'v0.9.0 beta',
                onTap: () => _showAboutDialog(context),
              ),
            ]),

            const SizedBox(height: 24),

            _buildSection(context, '系統', [
              _buildTile(
                context,
                icon: Icons.public_rounded,
                title: '時區設定',
                subtitle: tz.local.name,
                onTap: () => _showTimezoneSettings(context, ref),
              ),
              _buildTile(
                context,
                icon: Icons.logout_rounded,
                title: '登出帳號',
                titleColor: const Color(0xFFFF453A),
                iconColor: const Color(0xFFFF453A),
                onTap: () async {
                  // 記錄登出事件
                  final analytics = ref.read(analyticsServiceProvider);
                  await analytics.logLogout();

                  final authRepo = ref.read(authRepositoryProvider);
                  await authRepo.signOut();
                  if (context.mounted) {
                    context.go('/auth/signin');
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

  // ========== 匿名用戶綁定 Google 帳號卡片 ==========
  Widget _buildAnonymousBindingCard(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              const Color(0xFF6C63FF).withOpacity(0.15),
              const Color(0xFF5E9FFF).withOpacity(0.10),
            ],
          ),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: const Color(0xFF6C63FF).withOpacity(0.3),
          ),
        ),
        child: Column(
          children: [
            const Icon(
              Icons.link_rounded,
              color: Color(0xFF6C63FF),
              size: 32,
            ),
            const SizedBox(height: 12),
            const Text(
              '您目前使用訪客模式',
              style: TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              '綁定 Google 帳號以同步資料到網頁端，並避免遺失資料',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white.withOpacity(0.6),
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () => _linkWithGoogle(context, ref),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF6C63FF),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                icon: const Icon(Icons.account_circle_outlined, size: 20),
                label: const Text(
                  '綁定 Google 帳號',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _linkWithGoogle(BuildContext context, WidgetRef ref) async {
    final authRepo = ref.read(authRepositoryProvider);
    final result = await authRepo.linkWithGoogle();

    if (!context.mounted) return;

    result.fold(
      (failure) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(failure.message),
            backgroundColor: Colors.red,
            behavior: SnackBarBehavior.floating,
          ),
        );
      },
      (user) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Google 帳號綁定成功！'),
            backgroundColor: Color(0xFF30D158),
            behavior: SnackBarBehavior.floating,
          ),
        );
      },
    );
  }

  // ========== 優化後的 Avatar Section ==========
  Widget _buildAvatarSection(user, bool isAnonymous) {
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
            isAnonymous ? '訪客' : (user?.displayName ?? '未設定名稱'),
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
              isAnonymous ? '訪客模式' : (user?.email ?? '無電子郵件'),
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

  // ========== 彈出選單功能 ==========
  void _showEditProfileSheet(BuildContext context, WidgetRef ref) {
    final user = ref.read(currentUserProvider);
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1c1c1e),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              '個人資料',
              style: TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 24),
            _buildInfoRow('名稱', user?.displayName ?? '未設定'),
            _buildInfoRow('電子郵件', user?.email ?? '未設定'),
            _buildInfoRow('帳號建立', _formatDate(user?.metadata.creationTime)),
            const SizedBox(height: 16),
            Text(
              '如需修改個人資料，請前往 Firebase 控制台',
              style: TextStyle(
                color: Colors.white.withOpacity(0.4),
                fontSize: 12,
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  void _showNotificationSettings(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1c1c1e),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              '通知偏好',
              style: TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 24),
            _buildSwitchTile('任務提醒', '當任務即將到期時通知', true),
            _buildSwitchTile('每日摘要', '每天早上發送任務摘要', false),
            _buildSwitchTile('完成慶祝', '完成任務時播放動畫', true),
            const SizedBox(height: 16),
            Text(
              '通知功能即將推出',
              style: TextStyle(
                color: Colors.white.withOpacity(0.4),
                fontSize: 12,
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  void _showThemeSettings(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1c1c1e),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              '主題外觀',
              style: TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 24),
            _buildThemeOption('深色模式', Icons.dark_mode, true),
            _buildThemeOption('淺色模式', Icons.light_mode, false),
            _buildThemeOption('跟隨系統', Icons.settings_suggest, false),
            const SizedBox(height: 16),
            Text(
              '目前僅支援深色模式',
              style: TextStyle(
                color: Colors.white.withOpacity(0.4),
                fontSize: 12,
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  void _showTimezoneSettings(BuildContext context, WidgetRef ref) {
    final lifecycleData = ref.read(appLifecycleProvider);
    final currentTimezone = tz.local.name;
    final now = DateTime.now();
    final utcNow = now.toUtc();

    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1c1c1e),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF6C63FF), Color(0xFF5E9FFF)],
                    ),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.public, color: Colors.white, size: 24),
                ),
                const SizedBox(width: 16),
                const Text(
                  '時區設定',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            _buildTimezoneInfoRow('當前時區', currentTimezone, Icons.location_on),
            _buildTimezoneInfoRow(
              '上次已知',
              lifecycleData.lastKnownTimezone ?? '未設定',
              Icons.history,
            ),
            const Divider(height: 32, color: Color(0xFF2c2c2e)),
            _buildTimezoneInfoRow(
              '本地時間',
              _formatDetailedDateTime(now),
              Icons.access_time,
            ),
            _buildTimezoneInfoRow(
              'UTC 時間',
              _formatDetailedDateTime(utcNow),
              Icons.public,
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF6C63FF).withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: const Color(0xFF6C63FF).withOpacity(0.3),
                ),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.info_outline,
                    color: Color(0xFF6C63FF),
                    size: 20,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      '時區會自動偵測並同步到所有提醒',
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.8),
                        fontSize: 13,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    ),
    );
  }

  void _showAboutDialog(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1c1c1e),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF6C63FF), Color(0xFF5E9FFF)],
                ),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(Icons.auto_awesome, color: Colors.white, size: 40),
            ),
            const SizedBox(height: 16),
            const Text(
              'Zentropy',
              style: TextStyle(
                color: Colors.white,
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              '讓一切井然有序',
              style: TextStyle(
                color: Colors.white.withOpacity(0.6),
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'v0.9.0 beta',
              style: TextStyle(
                color: Colors.white.withOpacity(0.4),
                fontSize: 12,
              ),
            ),
            const SizedBox(height: 24),
            Text(
              '你的 AI 營運長——讓一切井然有序',
              style: TextStyle(
                color: Colors.white.withOpacity(0.5),
                fontSize: 13,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 14),
          ),
          Text(
            value,
            style: const TextStyle(color: Colors.white, fontSize: 14),
          ),
        ],
      ),
    );
  }

  Widget _buildSwitchTile(String title, String subtitle, bool value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(color: Colors.white, fontSize: 14),
                ),
                Text(
                  subtitle,
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.4),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          Switch(
            value: value,
            onChanged: null,
            activeColor: const Color(0xFF6C63FF),
          ),
        ],
      ),
    );
  }

  Widget _buildThemeOption(String title, IconData icon, bool selected) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFF6C63FF).withOpacity(0.2) : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? const Color(0xFF6C63FF) : Colors.white.withOpacity(0.1),
          ),
        ),
        child: Row(
          children: [
            Icon(icon, color: selected ? const Color(0xFF6C63FF) : Colors.white.withOpacity(0.6)),
            const SizedBox(width: 12),
            Text(
              title,
              style: TextStyle(
                color: selected ? Colors.white : Colors.white.withOpacity(0.6),
                fontSize: 14,
              ),
            ),
            const Spacer(),
            if (selected)
              const Icon(Icons.check_circle, color: Color(0xFF6C63FF), size: 20),
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime? date) {
    if (date == null) return '未知';
    return '${date.year}/${date.month}/${date.day}';
  }

  Widget _buildTimezoneInfoRow(String label, String value, IconData icon) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          Icon(
            icon,
            color: const Color(0xFF6C63FF),
            size: 20,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.6),
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _formatDetailedDateTime(DateTime dateTime) {
    final weekdays = ['一', '二', '三', '四', '五', '六', '日'];
    final weekday = weekdays[dateTime.weekday - 1];

    return '${dateTime.year}/${_pad(dateTime.month)}/${_pad(dateTime.day)} '
        '週$weekday '
        '${_pad(dateTime.hour)}:${_pad(dateTime.minute)}:${_pad(dateTime.second)}';
  }

  String _pad(int value) => value.toString().padLeft(2, '0');

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
