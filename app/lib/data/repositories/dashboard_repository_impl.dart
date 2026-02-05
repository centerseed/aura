import 'package:dartz/dartz.dart' hide Task;

import '../../core/errors/dio_error_handler.dart';
import '../../core/errors/failures.dart';
import '../../domain/entities/area.dart';
import '../../domain/entities/product.dart';
import '../../domain/entities/task.dart';
import '../../domain/repositories/dashboard_repository.dart';
import '../datasources/remote/api_client.dart';
import '../models/area_model.dart';
import '../models/product_model.dart';
import '../models/task_model.dart';

/// Dashboard Repository 實作
///
/// 呼叫統一的 Dashboard API，在服務端使用 Promise.all 並發查詢
/// 解決瀏覽器/App 對 Cloud Run HTTP/1.1 請求序列化的問題
class DashboardRepositoryImpl implements DashboardRepository {
  final ApiClient _apiClient;

  DashboardRepositoryImpl(this._apiClient);

  @override
  Future<Either<Failure, DashboardData>> getDashboard({
    String? include,
    bool includeArchived = false,
    String? tasksStatus,
  }) async {
    try {
      final data = await _apiClient.getDashboard(
        include: include,
        includeArchived: includeArchived,
        tasksStatus: tasksStatus,
      );

      // 解析各區塊資料
      List<Area>? areas;
      List<Product>? products;
      List<Task>? tasks;
      List<Task>? completedToday;

      // Areas
      if (data['areas'] != null) {
        final areasJson = data['areas'] as List;
        areas = areasJson
            .map((json) => AreaModel.fromJson(json as Map<String, dynamic>))
            .map((model) => model.toEntity())
            .toList();
      }

      // Products
      if (data['products'] != null) {
        final productsJson = data['products'] as List;
        products = productsJson
            .map((json) => ProductModel.fromJson(json as Map<String, dynamic>))
            .map((model) => model.toEntity())
            .toList();
      }

      // Tasks
      if (data['tasks'] != null) {
        final tasksData = data['tasks'] as Map<String, dynamic>;
        final tasksList = tasksData['tasks'] as List? ?? [];
        tasks = tasksList
            .map((json) => TaskModel.fromJson(json as Map<String, dynamic>))
            .map((model) => model.toEntity())
            .toList();
      }

      // Completed Today
      if (data['completedToday'] != null) {
        final completedData = data['completedToday'] as Map<String, dynamic>;
        final completedList = completedData['tasks'] as List? ?? [];
        completedToday = completedList
            .map((json) => TaskModel.fromJson(json as Map<String, dynamic>))
            .map((model) => model.toEntity())
            .toList();
      }

      return Right(DashboardData(
        areas: areas,
        products: products,
        tasks: tasks,
        completedToday: completedToday,
      ));
    } catch (e) {
      return Left(handleDioError(e));
    }
  }
}
