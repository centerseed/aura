import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:timezone/timezone.dart' as tz;

import '../../providers/app_lifecycle_provider.dart';

/// 時區調試 Widget
/// 顯示當前 App 的時區資訊
class TimezoneDebugWidget extends ConsumerWidget {
  const TimezoneDebugWidget({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lifecycleData = ref.watch(appLifecycleProvider);
    final currentTimezone = tz.local.name;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.7),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.access_time, color: Colors.white, size: 16),
              const SizedBox(width: 8),
              const Text(
                '時區資訊',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          _buildInfoRow('當前時區', currentTimezone),
          _buildInfoRow('上次已知時區', lifecycleData.lastKnownTimezone ?? '未設定'),
          _buildInfoRow('當前時間', _formatDateTime(DateTime.now())),
          _buildInfoRow(
            'UTC 時間',
            _formatDateTime(DateTime.now().toUtc()),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            '$label: ',
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 12,
            ),
          ),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  String _formatDateTime(DateTime dateTime) {
    return '${dateTime.year}-${_pad(dateTime.month)}-${_pad(dateTime.day)} '
        '${_pad(dateTime.hour)}:${_pad(dateTime.minute)}:${_pad(dateTime.second)}';
  }

  String _pad(int value) => value.toString().padLeft(2, '0');
}
