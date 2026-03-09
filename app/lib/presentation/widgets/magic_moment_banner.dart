import 'package:flutter/material.dart';

class MagicMomentBanner extends StatefulWidget {
  final Map<String, dynamic> data;
  final Future<void> Function() onRefocus;
  final VoidCallback onDismiss;

  const MagicMomentBanner({
    super.key,
    required this.data,
    required this.onRefocus,
    required this.onDismiss,
  });

  @override
  State<MagicMomentBanner> createState() => _MagicMomentBannerState();
}

class _MagicMomentBannerState extends State<MagicMomentBanner> {
  String get _stagnantName {
    final list = widget.data['stagnant_p0_products'] as List<dynamic>? ?? [];
    if (list.isEmpty) return 'P0 Project';
    return (list.first as Map<String, dynamic>)['name'] as String? ?? 'P0 Project';
  }

  Map<String, dynamic>? get _topMomentum {
    final list = widget.data['momentum_products'] as List<dynamic>? ?? [];
    if (list.isEmpty) return null;
    return list
        .cast<Map<String, dynamic>>()
        .reduce((best, cur) =>
            (cur['completed_count'] as int) > (best['completed_count'] as int) ? cur : best);
  }

  Future<void> _handleRefocus() async {
    await widget.onRefocus();
  }

  @override
  Widget build(BuildContext context) {
    final momentum = _topMomentum;
    if (momentum == null) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Colors.amber.withValues(alpha: 0.25),
            Colors.orange.withValues(alpha: 0.15),
          ],
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.amber.withValues(alpha: 0.4)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 圖示
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: Colors.amber.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.bolt, color: Colors.amber, size: 20),
            ),
            const SizedBox(width: 12),
            // 文字區
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    '動能偵測：焦點已轉移',
                    style: TextStyle(
                      color: Colors.amber,
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '「${momentum['name']}」近 7 天完成了 ${momentum['completed_count']} 項，'
                    '但「$_stagnantName」(P0) 已超過 5 天無進展',
                    style: TextStyle(
                      color: Colors.amber.withValues(alpha: 0.75),
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 10),
                  // 立即查看按鈕
                  GestureDetector(
                    onTap: _handleRefocus,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.amber.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.amber.withValues(alpha: 0.4)),
                      ),
                      child: const Text(
                        '立即查看 →',
                        style: TextStyle(color: Colors.amber, fontSize: 12),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            // 關閉按鈕
            GestureDetector(
              onTap: widget.onDismiss,
              child: Icon(Icons.close, color: Colors.white.withValues(alpha: 0.4), size: 18),
            ),
          ],
        ),
      ),
    );
  }
}
