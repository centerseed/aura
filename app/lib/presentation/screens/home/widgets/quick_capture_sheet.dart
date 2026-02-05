import 'package:dartz/dartz.dart' hide Task;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:speech_to_text/speech_to_text.dart';
import 'package:speech_to_text/speech_recognition_result.dart';

import '../../../../core/di/providers.dart';
import '../../../../core/errors/failures.dart';
import '../../../../domain/entities/task.dart';
import '../../../../domain/entities/area.dart';
import '../../../../domain/entities/product.dart';
import '../../../providers/task_provider.dart';
import '../../../providers/area_provider.dart';
import '../../../providers/product_provider.dart';
import '../../dashboard/widgets/task_edit_bottom_sheet.dart';

/// 對話訊息類型
enum MessageType { user, ai }

/// 對話訊息
class ChatMessage {
  final String content;
  final MessageType type;
  final Task? task; // AI 回覆時附帶的分類結果
  final List<String>? taskIds; // AI 回覆時創建的任務 IDs (用於編輯按鈕)

  const ChatMessage({
    required this.content,
    required this.type,
    this.task,
    this.taskIds,
  });
}

/// 快速新增任務的底部彈窗 - 對話式界面
class QuickCaptureSheet extends ConsumerStatefulWidget {
  const QuickCaptureSheet({super.key});

  @override
  ConsumerState<QuickCaptureSheet> createState() => _QuickCaptureSheetState();
}

class _QuickCaptureSheetState extends ConsumerState<QuickCaptureSheet> {
  final _textController = TextEditingController();
  final _scrollController = ScrollController();
  final List<ChatMessage> _messages = [];
  bool _isLoading = false;
  String? _selectedAreaId;
  String? _selectedProductId;

  // 語音輸入相關
  final SpeechToText _speechToText = SpeechToText();
  bool _speechEnabled = false;
  bool _isVoiceMode = false;
  String _lastWords = '';

  @override
  void initState() {
    super.initState();
    _initSpeech();
  }

  /// 初始化語音辨識
  void _initSpeech() async {
    _speechEnabled = await _speechToText.initialize();
    if (mounted) setState(() {});
  }

  /// 開始語音辨識
  void _startListening() async {
    if (!_speechEnabled) {
      _initSpeech();
      return;
    }

    await _speechToText.listen(
      onResult: _onSpeechResult,
      localeId: 'zh_TW',
    );
    if (mounted) setState(() {});
  }

  /// 停止語音辨識
  void _stopListening() async {
    await _speechToText.stop();
    if (mounted) setState(() {});
  }

  /// 語音辨識結果回調
  void _onSpeechResult(SpeechRecognitionResult result) {
    setState(() {
      _lastWords = result.recognizedWords;
    });
  }

  /// 切換語音/文字模式
  void _toggleVoiceMode() {
    HapticFeedback.mediumImpact();
    setState(() {
      _isVoiceMode = !_isVoiceMode;
    });

    if (_isVoiceMode) {
      if (_speechEnabled) {
        _startListening();
      } else {
        _initSpeech();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('語音辨識初始化中，請稍後再試...')),
        );
        setState(() => _isVoiceMode = false);
      }
    } else {
      _stopListening();
      // 將辨識結果放入文字輸入框
      if (_lastWords.isNotEmpty) {
        if (_textController.text.isNotEmpty) {
          _textController.text += ' $_lastWords';
        } else {
          _textController.text = _lastWords;
        }
        _lastWords = '';
      }
    }
  }

  @override
  void dispose() {
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final text = _textController.text.trim();
    if (text.isEmpty) return;

    // 構建完整訊息(包含 @ mention)
    final fullMessage = _buildUserMessage(text);

    setState(() {
      _messages.add(ChatMessage(
        content: fullMessage,
        type: MessageType.user,
      ));
      _isLoading = true;
    });

    _textController.clear();
    _scrollToBottom();

    // 呼叫 API 創建任務 - 使用 Brain Dump AI 自動分類
    // 傳送包含 @ mention 的完整訊息給 AI
    final repo = ref.read(brainDumpRepositoryProvider);
    final result = await repo.submit(fullMessage);

    result.fold(
      (failure) {
        setState(() {
          _isLoading = false;
          _messages.add(ChatMessage(
            content: '處理失敗：${failure.message}',
            type: MessageType.ai,
          ));
        });
      },
      (brainDumpResult) {
        setState(() {
          _isLoading = false;

          // 構建 AI 回應訊息,顯示每個任務的分類理由
          final buffer = StringBuffer();
          for (var i = 0; i < brainDumpResult.items.length; i++) {
            final item = brainDumpResult.items[i];
            if (i > 0) buffer.write('\n\n');

            buffer.write('✓ ${item.title}\n');
            buffer.write('📁 ${item.productName}');
            if (item.topicName != null && item.topicName!.isNotEmpty) {
              buffer.write(' / ${item.topicName}');
            }

            if (item.reasoning != null && item.reasoning!.isNotEmpty) {
              buffer.write('\n💡 ${item.reasoning}');
            }
          }

          // 收集所有創建的任務 IDs
          final taskIds = brainDumpResult.items.map((item) => item.id).toList();

          _messages.add(ChatMessage(
            content: buffer.toString(),
            type: MessageType.ai,
            taskIds: taskIds,
          ));
        });
        // 刷新任務快取，讓今日/全視圖頁面立即顯示新任務
        refreshTasks(ref);
        HapticFeedback.mediumImpact();
      },
    );

    _scrollToBottom();
  }

  String _buildUserMessage(String text) {
    if (_selectedProductId != null || _selectedAreaId != null) {
      final productsResult = ref.read(productsProvider).valueOrNull;
      final areasResult = ref.read(areasProvider).valueOrNull;

      String? productName;
      String? areaName;

      if (_selectedProductId != null && productsResult != null) {
        productsResult.fold(
          (_) {},
          (products) {
            final product = products.where((p) => p.id == _selectedProductId).firstOrNull;
            productName = product?.name;
          },
        );
      }

      if (_selectedAreaId != null && areasResult != null) {
        areasResult.fold(
          (_) {},
          (areas) {
            final area = areas.where((a) => a.id == _selectedAreaId).firstOrNull;
            areaName = area?.name;
          },
        );
      }

      if (productName != null) {
        return '$text\n\n@ $productName';
      } else if (areaName != null) {
        return '$text\n\n@ $areaName';
      }
    }
    return text;
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final screenHeight = MediaQuery.of(context).size.height;
    final areasAsync = ref.watch(areasProvider);
    final productsAsync = ref.watch(productsProvider);

    return Container(
      height: screenHeight * 0.8,
      decoration: const BoxDecoration(
        color: Color(0xFF161B22),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // 拖曳指示器
          Padding(
            padding: const EdgeInsets.only(top: 12, bottom: 8),
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // 標籤選擇器
          _buildAreaSelector(areasAsync),

          // Product 選擇器 (當選擇了 Area 時顯示)
          if (_selectedAreaId != null) _buildProductSelector(productsAsync),

          // 說明文字
          _buildInstructions(),

          // 對話紀錄區域
          Expanded(
            child: _buildChatArea(),
          ),

          // 輸入區域
          _buildInputArea(),

          // 安全區域
          SizedBox(height: MediaQuery.of(context).viewInsets.bottom),
        ],
      ),
    );
  }

  Widget _buildAreaSelector(
      AsyncValue<Either<Failure, List<Area>>> areasAsync) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '身份地圖',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.6),
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 8),
          areasAsync.when(
            data: (either) => either.fold(
              (failure) => const Text('載入失敗',
                  style: TextStyle(color: Colors.red)),
              (areas) => SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: areas.map((area) {
                    final isSelected = _selectedAreaId == area.id;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: _buildAreaChip(area, isSelected),
                    );
                  }).toList(),
                ),
              ),
            ),
            loading: () => const SizedBox(
              height: 40,
              child: Center(
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Color(0xFF6C63FF),
                  ),
                ),
              ),
            ),
            error: (_, __) => const Text('載入失敗',
                style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  Widget _buildProductSelector(
      AsyncValue<Either<Failure, List<Product>>> productsAsync) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.subdirectory_arrow_right,
                size: 16,
                color: Colors.white.withValues(alpha: 0.4),
              ),
              const SizedBox(width: 4),
              Text(
                '選擇專案',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.6),
                  fontSize: 12,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          productsAsync.when(
            data: (either) => either.fold(
              (failure) => const Text('載入失敗',
                  style: TextStyle(color: Colors.red)),
              (products) {
                // 過濾出屬於選中 Area 的 Products
                final filteredProducts = products
                    .where((p) => p.areaId == _selectedAreaId)
                    .toList();

                if (filteredProducts.isEmpty) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Text(
                      '此領域尚無專案',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.4),
                        fontSize: 14,
                      ),
                    ),
                  );
                }

                return SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: filteredProducts.map((product) {
                      final isSelected = _selectedProductId == product.id;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: _buildProductChip(product, isSelected),
                      );
                    }).toList(),
                  ),
                );
              },
            ),
            loading: () => const SizedBox(
              height: 40,
              child: Center(
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Color(0xFF6C63FF),
                  ),
                ),
              ),
            ),
            error: (_, __) => const Text('載入失敗',
                style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  Widget _buildAreaChip(Area area, bool isSelected) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        setState(() {
          if (isSelected) {
            _selectedAreaId = null;
            _selectedProductId = null; // 清除 Product 選擇
          } else {
            _selectedAreaId = area.id;
            _selectedProductId = null; // 切換 Area 時清除 Product 選擇
          }
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected
              ? const Color(0xFF6C63FF).withValues(alpha: 0.2)
              : Colors.white.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected
                ? const Color(0xFF6C63FF)
                : Colors.white.withValues(alpha: 0.15),
            width: 1,
          ),
        ),
        child: Text(
          area.name,
          style: TextStyle(
            color: isSelected ? const Color(0xFF6C63FF) : Colors.white,
            fontSize: 14,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
          ),
        ),
      ),
    );
  }

  Widget _buildProductChip(Product product, bool isSelected) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        setState(() {
          _selectedProductId = isSelected ? null : product.id;
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected
              ? const Color(0xFF10B981).withValues(alpha: 0.2)
              : Colors.white.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected
                ? const Color(0xFF10B981)
                : Colors.white.withValues(alpha: 0.15),
            width: 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.folder_outlined,
              size: 14,
              color: isSelected
                  ? const Color(0xFF10B981)
                  : Colors.white.withValues(alpha: 0.6),
            ),
            const SizedBox(width: 6),
            Text(
              product.name,
              style: TextStyle(
                color: isSelected ? const Color(0xFF10B981) : Colors.white,
                fontSize: 13,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInstructions() {
    if (_messages.isNotEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      child: Column(
        children: [
          Icon(
            Icons.auto_awesome,
            size: 32,
            color: Colors.white.withValues(alpha: 0.3),
          ),
          const SizedBox(height: 12),
          Text(
            '直接輸入即可，AI 會自動歸類',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.6),
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '或選擇 Area 後指定專案',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.4),
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildChatArea() {
    if (_messages.isEmpty) {
      return const SizedBox.shrink();
    }

    return ListView.builder(
      controller: _scrollController,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      itemCount: _messages.length + (_isLoading ? 1 : 0),
      itemBuilder: (context, index) {
        if (index == _messages.length && _isLoading) {
          return _buildLoadingBubble();
        }
        return _buildMessageBubble(_messages[index]);
      },
    );
  }

  Widget _buildMessageBubble(ChatMessage message) {
    final isUser = message.type == MessageType.user;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment:
            isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment:
                isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (!isUser) ...[
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: const Color(0xFF6C63FF).withValues(alpha: 0.2),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.auto_awesome,
                    size: 16,
                    color: Color(0xFF6C63FF),
                  ),
                ),
                const SizedBox(width: 8),
              ],
              Flexible(
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: isUser
                        ? const Color(0xFF6C63FF)
                        : Colors.white.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(16),
                      topRight: const Radius.circular(16),
                      bottomLeft: Radius.circular(isUser ? 16 : 4),
                      bottomRight: Radius.circular(isUser ? 4 : 16),
                    ),
                  ),
                  child: Text(
                    message.content,
                    style: TextStyle(
                      color: isUser ? Colors.white : Colors.white.withValues(alpha: 0.9),
                      fontSize: 15,
                      height: 1.4,
                    ),
                  ),
                ),
              ),
              if (isUser) ...[
                const SizedBox(width: 8),
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.person,
                    size: 16,
                    color: Colors.white.withValues(alpha: 0.6),
                  ),
                ),
              ],
            ],
          ),
          // AI 回應且有任務 IDs 時，顯示編輯按鈕
          if (!isUser && message.taskIds != null && message.taskIds!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.only(left: 40),
              child: Wrap(
                spacing: 8,
                runSpacing: 6,
                children: message.taskIds!.map((taskId) {
                  return _buildEditButton(taskId);
                }).toList(),
              ),
            ),
          ],
        ],
      ),
    );
  }

  /// 建立編輯任務按鈕
  Widget _buildEditButton(String taskId) {
    return InkWell(
      onTap: () => _handleEditTask(taskId),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: const Color(0xFF6C63FF).withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: const Color(0xFF6C63FF).withValues(alpha: 0.3),
            width: 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.edit,
              size: 14,
              color: const Color(0xFF6C63FF).withValues(alpha: 0.9),
            ),
            const SizedBox(width: 4),
            Text(
              '編輯',
              style: TextStyle(
                fontSize: 12,
                color: const Color(0xFF6C63FF).withValues(alpha: 0.9),
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// 處理編輯任務操作
  Future<void> _handleEditTask(String taskId) async {
    // 從 provider 獲取所有任務 (TaskDataState)
    final taskState = ref.read(activeTasksProvider);

    if (!taskState.hasData) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(taskState.error ?? '載入中...')),
        );
      }
      return;
    }

    // 查找對應的任務
    final task = taskState.tasks!.where((t) => t.id == taskId).firstOrNull;

    if (task == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('找不到任務')),
        );
      }
      return;
    }

    // 先關閉對話框
    if (mounted) {
      Navigator.pop(context);
    }

    // 延遲一下再顯示編輯畫面，避免動畫衝突
    await Future.delayed(const Duration(milliseconds: 100));

    if (mounted) {
      // 顯示編輯 BottomSheet
      await showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (context) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom,
          ),
          child: TaskEditBottomSheet(task: task),
        ),
      );
    }
  }

  Widget _buildLoadingBubble() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: const Color(0xFF6C63FF).withValues(alpha: 0.2),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.auto_awesome,
              size: 16,
              color: Color(0xFF6C63FF),
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.08),
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(16),
                topRight: Radius.circular(16),
                bottomLeft: Radius.circular(4),
                bottomRight: Radius.circular(16),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _buildTypingDot(0),
                const SizedBox(width: 4),
                _buildTypingDot(1),
                const SizedBox(width: 4),
                _buildTypingDot(2),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTypingDot(int index) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: 600 + (index * 200)),
      builder: (context, value, child) {
        return Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.3 + (value * 0.3)),
            shape: BoxShape.circle,
          ),
        );
      },
    );
  }

  Widget _buildInputArea() {
    // 顯示當前選擇的 Area/Product
    final hasSelection = _selectedAreaId != null || _selectedProductId != null;

    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
      decoration: BoxDecoration(
        color: const Color(0xFF0D1117),
        border: Border(
          top: BorderSide(
            color: Colors.white.withValues(alpha: 0.08),
            width: 1,
          ),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 顯示選中的標籤
          if (hasSelection)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _buildSelectionBadge(),
            ),
          // 語音模式界面
          if (_isVoiceMode)
            _buildVoiceModeUI()
          else
            Row(
              children: [
                // 麥克風按鈕
                GestureDetector(
                  onTap: _toggleVoiceMode,
                  child: Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: const Color(0xFFEC4899).withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: const Color(0xFFEC4899).withValues(alpha: 0.3),
                        width: 1,
                      ),
                    ),
                    child: const Icon(
                      Icons.mic_rounded,
                      color: Color(0xFFEC4899),
                      size: 22,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _textController,
                    autofocus: true,
                    style: const TextStyle(color: Colors.white, fontSize: 16),
                    decoration: InputDecoration(
                      hintText: '輸入新事項...',
                      hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.3)),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: BorderSide.none,
                      ),
                      contentPadding:
                          const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                      filled: true,
                      fillColor: Colors.white.withValues(alpha: 0.05),
                    ),
                    onSubmitted: (_) => _submit(),
                    textInputAction: TextInputAction.send,
                  ),
                ),
                const SizedBox(width: 12),
                GestureDetector(
                  onTap: _isLoading ? null : _submit,
                  child: Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: _isLoading
                          ? const Color(0xFF6C63FF).withValues(alpha: 0.5)
                          : const Color(0xFF6C63FF),
                      shape: BoxShape.circle,
                    ),
                    child: _isLoading
                        ? const Padding(
                            padding: EdgeInsets.all(14),
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(
                            Icons.arrow_upward,
                            color: Colors.white,
                            size: 24,
                          ),
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }

  /// 語音模式 UI
  Widget _buildVoiceModeUI() {
    final isListening = _speechToText.isListening;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      padding: const EdgeInsets.symmetric(vertical: 20),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // 辨識文字顯示
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            constraints: const BoxConstraints(minHeight: 50),
            child: Text(
              _lastWords.isNotEmpty ? _lastWords : (isListening ? '正在聆聽...' : '點擊麥克風開始'),
              textAlign: TextAlign.center,
              style: TextStyle(
                color: _lastWords.isNotEmpty ? Colors.white : Colors.white.withValues(alpha: 0.5),
                fontSize: 18,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          const SizedBox(height: 16),
          // 麥克風按鈕
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // 取消按鈕
              GestureDetector(
                onTap: () {
                  _stopListening();
                  setState(() {
                    _isVoiceMode = false;
                    _lastWords = '';
                  });
                },
                child: Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.close,
                    color: Colors.white.withValues(alpha: 0.6),
                    size: 24,
                  ),
                ),
              ),
              const SizedBox(width: 24),
              // 主麥克風按鈕
              GestureDetector(
                onTap: () {
                  if (isListening) {
                    _stopListening();
                  } else {
                    _startListening();
                  }
                },
                child: Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: isListening
                          ? [const Color(0xFFEF4444), const Color(0xFFDC2626)]
                          : [const Color(0xFFEC4899), const Color(0xFFBE185D)],
                    ),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: (isListening ? const Color(0xFFEF4444) : const Color(0xFFEC4899))
                            .withValues(alpha: 0.4),
                        blurRadius: 20,
                        spreadRadius: 2,
                      ),
                    ],
                  ),
                  child: Icon(
                    isListening ? Icons.stop_rounded : Icons.mic_rounded,
                    color: Colors.white,
                    size: 36,
                  ),
                ),
              ),
              const SizedBox(width: 24),
              // 確認按鈕
              GestureDetector(
                onTap: _lastWords.isNotEmpty ? _toggleVoiceMode : null,
                child: Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: _lastWords.isNotEmpty
                        ? const Color(0xFF10B981)
                        : Colors.white.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.check,
                    color: _lastWords.isNotEmpty
                        ? Colors.white
                        : Colors.white.withValues(alpha: 0.3),
                    size: 24,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSelectionBadge() {
    final productsResult = ref.read(productsProvider).valueOrNull;
    final areasResult = ref.read(areasProvider).valueOrNull;

    String? productName;
    String? areaName;

    if (_selectedProductId != null && productsResult != null) {
      productsResult.fold(
        (_) {},
        (products) {
          final product = products.where((p) => p.id == _selectedProductId).firstOrNull;
          productName = product?.name;
        },
      );
    }

    if (_selectedAreaId != null && areasResult != null) {
      areasResult.fold(
        (_) {},
        (areas) {
          final area = areas.where((a) => a.id == _selectedAreaId).firstOrNull;
          areaName = area?.name;
        },
      );
    }

    final displayText = productName ?? areaName ?? '';
    if (displayText.isEmpty) return const SizedBox.shrink();

    final isProduct = productName != null;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: isProduct
            ? const Color(0xFF10B981).withValues(alpha: 0.15)
            : const Color(0xFF6C63FF).withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.alternate_email,
            size: 14,
            color: isProduct ? const Color(0xFF10B981) : const Color(0xFF6C63FF),
          ),
          const SizedBox(width: 4),
          Text(
            displayText,
            style: TextStyle(
              color: isProduct ? const Color(0xFF10B981) : const Color(0xFF6C63FF),
              fontSize: 13,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(width: 4),
          GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
              setState(() {
                _selectedProductId = null;
                if (!isProduct) {
                  _selectedAreaId = null;
                }
              });
            },
            child: Icon(
              Icons.close,
              size: 14,
              color: isProduct
                  ? const Color(0xFF10B981).withValues(alpha: 0.6)
                  : const Color(0xFF6C63FF).withValues(alpha: 0.6),
            ),
          ),
        ],
      ),
    );
  }
}
