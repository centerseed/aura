import 'package:equatable/equatable.dart';

/// Reference 實體 - 參考資料
class Reference extends Equatable {
  final String id;
  final ReferenceType type;
  final String content;
  final String? title;
  final DateTime createdAt;

  const Reference({
    required this.id,
    required this.type,
    required this.content,
    this.title,
    required this.createdAt,
  });

  @override
  List<Object?> get props => [id, type, content, title];
}

/// Reference 類型
enum ReferenceType {
  url,  // 網址連結
  note, // 文字備註
}
