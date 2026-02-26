import 'package:flutter/material.dart';
import 'package:app/core/theme/app_colors.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:timezone/timezone.dart' as tz;
import '../../../core/di/providers.dart' show analyticsServiceProvider, appVersionProvider;
import '../../providers/app_lifecycle_provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/theme_provider.dart';
import '../../providers/user_provider.dart';
import 'widgets/statistics_card.dart';
import '../../providers/ai_consent_provider.dart';
import '../../providers/first_time_tutorial_provider.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final statisticsAsync = ref.watch(userStatisticsProvider);
    final colorScheme = Theme.of(context).colorScheme;
    final versionAsync = ref.watch(appVersionProvider);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: Icon(Icons.arrow_back_ios_new, color: colorScheme.onSurface),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          '個人檔案',
          style: TextStyle(
            color: colorScheme.onSurface,
            fontWeight: FontWeight.bold,
            fontSize: 18,
          ),
        ),
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            const SizedBox(height: 24),

            _buildAvatarSection(context, user),

            const SizedBox(height: 32),

            statisticsAsync.when(
              data: (stats) => Column(
                children: [
                  _buildStatisticsSection(context, stats),
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
                    color: colorScheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    children: [
                      Icon(
                        Icons.error_outline,
                        color: AppColors.statusInbox.withOpacity(0.7),
                        size: 32,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '統計數據載入失敗',
                        style: TextStyle(
                          color: colorScheme.onSurface.withOpacity(0.7),
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '請檢查網路連接或稍後再試',
                        style: TextStyle(
                          color: colorScheme.onSurface.withOpacity(0.4),
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            _buildSection(context, '帳戶', [
              _buildAiConsentTile(context, ref),
              _buildTile(
                context,
                icon: Icons.schedule_rounded,
                title: 'AI 每日用量',
                subtitle: '每日 50 次，於 UTC 00:00（台灣時間 08:00）重設',
                onTap: () {},
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

            _buildSection(context, '外觀', [
              _buildThemeSelector(context, ref),
            ]),

            const SizedBox(height: 24),

            _buildSection(context, '關於', [
              versionAsync.when(
                data: (version) => _buildTile(
                  context,
                  icon: Icons.info_outline_rounded,
                  title: '關於 Zentropy',
                  subtitle: version,
                  onTap: () => _showAboutDialog(context, version),
                ),
                loading: () => _buildTile(
                  context,
                  icon: Icons.info_outline_rounded,
                  title: '關於 Zentropy',
                  subtitle: '載入中...',
                  onTap: () => _showAboutDialog(context, '載入中...'),
                ),
                error: (error, stack) => _buildTile(
                  context,
                  icon: Icons.info_outline_rounded,
                  title: '關於 Zentropy',
                  subtitle: 'v0.9.0 beta',
                  onTap: () => _showAboutDialog(context, 'v0.9.0 beta'),
                ),
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
                icon: Icons.delete_forever_rounded,
                title: '刪除帳號',
                titleColor: AppColors.destructiveRed,
                iconColor: AppColors.destructiveRed,
                onTap: () => _showDeleteAccountDialog(context, ref),
              ),
              _buildTile(
                context,
                icon: Icons.logout_rounded,
                title: '登出帳號',
                titleColor: AppColors.destructiveRed,
                iconColor: AppColors.destructiveRed,
                onTap: () async {
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

  Widget _buildThemeSelector(BuildContext context, WidgetRef ref) {
    final currentMode = ref.watch(themeModeProvider);
    final colorScheme = Theme.of(context).colorScheme;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Row(
        children: [
          Icon(Icons.palette_outlined, color: colorScheme.onSurfaceVariant, size: 22),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              '主題模式',
              style: TextStyle(
                color: colorScheme.onSurface,
                fontSize: 16,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          SegmentedButton<ThemeMode>(
            style: ButtonStyle(
              visualDensity: VisualDensity.compact,
              textStyle: WidgetStatePropertyAll(
                const TextStyle(fontSize: 12),
              ),
            ),
            segments: const [
              ButtonSegment(value: ThemeMode.system, label: Text('系統')),
              ButtonSegment(value: ThemeMode.light, label: Text('淺色')),
              ButtonSegment(value: ThemeMode.dark, label: Text('深色')),
            ],
            selected: {currentMode},
            onSelectionChanged: (selection) {
              ref.read(themeModeProvider.notifier).setThemeMode(selection.first);
            },
          ),
        ],
      ),
    );
  }

  Widget _buildAvatarSection(BuildContext context, user) {
    final colorScheme = Theme.of(context).colorScheme;
    return Center(
      child: Column(
        children: [
          Stack(
            alignment: Alignment.center,
            children: [
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withOpacity(0.2),
                      blurRadius: 15,
                      spreadRadius: 2,
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.all(2),
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    colors: [AppColors.primary, AppColors.gradientSecondary],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: CircleAvatar(
                  radius: 36,
                  backgroundImage: user?.photoURL != null
                      ? NetworkImage(user!.photoURL!)
                      : null,
                  backgroundColor: colorScheme.surfaceContainerHighest,
                  child: user?.photoURL == null
                      ? Icon(Icons.person, size: 36, color: colorScheme.onSurfaceVariant)
                      : null,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            user?.displayName ?? '未設定名稱',
            style: TextStyle(
              color: colorScheme.onSurface,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: colorScheme.onSurface.withOpacity(0.05),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              user?.email ?? '無電子郵件',
              style: TextStyle(
                color: colorScheme.onSurface.withOpacity(0.5),
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatisticsSection(BuildContext context, stats) {
    final colorScheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '數據統計',
            style: TextStyle(
              color: colorScheme.onSurface.withOpacity(0.5),
              fontSize: 12,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 12),
          Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: StatisticsCard(
                        value: stats.totalTasks,
                        label: '總任務',
                        icon: Icons.task_alt,
                        color: AppColors.statsBlue,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: StatisticsCard(
                        value: stats.totalProducts,
                        label: '專案',
                        icon: Icons.folder_outlined,
                        color: AppColors.statsOrange,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: StatisticsCard(
                        value: stats.totalAreas,
                        label: '領域',
                        icon: Icons.category_outlined,
                        color: AppColors.statsPink,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: StatisticsCard(
                        value: stats.daysActive,
                        label: '使用天數',
                        icon: Icons.calendar_today,
                        suffix: '天',
                        color: AppColors.statsTeal,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: StatisticsCard(
                        value: stats.activeTasks,
                        label: '進行中',
                        icon: Icons.play_circle_outline,
                        color: AppColors.primary,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: StatisticsCard(
                        value: stats.archivedTasks,
                        label: '已歸檔',
                        icon: Icons.archive_outlined,
                        color: AppColors.statsSlate,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: StatisticsCard(
                        value: stats.completedToday,
                        label: '今日完成',
                        icon: Icons.check_circle_outline,
                        color: AppColors.statsGreen,
                        showSparkle: stats.completedToday > 0,
                      ),
                    ),
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
    final colorScheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 24, bottom: 12),
          child: Text(
            title,
            style: TextStyle(
              color: colorScheme.onSurface.withOpacity(0.3),
              fontSize: 12,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.2,
            ),
          ),
        ),
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: colorScheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: colorScheme.outlineVariant.withOpacity(0.2)),
          ),
          child: Column(children: children),
        ),
      ],
    );
  }

  void _showTimezoneSettings(BuildContext context, WidgetRef ref) {
    final lifecycleData = ref.read(appLifecycleProvider);
    final currentTimezone = tz.local.name;
    final now = DateTime.now();
    final utcNow = now.toUtc();
    final colorScheme = Theme.of(context).colorScheme;

    showModalBottomSheet(
      context: context,
      backgroundColor: colorScheme.surface,
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
                      colors: [AppColors.primary, AppColors.statsBlue],
                    ),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.public, color: Colors.white, size: 24),
                ),
                const SizedBox(width: 16),
                Text(
                  '時區設定',
                  style: TextStyle(
                    color: colorScheme.onSurface,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            _buildTimezoneInfoRow(context, '當前時區', currentTimezone, Icons.location_on),
            _buildTimezoneInfoRow(
              context,
              '上次已知',
              lifecycleData.lastKnownTimezone ?? '未設定',
              Icons.history,
            ),
            Divider(height: 32, color: colorScheme.outlineVariant),
            _buildTimezoneInfoRow(
              context,
              '本地時間',
              _formatDetailedDateTime(now),
              Icons.access_time,
            ),
            _buildTimezoneInfoRow(
              context,
              'UTC 時間',
              _formatDetailedDateTime(utcNow),
              Icons.public,
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: AppColors.primary.withOpacity(0.3),
                ),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.info_outline,
                    color: AppColors.primary,
                    size: 20,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      '時區會自動偵測並同步到所有提醒',
                      style: TextStyle(
                        color: colorScheme.onSurface.withOpacity(0.8),
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

  void _showAboutDialog(BuildContext context, String version) {
    final colorScheme = Theme.of(context).colorScheme;
    showModalBottomSheet(
      context: context,
      backgroundColor: colorScheme.surface,
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
                  colors: [AppColors.primary, AppColors.statsBlue],
                ),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(Icons.auto_awesome, color: Colors.white, size: 40),
            ),
            const SizedBox(height: 16),
            Text(
              'Zentropy',
              style: TextStyle(
                color: colorScheme.onSurface,
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              '讓一切井然有序',
              style: TextStyle(
                color: colorScheme.onSurface.withOpacity(0.6),
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              version,
              style: TextStyle(
                color: colorScheme.onSurface.withOpacity(0.4),
                fontSize: 12,
              ),
            ),
            const SizedBox(height: 24),
            Text(
              '你的 AI 營運長——讓一切井然有序',
              style: TextStyle(
                color: colorScheme.onSurface.withOpacity(0.5),
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

  Widget _buildTimezoneInfoRow(BuildContext context, String label, String value, IconData icon) {
    final colorScheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          Icon(
            icon,
            color: AppColors.primary,
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
                    color: colorScheme.onSurface.withOpacity(0.6),
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: TextStyle(
                    color: colorScheme.onSurface,
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

  Widget _buildAiConsentTile(BuildContext context, WidgetRef ref) {
    final colorScheme = Theme.of(context).colorScheme;
    final aiConsent = ref.watch(aiConsentProvider);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      child: Row(
        children: [
          Icon(Icons.auto_awesome, color: colorScheme.onSurfaceVariant, size: 22),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'AI 資料分享',
                  style: TextStyle(
                    color: colorScheme.onSurface,
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                Text(
                  '允許傳送資料至 AI 服務進行智慧分類',
                  style: TextStyle(
                    color: colorScheme.onSurface.withOpacity(0.5),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          Switch(
            value: aiConsent,
            onChanged: (value) {
              if (value) {
                ref.read(aiConsentProvider.notifier).grant();
              } else {
                ref.read(aiConsentProvider.notifier).revoke();
              }
            },
            activeColor: AppColors.aiAccent,
          ),
        ],
      ),
    );
  }

  void _showDeleteAccountDialog(BuildContext context, WidgetRef ref) {
    final colorScheme = Theme.of(context).colorScheme;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: colorScheme.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Icon(Icons.warning_rounded, color: AppColors.destructiveRed, size: 24),
            const SizedBox(width: 8),
            Text(
              '刪除帳號',
              style: TextStyle(
                color: colorScheme.onSurface,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '此操作無法復原。以下資料將被永久刪除：',
              style: TextStyle(
                color: colorScheme.onSurface.withOpacity(0.8),
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 12),
            ...[
              '所有任務與子任務',
              '所有專案與主題',
              '所有領域',
              '所有里程碑',
              '行事曆事件與提醒',
              'AI 教練簡報與每日計畫',
            ].map((item) => Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(
                children: [
                  Icon(Icons.remove, color: AppColors.destructiveRed, size: 16),
                  const SizedBox(width: 8),
                  Text(
                    item,
                    style: TextStyle(
                      color: colorScheme.onSurface.withOpacity(0.7),
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            )),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text(
              '取消',
              style: TextStyle(color: colorScheme.onSurface.withOpacity(0.6)),
            ),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(dialogContext);
              await _executeDeleteAccount(context, ref);
            },
            child: const Text(
              '確認刪除',
              style: TextStyle(
                color: AppColors.destructiveRed,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _executeDeleteAccount(BuildContext context, WidgetRef ref) async {
    // Show loading indicator
    if (!context.mounted) return;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => const Center(
        child: CircularProgressIndicator(),
      ),
    );

    final authRepo = ref.read(authRepositoryProvider);
    final result = await authRepo.deleteAccount();

    if (!context.mounted) return;
    Navigator.pop(context); // dismiss loading

    result.fold(
      (failure) {
        if (!context.mounted) return;
        String message;
        if (failure.message == 'requires-recent-login') {
          message = '基於安全考量，請重新登入後再嘗試刪除帳號';
        } else {
          message = '刪除帳號失敗：${failure.message}';
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(message),
            backgroundColor: AppColors.destructiveRed,
          ),
        );
      },
      (_) {
        if (!context.mounted) return;
        context.go('/auth/signin');
      },
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
    final colorScheme = Theme.of(context).colorScheme;
    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      leading: Icon(
        icon,
        color: iconColor ?? colorScheme.onSurfaceVariant,
        size: 22,
      ),
      title: Text(
        title,
        style: TextStyle(
          color: titleColor ?? colorScheme.onSurface,
          fontSize: 16,
          fontWeight: FontWeight.w500,
        ),
      ),
      subtitle: subtitle != null
          ? Text(
              subtitle,
              style: TextStyle(
                color: colorScheme.onSurface.withOpacity(0.5),
                fontSize: 12,
              ),
            )
          : null,
      trailing: Icon(
        Icons.chevron_right_rounded,
        color: colorScheme.onSurface.withOpacity(0.2),
        size: 20,
      ),
    );
  }
}
