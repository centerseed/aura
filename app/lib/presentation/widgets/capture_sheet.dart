import 'package:flutter/material.dart';
import 'package:app/core/theme/app_colors.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:app/core/di/providers.dart';
import 'package:app/presentation/providers/task_provider.dart';

class CaptureSheet extends ConsumerStatefulWidget {
  const CaptureSheet({super.key});

  @override
  ConsumerState<CaptureSheet> createState() => _CaptureSheetState();
}

class _CaptureSheetState extends ConsumerState<CaptureSheet> {
  final TextEditingController _controller = TextEditingController();
  bool _isProcessing = false;

  Future<void> _submit() async {
    final text = _controller.text.trim();
    if (text.isEmpty) return;

    setState(() {
      _isProcessing = true;
    });

    try {
      final repo = ref.read(brainDumpRepositoryProvider);

      final result = await repo.submit(text);

      result.fold(
        (fail) {
          if (mounted) {
            ScaffoldMessenger.of(
              context,
            ).showSnackBar(SnackBar(content: Text('Error: ${fail.message}')));
          }
        },
        (_) async {
          // 觸發靜默刷新以載入新建立的任務
          await silentRefreshTasks(ref);

          if (mounted) {
            Navigator.pop(context); // Close sheet
            if (mounted) {
              ScaffoldMessenger.of(
                context,
              ).showSnackBar(const SnackBar(content: Text('已透過 AI 建立任務！')));
            }
          }
        },
      );
    } finally {
      if (mounted) {
        setState(() {
          _isProcessing = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
        left: 16,
        right: 16,
        top: 16,
      ),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min, // Auto height
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Text(
                "捕捉想法 (Brain Dump)",
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const Spacer(),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close),
              ),
            ],
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _controller,
            autofocus: true,
            decoration: const InputDecoration(
              hintText: "提醒我...",
              border: OutlineInputBorder(),
            ),
            maxLines: 3,
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              IconButton(
                onPressed: () {
                  // TODO: Voice Trigger
                  ScaffoldMessenger.of(
                    context,
                  ).showSnackBar(const SnackBar(content: Text("語音功能即將推出")));
                },
                icon: const Icon(Icons.mic, color: Colors.redAccent),
                tooltip: "語音輸入",
              ),
              const Spacer(),
              FilledButton.icon(
                onPressed: _isProcessing ? null : _submit,
                icon: _isProcessing
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.send),
                label: const Text("送出"),
              ),
            ],
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}
