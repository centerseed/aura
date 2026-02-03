import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:app/domain/entities/task.dart' as entity;
import 'package:app/domain/entities/brain_dump_result.dart';
import 'package:speech_to_text/speech_to_text.dart';
import 'package:speech_to_text/speech_recognition_result.dart';
import '../../../core/di/providers.dart';
import '../../providers/task_provider.dart';
import '../../providers/product_provider.dart';
import '../../providers/area_provider.dart';
import '../dashboard/widgets/task_edit_bottom_sheet.dart';

class CaptureScreen extends ConsumerStatefulWidget {
  const CaptureScreen({super.key});

  @override
  ConsumerState<CaptureScreen> createState() => _CaptureScreenState();
}

class _CaptureScreenState extends ConsumerState<CaptureScreen> {
  final TextEditingController _textController = TextEditingController();
  final FocusNode _focusNode = FocusNode();

  bool _isVoiceMode = false;
  String? _selectedProductId;
  String? _selectedAreaId;
  bool _isProcessing = false;

  @override
  void dispose() {
    _textController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final text = _textController.text.trim();
    if (text.isEmpty) return;

    setState(() {
      _isProcessing = true;
    });

    try {
      final repo = ref.read(brainDumpRepositoryProvider);

      String finalText = text;
      if (_selectedProductId != null) {
        final products = ref.read(productsUnwrappedProvider).valueOrNull;
        final product = products?.firstWhere((p) => p.id == _selectedProductId);
        if (product != null) {
          finalText = "#${product.name} $text"; // Simple formatting strategy
        }
      }

      final result = await repo.submit(finalText);

      result.fold(
        (fail) {
          if (mounted) {
            ScaffoldMessenger.of(
              context,
            ).showSnackBar(SnackBar(content: Text('Error: ${fail.message}')));
          }
        },
        (brainDumpResult) {
          if (mounted) {
            _textController.clear();
            // repository 會自動靜默刷新快取
            // Dismiss keyboard
            FocusScope.of(context).unfocus();

            // Show results sheet
            _showBrainDumpResults(brainDumpResult.items);
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

  void _showBrainDumpResults(List<BrainDumpResultItem> items) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1c1c1e),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      isScrollControlled: true,
      builder: (context) {
        return DraggableScrollableSheet(
          initialChildSize: 0.6,
          minChildSize: 0.4,
          maxChildSize: 0.9,
          expand: false,
          builder: (context, scrollController) {
            return Column(
              children: [
                // Handle bar
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey[600],
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Row(
                    children: [
                      const Icon(Icons.auto_awesome, color: Color(0xFF6C63FF)),
                      const SizedBox(width: 8),
                      Text(
                        'AI 分析結果',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        '${items.length} 個任務',
                        style: TextStyle(color: Colors.grey[400]),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView.separated(
                    controller: scrollController,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    itemCount: items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final item = items[index];
                      return Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.05),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: Colors.white.withOpacity(0.1),
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.title,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            if (item.narrative.isNotEmpty &&
                                item.narrative != item.title) ...[
                              const SizedBox(height: 4),
                              Text(
                                item.narrative,
                                style: TextStyle(
                                  color: Colors.white.withOpacity(0.6),
                                  fontSize: 13,
                                ),
                              ),
                            ],
                            const SizedBox(height: 12),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                // Area/Product Tag
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: const Color(
                                      0xFF6C63FF,
                                    ).withOpacity(0.2),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        Icons.folder_outlined,
                                        size: 12,
                                        color: const Color(0xFF8B85FF),
                                      ),
                                      const SizedBox(width: 4),
                                      Text(
                                        '${item.areaName} / ${item.productName}',
                                        style: const TextStyle(
                                          color: Color(0xFF8B85FF),
                                          fontSize: 11,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                // Due Date Tag
                                if (item.dueDate != null)
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                      vertical: 4,
                                    ),
                                    decoration: BoxDecoration(
                                      color: Colors.orange.withOpacity(0.2),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(
                                          Icons.calendar_today_outlined,
                                          size: 12,
                                          color: Colors.orange[300],
                                        ),
                                        const SizedBox(width: 4),
                                        Text(
                                          "${item.dueDate!.month}/${item.dueDate!.day}",
                                          style: TextStyle(
                                            color: Colors.orange[300],
                                            fontSize: 11,
                                            fontWeight: FontWeight.w500,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                              ],
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: () => Navigator.pop(context),
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF6C63FF),
                        padding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                      child: const Text('完成'),
                    ),
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }

  final SpeechToText _speechToText = SpeechToText();
  bool _speechEnabled = false;
  String _lastWords = '';

  @override
  void initState() {
    super.initState();
    _initSpeech();
  }

  /// This has to happen only once per app
  void _initSpeech() async {
    _speechEnabled = await _speechToText.initialize();
    setState(() {});
  }

  /// Each time to start a speech recognition session
  void _startListening() async {
    if (!_speechEnabled) {
      _initSpeech();
      return;
    }

    await _speechToText.listen(
      onResult: _onSpeechResult,
      localeId:
          "zh_TW", // Default to Traditional Chinese, or make it configurable
    );
    setState(() {});
  }

  /// Manually stop the active speech recognition session
  void _stopListening() async {
    await _speechToText.stop();
    setState(() {});
  }

  /// This is the callback that the SpeechToText plugin calls when
  /// the platform returns recognized words.
  void _onSpeechResult(SpeechRecognitionResult result) {
    setState(() {
      _lastWords = result.recognizedWords;
      // You might want to append to existing text or replace it.
      // For a "Capture" mode, replacing usually makes sense if it's a fresh capture,
      // but if the user typed something, maybe append?
      // Let's replace for now as per typical "voice mode" overlay behavior,
      // or append if the user intended to dictate.
      // Given the UI shows a separate Voice Mode overlay, let's treat it as "Drafting"
      // and when finished, we'll put it into the text field.
      // actually, let's just update the controller directly so the user sees it?
      // But we are in a separate view state (_isVoiceMode = true).
      // Let's store it in _lastWords and put it in controller when switching back or submitting.
    });
  }

  void _toggleMode() {
    setState(() {
      _isVoiceMode = !_isVoiceMode;
    });

    if (_isVoiceMode) {
      if (_speechEnabled) {
        _startListening();
      } else {
        // Try initializing again if it failed or wasn't ready
        _initSpeech();
        // Give it a moment or show error
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('語音辨識初始化中，請稍後再試...')));
        // Toggle back off if not ready to avoid stuck state
        setState(() => _isVoiceMode = false);
      }
    } else {
      _stopListening();
      // When exiting voice mode, put the recognized text into the controller
      if (_lastWords.isNotEmpty) {
        // Append or replace? Let's append with a space if there is content
        if (_textController.text.isNotEmpty) {
          _textController.text += " $_lastWords";
        } else {
          _textController.text = _lastWords;
        }
        _lastWords = ''; // Clear for next time
      }
      _focusNode.requestFocus();
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        // 點擊空白區域關閉鍵盤
        FocusScope.of(context).unfocus();
      },
      child: Container(
        // Premium gradient background (matching web quality)
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFF0D1117), // Deep dark blue (GitHub dark)
              Color(0xFF161B22), // Slightly lighter
              Color(0xFF1A1F2E), // With purple tint
            ],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              // ==================== 1. Top Section: Selectors ====================
              Expanded(
                child: SingleChildScrollView(
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16.0,
                    vertical: 16.0,
                  ),
                  child: Consumer(
                    builder: (context, ref, child) {
                      final areasAsync = ref.watch(areasUnwrappedProvider);
                      final productsAsync = ref.watch(productsUnwrappedProvider);
                      final taskState = ref.watch(activeTasksProvider);

                      Widget buildTaskItem(entity.Task task) {
                        return GestureDetector(
                          onTap: () {
                            showModalBottomSheet(
                              context: context,
                              backgroundColor: Colors.transparent,
                              isScrollControlled: true,
                              builder: (context) => Padding(
                                padding: EdgeInsets.only(
                                  bottom: MediaQuery.of(context).viewInsets.bottom,
                                ),
                                child: TaskEditBottomSheet(task: task),
                              ),
                            );
                          },
                          child: Container(
                            margin: const EdgeInsets.only(bottom: 12),
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.05),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: Colors.white.withOpacity(0.1),
                              ),
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        task.content,
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 14,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                    const SizedBox(height: 4),
                                    Row(
                                      children: [
                                        if (task.areaName != null) ...[
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 6,
                                              vertical: 2,
                                            ),
                                            decoration: BoxDecoration(
                                              color: Colors.grey.withOpacity(
                                                0.2,
                                              ),
                                              borderRadius:
                                                  BorderRadius.circular(4),
                                            ),
                                            child: Text(
                                              task.areaName!,
                                              style: TextStyle(
                                                color: Colors.grey[300],
                                                fontSize: 10,
                                              ),
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                        ],
                                        if (task.productName != null)
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 6,
                                              vertical: 2,
                                            ),
                                            decoration: BoxDecoration(
                                              color: Colors.blue.withOpacity(
                                                0.2,
                                              ),
                                              borderRadius:
                                                  BorderRadius.circular(4),
                                            ),
                                            child: Text(
                                              task.productName!,
                                              style: TextStyle(
                                                color: Colors.blue[200],
                                                fontSize: 10,
                                              ),
                                            ),
                                          ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                              if (task.dueDate != null)
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 6,
                                    vertical: 2,
                                  ),
                                  decoration: BoxDecoration(
                                    color: Colors.orange.withOpacity(0.2),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    "${task.dueDate!.month}/${task.dueDate!.day}",
                                    style: TextStyle(
                                      color: Colors.orange[300],
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      }

                      return areasAsync.when(
                        data: (areas) {
                          // Prepare Today's Tasks
                          final now = DateTime.now();
                          List<entity.Task> todayTasks = [];
                          if (taskState.hasData) {
                            todayTasks = taskState.tasks!.where((t) {
                              if (t.createdAt == null) return false;
                              final d = t.createdAt!.toLocal();
                              return d.year == now.year &&
                                  d.month == now.month &&
                                  d.day == now.day;
                            }).toList();
                            todayTasks.sort(
                              (a, b) => (b.createdAt ?? DateTime(0)).compareTo(
                                a.createdAt ?? DateTime(0),
                              ),
                            );
                          }

                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Area Selector (Horizontal)
                              Text(
                                '身份地圖',
                                style: Theme.of(context).textTheme.labelSmall
                                    ?.copyWith(
                                      color: Colors.grey,
                                      letterSpacing: 1.0,
                                      fontWeight: FontWeight.bold,
                                    ),
                              ),
                              const SizedBox(height: 12),
                              SingleChildScrollView(
                                scrollDirection: Axis.horizontal,
                                child: Row(
                                  children: areas.map((area) {
                                    final isSelected =
                                        _selectedAreaId == area.id;
                                    return Padding(
                                      padding: const EdgeInsets.only(
                                        right: 8.0,
                                      ),
                                      child: _buildChip(
                                        context: context,
                                        label: area.name,
                                        isSelected: isSelected,
                                        onTap: () {
                                          setState(() {
                                            _selectedAreaId = isSelected
                                                ? null
                                                : area.id;
                                            _selectedProductId = null;
                                          });
                                        },
                                      ),
                                    );
                                  }).toList(),
                                ),
                              ),

                              const SizedBox(height: 24),

                              // Project Selector
                              if (_selectedAreaId != null) ...[
                                Text(
                                  '專案',
                                  style: Theme.of(context).textTheme.labelSmall
                                      ?.copyWith(
                                        color: Colors.grey,
                                        letterSpacing: 1.0,
                                        fontWeight: FontWeight.bold,
                                      ),
                                ),
                                const SizedBox(height: 12),
                                productsAsync.when(
                                  data: (products) {
                                    final areaProducts = products
                                        .where(
                                          (p) => p.areaId == _selectedAreaId,
                                        )
                                        .toList();

                                    if (areaProducts.isEmpty) {
                                      return const Padding(
                                        padding: EdgeInsets.symmetric(
                                          vertical: 8.0,
                                        ),
                                        child: Text(
                                          'No projects in this area',
                                          style: TextStyle(color: Colors.grey),
                                        ),
                                      );
                                    }

                                    return Wrap(
                                      spacing: 8.0,
                                      runSpacing: 8.0,
                                      children: areaProducts.map((product) {
                                        final isSelected =
                                            _selectedProductId == product.id;
                                        return _buildChip(
                                          context: context,
                                          label: product.name,
                                          isSelected: isSelected,
                                          onTap: () {
                                            setState(() {
                                              _selectedProductId = isSelected
                                                  ? null
                                                  : product.id;
                                            });
                                          },
                                        );
                                      }).toList(),
                                    );
                                  },
                                  loading: () =>
                                      const LinearProgressIndicator(),
                                  error: (_, __) =>
                                      const Text('Error loading projects'),
                                ),
                              ],

                              const SizedBox(height: 32),

                              // Placeholder (Always visible when no area selected, or maybe always?)
                              // User request: "Still show input prompt"
                              if (_selectedAreaId == null) ...[
                                SizedBox(
                                  height: 120,
                                  child: Center(
                                    child: Column(
                                      mainAxisAlignment:
                                          MainAxisAlignment.center,
                                      children: [
                                        Icon(
                                          Icons.auto_awesome_outlined,
                                          color: Colors.white.withOpacity(0.3),
                                          size: 28,
                                        ),
                                        const SizedBox(height: 12),
                                        Text(
                                          '直接輸入即可，AI 會自動歸類',
                                          style: TextStyle(
                                            color: Colors.white.withOpacity(
                                              0.5,
                                            ),
                                            fontSize: 14,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          '或選擇 Area 後指定專案',
                                          style: TextStyle(
                                            color: Colors.white.withOpacity(
                                              0.3,
                                            ),
                                            fontSize: 12,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 24),
                              ],

                              // Today's Tasks List
                              if (todayTasks.isNotEmpty) ...[
                                Row(
                                  children: [
                                    Icon(
                                      Icons.history,
                                      size: 16,
                                      color: Colors.grey[400],
                                    ),
                                    const SizedBox(width: 8),
                                    Text(
                                      '今日新增 (${todayTasks.length})',
                                      style: Theme.of(context)
                                          .textTheme
                                          .labelSmall
                                          ?.copyWith(
                                            color: Colors.grey[400],
                                            letterSpacing: 0.5,
                                            fontWeight: FontWeight.bold,
                                          ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 16),
                                ...todayTasks
                                    .map((task) => buildTaskItem(task))
                                    .toList(),
                                // Add generous bottom padding for scrolling past bottom bar
                                const SizedBox(height: 80),
                              ],
                            ],
                          );
                        },
                        loading: () => const LinearProgressIndicator(),
                        error: (err, stack) => Text('Error: $err'),
                      );
                    },
                  ),
                ),
              ),
            ),

            // ==================== 2. Bottom Section: Input & Action ====================
            ClipRRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    // Glassmorphism bottom bar
                    color: const Color(0xFF1A1F2E).withOpacity(0.8),
                    border: Border(
                      top: BorderSide(
                        color: Colors.white.withOpacity(0.1),
                        width: 1,
                      ),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.3),
                        blurRadius: 20,
                        offset: const Offset(0, -5),
                      ),
                    ],
                  ),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    height: _isVoiceMode ? 200 : null,
                    child: _isVoiceMode
                        ? Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                _lastWords.isNotEmpty
                                    ? _lastWords
                                    : "Listening...",
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                  fontSize: 18,
                                ),
                              ),
                              const SizedBox(height: 16),
                              GestureDetector(
                                onTap: _toggleMode,
                                child: Container(
                                  width: 80,
                                  height: 80,
                                  decoration: BoxDecoration(
                                    color: Colors.redAccent,
                                    shape: BoxShape.circle,
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.redAccent.withOpacity(
                                          0.4,
                                        ),
                                        blurRadius: 20,
                                        spreadRadius: 5,
                                      ),
                                    ],
                                  ),
                                  child: const Icon(
                                    Icons.mic,
                                    color: Colors.white,
                                    size: 40,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 16),
                              TextButton(
                                onPressed: _toggleMode,
                                child: const Text("Cancel"),
                              ),
                            ],
                          )
                        : Row(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              // Input Field with glassmorphism
                              Expanded(
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: Colors.white.withOpacity(0.05),
                                    borderRadius: BorderRadius.circular(24),
                                    border: Border.all(
                                      color: Colors.white.withOpacity(0.1),
                                    ),
                                  ),
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 16,
                                  ),
                                  child: TextField(
                                    controller: _textController,
                                    focusNode: _focusNode,
                                    maxLines: 5,
                                    minLines: 1,
                                    style: const TextStyle(color: Colors.white),
                                    decoration: InputDecoration(
                                      border: InputBorder.none,
                                      hintText: "Type text...",
                                      hintStyle: TextStyle(
                                        color: Colors.white.withOpacity(0.4),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),

                              // Action Button (Mic or Send) with glow
                              ValueListenableBuilder<TextEditingValue>(
                                valueListenable: _textController,
                                builder: (context, value, child) {
                                  final hasText = value.text.trim().isNotEmpty;
                                  return GestureDetector(
                                    onTap: hasText
                                        ? (_isProcessing ? null : _submit)
                                        : _toggleMode,
                                    child: Container(
                                      width: 48,
                                      height: 48,
                                      decoration: BoxDecoration(
                                        gradient: LinearGradient(
                                          colors: hasText
                                              ? [
                                                  const Color(0xFF7C3AED),
                                                  const Color(0xFF5B21B6),
                                                ]
                                              : [
                                                  const Color(0xFFEC4899),
                                                  const Color(0xFFBE185D),
                                                ],
                                        ),
                                        shape: BoxShape.circle,
                                        boxShadow: [
                                          BoxShadow(
                                            color:
                                                (hasText
                                                        ? const Color(
                                                            0xFF7C3AED,
                                                          )
                                                        : const Color(
                                                            0xFFEC4899,
                                                          ))
                                                    .withOpacity(0.4),
                                            blurRadius: 12,
                                            spreadRadius: 0,
                                          ),
                                        ],
                                      ),
                                      child: _isProcessing
                                          ? const Center(
                                              child: SizedBox(
                                                width: 20,
                                                height: 20,
                                                child:
                                                    CircularProgressIndicator(
                                                      color: Colors.white,
                                                      strokeWidth: 2,
                                                    ),
                                              ),
                                            )
                                          : Icon(
                                              hasText
                                                  ? Icons.send_rounded
                                                  : Icons.mic_rounded,
                                              color: Colors.white,
                                              size: 22,
                                            ),
                                    ),
                                  );
                                },
                              ),
                            ],
                          ),
                  ),
                ),
              ),
            ),
            SizedBox(height: 100 + MediaQuery.of(context).viewInsets.bottom), // Padding to clear Floating Nav Bar and keyboard
          ],
        ),
      ),
      ),
    );
  }

  Widget _buildChip({
    required BuildContext context,
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    // Web version's indigo blue color (lower saturation & brightness)
    const indigoBlue = Color(0xFF4B4B99); // Muted, darker indigo

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeInOut,
        decoration: BoxDecoration(
          // Glassmorphism: semi-transparent with blur
          color: isSelected ? indigoBlue : Colors.white.withOpacity(0.05),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected
                ? indigoBlue.withOpacity(0.8)
                : Colors.white.withOpacity(0.15),
            width: 1,
          ),
          // Subtle indigo glow for selected state (matching web)
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: indigoBlue.withOpacity(0.25),
                    blurRadius: 8,
                    spreadRadius: 0,
                  ),
                ]
              : [],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
            child: Container(
              height: 40,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              alignment: Alignment.center,
              child: Text(
                label,
                style: TextStyle(
                  color: isSelected
                      ? Colors.white
                      : Colors.white.withOpacity(0.9),
                  fontSize: 14,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                  letterSpacing: 0.3,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
