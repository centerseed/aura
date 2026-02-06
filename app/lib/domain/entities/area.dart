import 'package:equatable/equatable.dart';

/// Area 實體
class Area extends Equatable {
  final String id;
  final String name;
  final String? description;
  final String? scope;
  final String? rollingSummary;
  final bool isCustom;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const Area({
    required this.id,
    required this.name,
    this.description,
    this.scope,
    this.rollingSummary,
    required this.isCustom,
    this.createdAt,
    this.updatedAt,
  });

  @override
  List<Object?> get props => [id, name];
}
