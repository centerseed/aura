import 'package:equatable/equatable.dart';

/// 用戶統計數據實體
class UserStatistics extends Equatable {
  final int totalTasks;
  final int totalProducts;
  final int totalAreas;
  final int daysActive;
  final int activeTasks;
  final int archivedTasks;
  final int completedToday;

  const UserStatistics({
    required this.totalTasks,
    required this.totalProducts,
    required this.totalAreas,
    required this.daysActive,
    required this.activeTasks,
    required this.archivedTasks,
    required this.completedToday,
  });

  @override
  List<Object?> get props => [
        totalTasks,
        totalProducts,
        totalAreas,
        daysActive,
        activeTasks,
        archivedTasks,
        completedToday,
      ];
}
