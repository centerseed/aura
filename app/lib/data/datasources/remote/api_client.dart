import 'package:dio/dio.dart';
import '../../models/area_model.dart';
import '../../models/brain_dump_models.dart';
import '../../models/product_model.dart';
import '../../models/reference_model.dart';
import '../../models/task_model.dart';

class ApiClient {
  final Dio _dio;

  ApiClient(this._dio);

  // ==================== Tasks ====================

  Future<List<TaskModel>> getTasks({
    String? status,
    String? dueDateFrom,
    String? dueDateTo,
    bool? completedToday,
  }) async {
    final queryParams = <String, dynamic>{};
    if (status != null) queryParams['status'] = status;
    if (dueDateFrom != null) queryParams['due_date_from'] = dueDateFrom;
    if (dueDateTo != null) queryParams['due_date_to'] = dueDateTo;
    if (completedToday != null) queryParams['completed_today'] = completedToday;

    final response = await _dio.get('/tasks', queryParameters: queryParams);
    // API 返回格式: {data: {tasks: [...], message: "..."}, meta: {...}}
    final dataWrapper = response.data['data'];
    final List<dynamic> tasks = dataWrapper is Map ? (dataWrapper['tasks'] ?? []) : dataWrapper;
    return tasks.map((json) => TaskModel.fromJson(json)).toList();
  }

  Future<TaskModel> createTask(Map<String, dynamic> body) async {
    final response = await _dio.post('/tasks', data: body);
    final data = response.data['data'] ?? response.data;
    // API 返回 { data: { task: {...} } }，需要取得 task 物件
    final taskData = data['task'] ?? data;
    return TaskModel.fromJson(taskData);
  }

  Future<TaskModel> updateTask(String taskId, Map<String, dynamic> body) async {
    final response = await _dio.patch('/tasks/$taskId', data: body);
    final data = response.data['data'] ?? response.data;
    // API 返回 { data: { task: {...} } }，需要取得 task 物件
    final taskData = data['task'] ?? data;
    return TaskModel.fromJson(taskData);
  }

  Future<void> deleteTask(String taskId) async {
    await _dio.delete('/tasks/$taskId');
  }

  Future<void> updateSubItem(
    String taskId,
    String subItemId,
    Map<String, dynamic> body,
  ) async {
    await _dio.patch('/tasks/$taskId/sub-items/$subItemId', data: body);
  }

  Future<void> addSubItem(String taskId, String content) async {
    await _dio.post('/tasks/$taskId/sub-items', data: {'content': content});
  }

  Future<void> deleteSubItem(String taskId, String subItemId) async {
    await _dio.delete('/tasks/$taskId/sub-items/$subItemId');
  }

  Future<void> reorderSubItems(String taskId, List<String> subItemIds) async {
    await _dio.put('/tasks/$taskId/sub-items', data: {'sub_item_ids': subItemIds});
  }

  // ==================== Areas ====================

  Future<List<AreaModel>> getAreas() async {
    final response = await _dio.get('/areas');
    // API 返回格式: {data: {areas: [...]}, meta: {...}}
    final dataWrapper = response.data['data'];
    final List<dynamic> areas = dataWrapper is Map ? (dataWrapper['areas'] ?? []) : dataWrapper;
    return areas.map((json) => AreaModel.fromJson(json)).toList();
  }

  Future<AreaModel> createArea(Map<String, dynamic> body) async {
    final response = await _dio.post('/areas', data: body);
    final data = response.data['data'] ?? response.data;
    return AreaModel.fromJson(data);
  }

  // ==================== Products ====================

  Future<List<ProductModel>> getProducts() async {
    final response = await _dio.get('/products');
    // API 返回格式: {data: {products: [...]}, meta: {...}}
    final dataWrapper = response.data['data'];
    final List<dynamic> products = dataWrapper is Map ? (dataWrapper['products'] ?? []) : dataWrapper;
    return products.map((json) => ProductModel.fromJson(json)).toList();
  }

  Future<ProductModel> createProduct(Map<String, dynamic> body) async {
    final response = await _dio.post('/products', data: body);
    final data = response.data['data'] ?? response.data;
    return ProductModel.fromJson(data);
  }

  Future<Map<String, dynamic>> reorganizeProductTopics(String productId) async {
    final response = await _dio.post('/products/$productId/reorganize-topics');
    return response.data;
  }

  Future<void> applyProductReorganization(
    String productId,
    Map<String, dynamic> proposal,
  ) async {
    await _dio.post(
      '/products/$productId/apply-reorganization',
      data: proposal,
    );
  }

  // ==================== Product References ====================

  /// 獲取 Product 的所有 References
  Future<List<ReferenceModel>> getProductReferences(String productId) async {
    final response = await _dio.get('/products/$productId/references');
    final dataWrapper = response.data['data'];
    final List<dynamic> references = dataWrapper is Map ? (dataWrapper['references'] ?? []) : dataWrapper;
    return references.map((json) => ReferenceModel.fromJson(json)).toList();
  }

  /// 新增 Reference 到 Product
  Future<ReferenceModel> addProductReference({
    required String productId,
    required String type,
    required String content,
    String? title,
  }) async {
    final response = await _dio.post(
      '/products/$productId/references',
      data: {
        'type': type,
        'content': content,
        if (title != null && title.isNotEmpty) 'title': title,
      },
    );
    final data = response.data['data'];
    // 假設 API 回傳 {reference: {...}}
    final referenceJson = data is Map ? (data['reference'] ?? data) : data;
    return ReferenceModel.fromJson(referenceJson);
  }

  /// 刪除 Product 的 Reference
  Future<void> deleteProductReference({
    required String productId,
    required String referenceId,
    String? taskId,
  }) async {
    final queryParams = <String, dynamic>{
      'referenceId': referenceId,
      if (taskId != null) 'taskId': taskId,
    };
    await _dio.delete(
      '/products/$productId/references',
      queryParameters: queryParams,
    );
  }

  // ==================== Brain Dump ====================

  Future<BrainDumpResponse> brainDump(BrainDumpRequest request) async {
    final response = await _dio.post('/brain-dump', data: request.toJson());
    // API 返回格式: {data: {action: "...", items: [...] | target_task: {...}, ...}, meta: {...}}
    final data = response.data['data'] as Map<String, dynamic>;

    // 添加 success 字段 (API 最外層有 success，但 data 裡面沒有)
    final dataWithSuccess = {
      'success': response.data['success'] ?? true,
      ...data,
    };

    return BrainDumpResponse.fromJson(dataWithSuccess);
  }

  // ==================== Auth ====================

  Future<Map<String, dynamic>> signIn(Map<String, dynamic> body) async {
    final response = await _dio.post('/auth/signin', data: body);
    return response.data;
  }

  // ==================== User ====================

  Future<Map<String, dynamic>> getCurrentUser() async {
    final response = await _dio.get('/me');
    return response.data;
  }

  Future<Map<String, dynamic>> getUserStatistics() async {
    final response = await _dio.get('/me/statistics');
    // API 返回格式: {data: {statistics: {...}}, meta: {...}}
    return response.data;
  }

  Future<Map<String, dynamic>> updateCurrentUser(Map<String, dynamic> body) async {
    final response = await _dio.patch('/me', data: body);
    return response.data;
  }
}
