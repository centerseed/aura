import 'package:dio/dio.dart';

import '../../models/brain_dump_models.dart';
import '../../models/task_model.dart';
import '../../models/area_model.dart';
import '../../models/product_model.dart';

/// 簡單的 API Client (手動實現，不使用 Retrofit)
/// 後續可以升級為 Retrofit 版本
class ApiClient {
  final Dio _dio;

  ApiClient(this._dio);

  // ==================== Auth ====================

  Future<Map<String, dynamic>> signIn(Map<String, dynamic> body) async {
    final response = await _dio.post('/api/auth/signin', data: body);
    // Backend returns { success: true, data: {...}, meta: {...} }
    return response.data['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getCurrentUser() async {
    final response = await _dio.get('/api/me');
    // Backend returns { success: true, data: {...}, meta: {...} }
    return response.data['data'] as Map<String, dynamic>;
  }

  // ==================== Brain Dump ====================

  Future<BrainDumpResponse> brainDump(BrainDumpRequest request) async {
    final response = await _dio.post('/api/brain-dump', data: request.toJson());
    // Backend returns { success: true, data: { items: [...] }, meta: {...} }
    return BrainDumpResponse.fromJson(response.data['data']);
  }

  // ==================== Tasks ====================

  Future<List<TaskModel>> getTasks({
    String? status,
    String? dueDateFrom,
    String? dueDateTo,
    bool? completedToday,
  }) async {
    final response = await _dio.get(
      '/api/tasks',
      queryParameters: {
        if (status != null) 'status': status,
        if (dueDateFrom != null) 'due_date_from': dueDateFrom,
        if (dueDateTo != null) 'due_date_to': dueDateTo,
        if (completedToday == true) 'completed_today': 'true',
      },
    );

    // Backend returns { success: true, data: [...], meta: {...} }
    final data = response.data['data'] as List;
    return data.map((json) => TaskModel.fromJson(json)).toList();
  }

  Future<TaskModel> createTask(Map<String, dynamic> request) async {
    final response = await _dio.post('/api/tasks', data: request);
    // Backend returns { success: true, data: { task: {...}, message: "..." }, meta: {...} }
    return TaskModel.fromJson(response.data['data']['task']);
  }

  Future<TaskModel> updateTask(
    String taskId,
    Map<String, dynamic> request,
  ) async {
    // Backend API (route.ts line 70) expects PATCH /api/tasks with body including taskId
    final body = {'taskId': taskId, ...request};
    final response = await _dio.patch('/api/tasks', data: body);

    // Backend returns { success: true, data: { task: {...}, message: "..." }, meta: {...} }
    return TaskModel.fromJson(response.data['data']['task']);
  }

  Future<void> deleteTask(String taskId) async {
    await _dio.delete('/api/tasks/$taskId');
  }

  // ==================== Library ====================

  Future<Map<String, dynamic>> getLibrary() async {
    final response = await _dio.get('/api/library');
    // Backend returns { success: true, data: { areas: [...] }, meta: {...} }
    return response.data['data'] as Map<String, dynamic>;
  }

  // ==================== Areas ====================

  Future<List<AreaModel>> getAreas() async {
    final response = await _dio.get('/api/areas');
    // Backend returns { success: true, data: { areas: [...] }, meta: {...} }
    final data = response.data['data']['areas'] as List;
    return data.map((json) => AreaModel.fromJson(json)).toList();
  }

  Future<AreaModel> createArea(Map<String, dynamic> request) async {
    final response = await _dio.post('/api/areas', data: request);
    // Backend returns { success: true, data: { area: {...}, created: ..., updated: ..., message: "..." }, meta: {...} }
    return AreaModel.fromJson(response.data['data']['area']);
  }

  // ==================== Products ====================

  Future<List<ProductModel>> getProducts() async {
    final response = await _dio.get('/api/products');
    // Backend returns { success: true, data: { products: [...] }, meta: {...} }
    final data = response.data['data']['products'] as List;
    return data.map((json) => ProductModel.fromJson(json)).toList();
  }

  Future<ProductModel> createProduct(Map<String, dynamic> request) async {
    final response = await _dio.post('/api/products', data: request);
    // Backend returns { success: true, data: { product: {...}, message: "..." }, meta: {...} }
    return ProductModel.fromJson(response.data['data']['product']);
  }

  // ==================== Product AI ====================

  Future<Map<String, dynamic>> reorganizeProductTopics(String productId) async {
    final response = await _dio.post(
      '/api/products/$productId/reorganize-topics',
      data: {}, // Some APIs might require empty body
    );
    return response.data;
  }

  Future<Map<String, dynamic>> applyProductReorganization(
    String productId,
    Map<String, dynamic> proposalJson,
  ) async {
    final response = await _dio.post(
      '/api/products/$productId/apply-reorganization',
      data: proposalJson,
    );
    return response.data;
  }

  // ==================== Sub-items ====================

  Future<void> updateSubItem(
    String taskId,
    String subItemId,
    Map<String, dynamic> data,
  ) async {
    await _dio.patch('/api/tasks/$taskId/sub-items/$subItemId', data: data);
  }
}
