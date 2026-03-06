import 'package:dio/dio.dart';
import '../../models/area_model.dart';
import '../../models/brain_dump_models.dart';
import '../../models/milestone_model.dart';
import '../../models/product_model.dart';
import '../../models/recurring_task_model.dart';
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

  Future<Map<String, dynamic>> promoteSubItem(String taskId, String subItemId) async {
    final response = await _dio.post('/tasks/$taskId/sub-items/$subItemId/promote');
    return response.data['data'] as Map<String, dynamic>;
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
    // API returns { area: {...}, created, updated, message }
    final areaData = data is Map && data.containsKey('area') ? data['area'] : data;
    return AreaModel.fromJson(areaData);
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
    // API returns { product: {...}, message }
    final productData = data is Map && data.containsKey('product') ? data['product'] : data;
    return ProductModel.fromJson(productData);
  }

  /// 更新 Product
  /// PATCH /api/products/:id
  Future<ProductModel> updateProduct(
    String productId,
    Map<String, dynamic> body,
  ) async {
    final response = await _dio.patch('/products/$productId', data: body);
    final data = response.data['data'] ?? response.data;
    // API 返回 { data: { product: {...} } }
    final productData = data['product'] ?? data;
    return ProductModel.fromJson(productData);
  }

  /// 刪除 Product（軟刪除）
  /// DELETE /api/products/:id
  Future<void> deleteProduct(String productId) async {
    await _dio.delete('/products/$productId');
  }

  /// 取得 Product 的所有 Topics
  /// GET /api/products/:id/topics
  Future<List<Map<String, dynamic>>> getProductTopics(String productId) async {
    final response = await _dio.get('/products/$productId/topics');
    final dataWrapper = response.data['data'];
    final List<dynamic> topics = dataWrapper is Map ? (dataWrapper['topics'] ?? []) : dataWrapper;
    return topics.map((t) => {'id': t['id'] as String, 'name': t['name'] as String}).toList();
  }

  Future<Map<String, dynamic>> createTopic(String productId, String name) async {
    final response = await _dio.post('/products/$productId/topics', data: {'name': name});
    final data = response.data['data'] ?? response.data;
    return {'id': data['id'] as String, 'name': data['name'] as String};
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

  /// 更新 Product 的 Reference
  Future<ReferenceModel> updateProductReference({
    required String productId,
    required String referenceId,
    required String content,
    String? title,
    String? taskId,
  }) async {
    final response = await _dio.patch(
      '/products/$productId/references',
      data: {
        'referenceId': referenceId,
        'content': content,
        if (title != null) 'title': title,
        if (taskId != null) 'taskId': taskId,
      },
    );
    final data = response.data['data'];
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

  Future<BrainDumpResponse> brainDumpWithImage({
    required String imagePath,
    required String mimeType,
    String text = '',
  }) async {
    final inputType = text.isNotEmpty ? 'image_with_text' : 'image';
    final formData = FormData.fromMap({
      'image': await MultipartFile.fromFile(
        imagePath,
        contentType: DioMediaType.parse(mimeType),
      ),
      if (text.isNotEmpty) 'text': text,
      'input_type': inputType,
    });

    final response = await _dio.post('/brain-dump', data: formData);
    final data = response.data['data'] as Map<String, dynamic>;
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

  Future<String> getDebugToken(String uid) async {
    final response = await _dio.post('/auth/debug-token', data: {'uid': uid});
    return response.data['data']['token'] as String;
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

  // ==================== Dashboard ====================

  /// Dashboard - 統一資料載入（解決 Cloud Run HTTP/1.1 序列化問題）
  /// 在 API 層使用 Promise.all 並發查詢，前端只需一次 HTTP 請求
  ///
  /// [include] - 要載入的數據區塊（逗號分隔）
  ///   - Flutter 常用: areas,products,tasks,completedToday
  ///   - Web 常用: user,library,milestones,completedToday
  /// [includeArchived] - 是否包含已歸檔任務
  /// [tasksStatus] - 任務狀態過濾（用於 tasks 區塊）
  Future<Map<String, dynamic>> getDashboard({
    String? include,
    bool? includeArchived,
    String? tasksStatus,
  }) async {
    final queryParams = <String, dynamic>{};
    if (include != null) queryParams['include'] = include;
    if (includeArchived == true) queryParams['include_archived'] = 'true';
    if (tasksStatus != null) queryParams['tasks_status'] = tasksStatus;

    final response = await _dio.get('/dashboard', queryParameters: queryParams);
    // API 返回格式: {data: {...}, meta: {sections: [...]}}
    return response.data['data'] as Map<String, dynamic>;
  }

  // ==================== Coach Briefing ====================

  Future<Map<String, dynamic>?> getLatestBriefing({String? type}) async {
    final queryParams = <String, dynamic>{};
    if (type != null) queryParams['type'] = type;

    final response = await _dio.get(
      '/coach/briefing/latest',
      queryParameters: queryParams,
    );
    final data = response.data['data'] as Map<String, dynamic>;
    return data['briefing'] as Map<String, dynamic>?;
  }

  Future<Map<String, dynamic>> generateBriefing({String? type}) async {
    final body = <String, dynamic>{};
    if (type != null) body['type'] = type;

    final response = await _dio.post('/coach/briefing', data: body);
    final data = response.data['data'] as Map<String, dynamic>;
    return data['briefing'] as Map<String, dynamic>;
  }

  // ==================== Coach Plan ====================

  Future<Map<String, dynamic>?> getPlan({
    String? date,
    String? timezone,
  }) async {
    final queryParams = <String, dynamic>{};
    if (date != null) queryParams['date'] = date;
    if (timezone != null) queryParams['timezone'] = timezone;

    final response = await _dio.get(
      '/coach/plan',
      queryParameters: queryParams,
    );
    final data = response.data['data'] as Map<String, dynamic>;
    return data['plan'] as Map<String, dynamic>?;
  }

  Future<Map<String, dynamic>> generatePlan({
    String? date,
    String? timezone,
  }) async {
    final body = <String, dynamic>{};
    if (date != null) body['date'] = date;
    if (timezone != null) body['timezone'] = timezone;

    final response = await _dio.post('/coach/plan', data: body);
    final data = response.data['data'] as Map<String, dynamic>;
    return data['plan'] as Map<String, dynamic>;
  }

  Future<void> updatePlanItem(
    String itemId,
    Map<String, dynamic> body,
  ) async {
    await _dio.patch('/coach/plan/items/$itemId', data: body);
  }

  Future<Map<String, dynamic>> updateCurrentUser(Map<String, dynamic> body) async {
    final response = await _dio.patch('/me', data: body);
    return response.data;
  }

  Future<Map<String, dynamic>> getAiUsage() async {
    final response = await _dio.get('/me/ai-usage');
    return response.data['data'] as Map<String, dynamic>;
  }

  /// 刪除帳號（soft-delete 所有使用者資料）
  /// DELETE /api/me
  Future<void> deleteAccount() async {
    await _dio.delete('/me');
  }

  // ==================== Coach Magic Moment ====================

  /// 偵測動能轉移：P0 停滯 + 非 P0 爆發
  /// GET /api/coach/magic-moment
  Future<Map<String, dynamic>?> getMagicMoment() async {
    final response = await _dio.get('/coach/magic-moment');
    return response.data['data'] as Map<String, dynamic>?;
  }

  // ==================== Milestones ====================

  /// 取得所有里程碑
  Future<List<MilestoneModel>> getMilestones() async {
    final response = await _dio.get('/milestones');
    // API 返回格式: {data: {milestones: [...]}, meta: {...}}
    final dataWrapper = response.data['data'];
    final List<dynamic> milestones =
        dataWrapper is Map ? (dataWrapper['milestones'] ?? []) : dataWrapper;
    return milestones.map((json) => MilestoneModel.fromJson(json)).toList();
  }

  /// 建立里程碑
  Future<MilestoneModel> createMilestone(Map<String, dynamic> body) async {
    final response = await _dio.post('/milestones', data: body);
    final data = response.data['data'] ?? response.data;
    // API 返回 { data: { milestone: {...} } }
    final milestoneData = data['milestone'] ?? data;
    return MilestoneModel.fromJson(milestoneData);
  }

  /// 更新里程碑
  Future<MilestoneModel> updateMilestone(
    String milestoneId,
    Map<String, dynamic> body,
  ) async {
    final response = await _dio.put('/milestones/$milestoneId', data: body);
    final data = response.data['data'] ?? response.data;
    // API 返回 { data: { milestone: {...} } }
    final milestoneData = data['milestone'] ?? data;
    return MilestoneModel.fromJson(milestoneData);
  }

  /// 刪除里程碑
  Future<void> deleteMilestone(String milestoneId) async {
    await _dio.delete('/milestones/$milestoneId');
  }

  // ==================== Recurring Tasks ====================

  /// 取得所有週期任務模板
  Future<List<RecurringTaskModel>> getRecurringTasks() async {
    final response = await _dio.get('/recurring-tasks');
    final data = response.data['data'] ?? response.data;
    final list = data['recurring_tasks'] as List? ?? [];
    return list.map((json) => RecurringTaskModel.fromJson(json as Map<String, dynamic>)).toList();
  }

  /// 建立週期任務模板
  Future<RecurringTaskModel> createRecurringTask(Map<String, dynamic> body) async {
    final response = await _dio.post('/recurring-tasks', data: body);
    final data = response.data['data'] ?? response.data;
    return RecurringTaskModel.fromJson(data['recurring_task'] as Map<String, dynamic>);
  }

  /// 更新週期任務模板
  Future<RecurringTaskModel> updateRecurringTask(
    String id,
    Map<String, dynamic> body,
  ) async {
    final response = await _dio.patch('/recurring-tasks/$id', data: body);
    final data = response.data['data'] ?? response.data;
    return RecurringTaskModel.fromJson(data['recurring_task'] as Map<String, dynamic>);
  }

  /// 刪除（封存）週期任務模板
  Future<void> deleteRecurringTask(String id) async {
    await _dio.delete('/recurring-tasks/$id');
  }

  /// 客戶端觸發：生成週期任務實例
  Future<Map<String, dynamic>> generateRecurringTaskInstances(String localDate) async {
    final response = await _dio.post(
      '/recurring-tasks/generate',
      data: {'local_date': localDate},
    );
    return response.data['data'] as Map<String, dynamic>? ?? {};
  }
}
