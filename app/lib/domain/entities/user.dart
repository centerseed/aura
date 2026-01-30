import 'package:equatable/equatable.dart';

/// User 實體
class User extends Equatable {
  final String id;
  final String email;
  final String? name;
  final String authProvider;
  final String authProviderId;
  final Map<String, dynamic>? settings;
  final DateTime? createdAt;

  const User({
    required this.id,
    required this.email,
    this.name,
    required this.authProvider,
    required this.authProviderId,
    this.settings,
    this.createdAt,
  });

  @override
  List<Object?> get props => [id, email];
}
