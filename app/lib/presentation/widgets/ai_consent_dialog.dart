import 'package:flutter/material.dart';
import 'package:app/core/theme/app_colors.dart';
import 'package:url_launcher/url_launcher.dart';

class AiConsentDialog {
  /// Shows the AI consent dialog and returns true if the user grants consent.
  static Future<bool> show(BuildContext context) async {
    final colorScheme = Theme.of(context).colorScheme;
    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: colorScheme.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Icon(Icons.auto_awesome, color: AppColors.aiAccent, size: 24),
            const SizedBox(width: 8),
            Text(
              'AI 功能使用同意',
              style: TextStyle(
                color: colorScheme.onSurface,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '為了提供智慧任務分類功能，Zentropy 需要將您的資料傳送至 AI 服務進行處理。',
                style: TextStyle(
                  color: colorScheme.onSurface.withValues(alpha:0.8),
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                '傳送的資料包括：',
                style: TextStyle(
                  color: colorScheme.onSurface.withValues(alpha:0.7),
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              ...[
                '您輸入的文字內容',
                '任務名稱與描述',
                '專案名稱與主題名稱',
                '里程碑資訊',
              ].map((item) => Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '  \u2022  ',
                      style: TextStyle(
                        color: colorScheme.onSurface.withValues(alpha:0.6),
                        fontSize: 13,
                      ),
                    ),
                    Expanded(
                      child: Text(
                        item,
                        style: TextStyle(
                          color: colorScheme.onSurface.withValues(alpha:0.7),
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ],
                ),
              )),
              const SizedBox(height: 12),
              Text(
                '資料處理對象：Google Gemini API',
                style: TextStyle(
                  color: colorScheme.onSurface.withValues(alpha:0.7),
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '您的資料不會被用於訓練 AI 模型。',
                style: TextStyle(
                  color: colorScheme.onSurface.withValues(alpha:0.7),
                  fontSize: 12,
                ),
              ),
              const SizedBox(height: 16),
              GestureDetector(
                onTap: () {
                  launchUrl(
                    Uri.parse('https://zentropy.app/privacy'),
                    mode: LaunchMode.externalApplication,
                  );
                },
                child: Text(
                  '查看完整隱私政策 >',
                  style: TextStyle(
                    color: AppColors.aiAccent,
                    fontSize: 13,
                    decoration: TextDecoration.underline,
                    decorationColor: AppColors.aiAccent,
                  ),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text(
              '暫不使用',
              style: TextStyle(color: colorScheme.onSurface.withValues(alpha:0.7)),
            ),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.aiAccent,
            ),
            child: const Text('同意並使用'),
          ),
        ],
      ),
    );
    return result ?? false;
  }
}
