import 'dart:ui' as dart_ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import '../../../../domain/entities/reference.dart';
import '../../../providers/product_reference_provider.dart';

/// Reference BottomSheet - 顯示和管理 Product 的參考資料
///
/// 功能:
/// - 顯示所有 references（URL 和 Note 類型）
/// - 新增 reference
/// - 刪除 reference
/// - URL 類型可以點擊打開
/// - 自動監聽 provider 並刷新列表
class ReferenceBottomSheet extends ConsumerStatefulWidget {
  final String productId;
  final String productName;
  final Future<void> Function(String type, String content, String? title) onAddReference;
  final Future<void> Function(String referenceId, String content, String? title) onEditReference;
  final Future<void> Function(String referenceId) onDeleteReference;

  const ReferenceBottomSheet({
    super.key,
    required this.productId,
    required this.productName,
    required this.onAddReference,
    required this.onEditReference,
    required this.onDeleteReference,
  });

  @override
  ConsumerState<ReferenceBottomSheet> createState() => _ReferenceBottomSheetState();
}

class _ReferenceBottomSheetState extends ConsumerState<ReferenceBottomSheet> {
  final TextEditingController _contentController = TextEditingController();
  final TextEditingController _titleController = TextEditingController();
  ReferenceType _selectedType = ReferenceType.note;
  bool _isLoading = false;
  String? _editingReferenceId;
  final Set<String> _expandedReferenceIds = {}; // 追蹤展開的卡片

  @override
  void dispose() {
    _contentController.dispose();
    _titleController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmitReference() async {
    if (_contentController.text.trim().isEmpty) return;

    setState(() => _isLoading = true);

    try {
      if (_editingReferenceId != null) {
        await widget.onEditReference(
          _editingReferenceId!,
          _contentController.text.trim(),
          _titleController.text.trim().isEmpty ? null : _titleController.text.trim(),
        );
      } else {
        await widget.onAddReference(
          _selectedType.name,
          _contentController.text.trim(),
          _titleController.text.trim().isEmpty ? null : _titleController.text.trim(),
        );
      }

      _contentController.clear();
      _titleController.clear();
      _editingReferenceId = null;
      FocusScope.of(context).unfocus();
      HapticFeedback.mediumImpact();
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _startEditing(Reference reference) {
    setState(() {
      _editingReferenceId = reference.id;
      _selectedType = reference.type;
      _titleController.text = reference.title ?? '';
      _contentController.text = reference.content;
    });
  }

  void _cancelEditing() {
    setState(() {
      _editingReferenceId = null;
      _titleController.clear();
      _contentController.clear();
    });
    FocusScope.of(context).unfocus();
  }

  Future<void> _handleDeleteReference(String referenceId) async {
    setState(() => _isLoading = true);

    try {
      await widget.onDeleteReference(referenceId);
      HapticFeedback.lightImpact();
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _handleOpenUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    // 監聽 reference provider
    final referencesAsync = ref.watch(productReferencesUnwrappedProvider(widget.productId));

    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      decoration: BoxDecoration(
        color: const Color(0xFF1c1c1e).withValues(alpha: 0.95),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
        child: BackdropFilter(
          filter: dart_ui.ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: referencesAsync.when(
            data: (references) => Column(
              children: [
                _buildHeader(references.length),
                Expanded(
                  child: _buildReferenceList(references),
                ),
                _buildAddReferenceForm(),
              ],
            ),
            loading: () => Column(
              children: [
                _buildHeader(0),
                const Expanded(
                  child: Center(
                    child: CircularProgressIndicator(
                      valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF6C63FF)),
                    ),
                  ),
                ),
                _buildAddReferenceForm(),
              ],
            ),
            error: (error, stack) => Column(
              children: [
                _buildHeader(0),
                Expanded(
                  child: Center(
                    child: Text(
                      '載入失敗: $error',
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.7)),
                    ),
                  ),
                ),
                _buildAddReferenceForm(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(int referenceCount) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Drag Handle
          Center(
            child: Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          // Title
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.productName,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '相關資料 ($referenceCount)',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.6),
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close, color: Colors.white70),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildReferenceList(List<Reference> references) {
    return GestureDetector(
      // 點擊空白區域關閉鍵盤
      onTap: () => FocusScope.of(context).unfocus(),
      behavior: HitTestBehavior.translucent,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
        children: [
          // Reference List
          if (references.isEmpty)
            _buildEmptyState()
          else
            ...references.map((ref) => _buildReferenceItem(ref)),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Container(
      padding: const EdgeInsets.all(40),
      child: Column(
        children: [
          Icon(
            Icons.folder_open_outlined,
            size: 64,
            color: Colors.white.withValues(alpha: 0.3),
          ),
          const SizedBox(height: 16),
          Text(
            '尚無相關資料',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.5),
              fontSize: 16,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReferenceItem(Reference reference) {
    final isUrl = reference.type == ReferenceType.url;
    final isExpanded = _expandedReferenceIds.contains(reference.id);
    final isLongContent = reference.content.length > 150 || reference.content.split('\n').length > 3;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Row
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Icon
                Icon(
                  isUrl ? Icons.link : Icons.note_outlined,
                  color: isUrl ? const Color(0xFF6C63FF) : const Color(0xFF4ADE80),
                  size: 20,
                ),
                const SizedBox(width: 12),
                // Title
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (reference.title != null) ...[
                        Text(
                          reference.title!,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ] else ...[
                        Text(
                          isUrl ? '連結' : '備註',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.6),
                            fontSize: 13,
                            fontWeight: FontWeight.w400,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                // Action Buttons
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Edit Button
                    IconButton(
                      icon: Icon(
                        Icons.edit_outlined,
                        color: Colors.white.withValues(alpha: 0.3),
                        size: 18,
                      ),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                      onPressed: _isLoading ? null : () => _startEditing(reference),
                    ),
                    const SizedBox(width: 8),
                    // Delete Button
                    IconButton(
                      icon: Icon(
                        Icons.delete_outline,
                        color: Colors.white.withValues(alpha: 0.3),
                        size: 18,
                      ),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                      onPressed: _isLoading
                          ? null
                          : () => _handleDeleteReference(reference.id),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Content Area
          AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            constraints: BoxConstraints(
              maxHeight: isExpanded ? 400 : 120, // 折疊時最高 120，展開時最高 400
            ),
            child: SingleChildScrollView(
              physics: isExpanded ? const AlwaysScrollableScrollPhysics() : const NeverScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(48, 0, 16, 16),
              child: isUrl
                  ? GestureDetector(
                      onTap: () => _handleOpenUrl(reference.content),
                      child: Text(
                        reference.content,
                        style: const TextStyle(
                          color: Color(0xFF6C63FF),
                          fontSize: 13,
                          decoration: TextDecoration.underline,
                        ),
                        maxLines: isExpanded ? null : 3,
                        overflow: isExpanded ? null : TextOverflow.ellipsis,
                      ),
                    )
                  : MarkdownBody(
                      data: reference.content,
                      selectable: true,
                      styleSheet: MarkdownStyleSheet(
                        p: TextStyle(
                          color: Colors.white.withValues(alpha: 0.8),
                          fontSize: 13,
                          height: 1.5,
                        ),
                        h1: const TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                        h2: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                        h3: TextStyle(
                          color: Colors.white.withValues(alpha: 0.9),
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                        ),
                        code: TextStyle(
                          backgroundColor: Colors.white.withValues(alpha: 0.1),
                          color: const Color(0xFF4ADE80),
                          fontFamily: 'monospace',
                          fontSize: 12,
                        ),
                        codeblockDecoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.05),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                        ),
                        listBullet: const TextStyle(
                          color: Color(0xFF4ADE80),
                          fontSize: 13,
                        ),
                        blockquote: TextStyle(
                          color: Colors.white.withValues(alpha: 0.6),
                          fontSize: 13,
                        ),
                        blockquoteDecoration: BoxDecoration(
                          border: Border(
                            left: BorderSide(
                              color: const Color(0xFF4ADE80).withValues(alpha: 0.5),
                              width: 3,
                            ),
                          ),
                        ),
                      ),
                    ),
            ),
          ),

          // Expand/Collapse Button
          if (isLongContent)
            Padding(
              padding: const EdgeInsets.fromLTRB(48, 0, 16, 12),
              child: GestureDetector(
                onTap: () {
                  setState(() {
                    if (isExpanded) {
                      _expandedReferenceIds.remove(reference.id);
                    } else {
                      _expandedReferenceIds.add(reference.id);
                    }
                  });
                  HapticFeedback.selectionClick();
                },
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      isExpanded ? '收起' : '展開更多',
                      style: const TextStyle(
                        color: Color(0xFF6C63FF),
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Icon(
                      isExpanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                      color: const Color(0xFF6C63FF),
                      size: 16,
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildAddReferenceForm() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1c1c1e),
        border: Border(
          top: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                _editingReferenceId != null ? Icons.edit : Icons.add_circle_outline,
                color: const Color(0xFF6C63FF),
                size: 20,
              ),
              const SizedBox(width: 8),
              Text(
                _editingReferenceId != null ? "編輯資料" : "新增資料",
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const Spacer(),
              if (_editingReferenceId != null)
                TextButton(
                  onPressed: _cancelEditing,
                  child: const Text(
                    '取消',
                    style: TextStyle(color: Color(0xFFEF4444), fontSize: 13),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),

          // Type Selector
          Row(
            children: [
              _buildTypeChip(ReferenceType.note, Icons.note_outlined, '備註'),
              const SizedBox(width: 8),
              _buildTypeChip(ReferenceType.url, Icons.link, '連結'),
            ],
          ),
          const SizedBox(height: 16),

          // Title (Optional)
          TextField(
            controller: _titleController,
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(
              hintText: '標題（選填）',
              hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.4)),
              filled: true,
              fillColor: Colors.white.withValues(alpha: 0.05),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFF6C63FF)),
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Content
          TextField(
            controller: _contentController,
            style: const TextStyle(color: Colors.white),
            maxLines: 3,
            decoration: InputDecoration(
              hintText: _selectedType == ReferenceType.url ? 'https://...' : '輸入備註內容',
              hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.4)),
              filled: true,
              fillColor: Colors.white.withValues(alpha: 0.05),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFF6C63FF)),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Add Button
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _isLoading ? null : _handleSubmitReference,
              icon: _isLoading
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : Icon(_editingReferenceId != null ? Icons.check : Icons.add),
              label: Text(_editingReferenceId != null ? '更新' : '新增'),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF6C63FF),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTypeChip(ReferenceType type, IconData icon, String label) {
    final isSelected = _selectedType == type;

    return GestureDetector(
      onTap: () => setState(() => _selectedType = type),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected
              ? const Color(0xFF6C63FF)
              : Colors.white.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected
                ? const Color(0xFF6C63FF)
                : Colors.white.withValues(alpha: 0.2),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 16,
              color: isSelected ? Colors.white : Colors.white.withValues(alpha: 0.6),
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: isSelected ? Colors.white : Colors.white.withValues(alpha: 0.6),
                fontSize: 13,
                fontWeight: isSelected ? FontWeight.w500 : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
