import 'package:flutter/material.dart';

/// 統計數據卡片 Widget
class StatisticsCard extends StatelessWidget {
  final int value;
  final String label;
  final IconData icon;
  final Color? color;
  final String? suffix;
  final bool showSparkle;

  const StatisticsCard({
    super.key,
    required this.value,
    required this.label,
    required this.icon,
    this.color,
    this.suffix,
    this.showSparkle = false,
  });

  @override
  Widget build(BuildContext context) {
    final displayColor = color ?? Colors.white.withOpacity(0.7);

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            displayColor.withOpacity(0.15),
            displayColor.withOpacity(0.05),
          ],
        ),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: displayColor.withOpacity(0.3),
          width: 1,
        ),
      ),
      child: Column(
        children: [
          Icon(icon, color: displayColor, size: 20),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                '$value',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              if (suffix != null) ...[
                const SizedBox(width: 2),
                Text(
                  suffix!,
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.6),
                    fontSize: 10,
                  ),
                ),
              ],
              if (showSparkle)
                const Padding(
                  padding: EdgeInsets.only(left: 4),
                  child: Text('✨', style: TextStyle(fontSize: 12)),
                ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              color: Colors.white.withOpacity(0.7),
              fontSize: 10,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
