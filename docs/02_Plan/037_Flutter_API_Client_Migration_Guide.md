# Flutter API Client 遷移指引

**版本**: 1.0
**日期**: 2026-01-30
**作者**: Backend Team

---

## 📋 概述

Backend API 已統一為新的標準格式，所有 API 回應現在遵循以下結構：

```json
{
  "success": true|false,
  "data": <actual_data>,
  "meta": {
    "timestamp": "2026-01-30T10:00:00Z",
    "total"?: number,
    "filtered"?: number,
    ...
  },
  "error"?: {
    "code": "ERROR_CODE",
    "message": "Error message",
    "details"?: {}
  }
}
```

---

## 🔄 需要修改的檔案

### 1. **app/lib/data/datasources/remote/api_client.dart**

#### A. GET /api/tasks - 修改前後對比

**修改前 (舊格式)**:
```dart
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

  // ❌ 舊格式：直接返回陣列
  return (response.data as List)
      .map((json) => TaskModel.fromJson(json))
      .toList();
}
```

**修改後 (新格式)**:
```dart
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

  // ✅ 新格式：包裝在 { success, data, meta } 中
  final responseData = response.data as Map<String, dynamic>;

  if (responseData['success'] != true) {
    throw ApiException(
      code: responseData['error']?['code'] ?? 'UNKNOWN_ERROR',
      message: responseData['error']?['message'] ?? 'Unknown error occurred',
    );
  }

  return (responseData['data'] as List)
      .map((json) => TaskModel.fromJson(json))
      .toList();
}
```

#### B. PATCH /api/tasks - 修改前後對比

**修改前 (舊格式)**:
```dart
Future<TaskModel> updateTask(
  String taskId,
  Map<String, dynamic> request,
) async {
  final body = {'taskId': taskId, ...request};
  final response = await _dio.patch('/api/tasks', data: body);

  // ❌ 舊格式：{ success: true, task: {...} }
  if (response.data['task'] != null) {
    return TaskModel.fromJson(response.data['task']);
  }
  return TaskModel.fromJson(response.data);
}
```

**修改後 (新格式)**:
```dart
Future<TaskModel> updateTask(
  String taskId,
  Map<String, dynamic> request,
) async {
  final body = {'taskId': taskId, ...request};
  final response = await _dio.patch('/api/tasks', data: body);

  // ✅ 新格式：{ success: true, data: { task: {...}, message: "..." }, meta: {...} }
  final responseData = response.data as Map<String, dynamic>;

  if (responseData['success'] != true) {
    throw ApiException(
      code: responseData['error']?['code'] ?? 'UNKNOWN_ERROR',
      message: responseData['error']?['message'] ?? 'Unknown error occurred',
    );
  }

  final data = responseData['data'] as Map<String, dynamic>;
  return TaskModel.fromJson(data['task']);
}
```

---

## 🛠️ 建立統一的錯誤處理

### 2. **app/lib/core/error/api_exception.dart** (新檔案)

建立統一的 API Exception 類別：

```dart
/// API 錯誤異常
class ApiException implements Exception {
  final String code;
  final String message;
  final dynamic details;

  ApiException({
    required this.code,
    required this.message,
    this.details,
  });

  @override
  String toString() => 'ApiException($code): $message';

  /// 是否為認證錯誤
  bool get isUnauthorized => code == 'UNAUTHORIZED';

  /// 是否為驗證錯誤
  bool get isValidationError => code == 'VALIDATION_ERROR';

  /// 是否為找不到資源
  bool get isNotFound => code == 'NOT_FOUND';
}
```

### 3. **app/lib/data/datasources/remote/api_response_parser.dart** (新檔案)

建立統一的回應解析器：

```dart
/// 統一的 API 回應解析器
class ApiResponseParser {
  /// 解析單一物件回應
  static T parseSingle<T>(
    Map<String, dynamic> response,
    T Function(Map<String, dynamic>) fromJson,
  ) {
    if (response['success'] != true) {
      throw _parseError(response);
    }

    return fromJson(response['data'] as Map<String, dynamic>);
  }

  /// 解析列表回應
  static List<T> parseList<T>(
    Map<String, dynamic> response,
    T Function(Map<String, dynamic>) fromJson,
  ) {
    if (response['success'] != true) {
      throw _parseError(response);
    }

    return (response['data'] as List)
        .map((json) => fromJson(json as Map<String, dynamic>))
        .toList();
  }

  /// 解析錯誤
  static ApiException _parseError(Map<String, dynamic> response) {
    final error = response['error'] as Map<String, dynamic>?;
    return ApiException(
      code: error?['code'] ?? 'UNKNOWN_ERROR',
      message: error?['message'] ?? 'Unknown error occurred',
      details: error?['details'],
    );
  }
}
```

---

## 🚀 簡化後的 API Client (使用輔助類)

### 4. **app/lib/data/datasources/remote/api_client.dart** (完整重構)

```dart
import 'package:dio/dio.dart';
import '../../models/task_model.dart';
import '../../models/area_model.dart';
import '../../models/product_model.dart';
import '../../../core/error/api_exception.dart';
import 'api_response_parser.dart';

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
    final response = await _dio.get(
      '/api/tasks',
      queryParameters: {
        if (status != null) 'status': status,
        if (dueDateFrom != null) 'due_date_from': dueDateFrom,
        if (dueDateTo != null) 'due_date_to': dueDateTo,
        if (completedToday == true) 'completed_today': 'true',
      },
    );

    return ApiResponseParser.parseList(
      response.data,
      TaskModel.fromJson,
    );
  }

  Future<TaskModel> updateTask(
    String taskId,
    Map<String, dynamic> request,
  ) async {
    final body = {'taskId': taskId, ...request};
    final response = await _dio.patch('/api/tasks', data: body);

    final responseData = response.data as Map<String, dynamic>;

    if (responseData['success'] != true) {
      throw ApiResponseParser._parseError(responseData);
    }

    // data: { task: {...}, message: "..." }
    final data = responseData['data'] as Map<String, dynamic>;
    return TaskModel.fromJson(data['task']);
  }

  // ==================== Areas ====================

  Future<List<AreaModel>> getAreas() async {
    final response = await _dio.get('/api/areas');
    return ApiResponseParser.parseList(
      response.data,
      AreaModel.fromJson,
    );
  }

  // ==================== Products ====================

  Future<List<ProductModel>> getProducts() async {
    final response = await _dio.get('/api/products');
    return ApiResponseParser.parseList(
      response.data,
      ProductModel.fromJson,
    );
  }

  // ... 其他方法依此類推
}
```

---

## ✅ 檢查清單

完成以下步驟確保遷移正確：

- [ ] 建立 `app/lib/core/error/api_exception.dart`
- [ ] 建立 `app/lib/data/datasources/remote/api_response_parser.dart`
- [ ] 更新 `app/lib/data/datasources/remote/api_client.dart` 的所有方法
- [ ] 測試 GET `/api/tasks` (確認能正確解析列表)
- [ ] 測試 PATCH `/api/tasks` (確認能正確解析更新回應)
- [ ] 測試錯誤處理 (401, 400, 500 等)
- [ ] 更新所有其他 API 方法 (Areas, Products, etc.)

---

## 🔍 錯誤代碼對照表

| HTTP Status | Error Code | 說明 |
|-------------|------------|------|
| 400 | `VALIDATION_ERROR` | 參數驗證失敗 |
| 401 | `UNAUTHORIZED` | 未認證或 Token 無效 |
| 403 | `FORBIDDEN` | 無權限 |
| 404 | `NOT_FOUND` | 資源不存在 |
| 409 | `CONFLICT` | 資源衝突 |
| 422 | `BUSINESS_LOGIC_ERROR` | 業務規則不允許 |
| 500 | `INTERNAL_ERROR` | 內部錯誤 |
| 503 | `SERVICE_UNAVAILABLE` | 外部服務不可用 |

---

## 📚 參考資料

- [036_NextJS_Internal_Architecture_Separation.md](./036_NextJS_Internal_Architecture_Separation.md) - Next.js 架構文檔
- [lib/api-response.ts](../../web/lib/api-response.ts) - Backend API 回應格式定義

---

**文件結束** | 如有疑問請聯繫 Backend Team
