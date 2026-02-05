import 'package:dartz/dartz.dart' hide Task;

import '../../core/errors/failures.dart';
import '../entities/area.dart';
import '../entities/product.dart';
import '../entities/task.dart';

/// Dashboard Repository Interface
///
/// 統一資料載入端點，在服務端使用 Promise.all 並發查詢
/// 解決 Cloud Run HTTP/1.1 請求序列化問題
abstract class DashboardRepository {
  /// 取得 Dashboard 資料
  ///
  /// [include] - 要載入的數據區塊（逗號分隔）
  ///   - Flutter 常用: areas,products,tasks,completedToday
  /// [includeArchived] - 是否包含已歸檔任務
  /// [tasksStatus] - 任務狀態過濾
  Future<Either<Failure, DashboardData>> getDashboard({
    String? include,
    bool includeArchived = false,
    String? tasksStatus,
  });
}

/// Dashboard 資料
class DashboardData {
  final List<Area>? areas;
  final List<Product>? products;
  final List<Task>? tasks;
  final List<Task>? completedToday;

  const DashboardData({
    this.areas,
    this.products,
    this.tasks,
    this.completedToday,
  });

  /// 是否有 Areas 資料
  bool get hasAreas => areas != null && areas!.isNotEmpty;

  /// 是否有 Products 資料
  bool get hasProducts => products != null && products!.isNotEmpty;

  /// 是否有 Tasks 資料
  bool get hasTasks => tasks != null && tasks!.isNotEmpty;

  /// 是否有今日完成資料
  bool get hasCompletedToday =>
      completedToday != null && completedToday!.isNotEmpty;
}
