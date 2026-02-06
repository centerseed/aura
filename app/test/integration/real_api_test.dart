import 'package:flutter_test/flutter_test.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:app/data/datasources/remote/api_client.dart';
import 'package:app/core/config/app_config.dart';
import 'package:dio/dio.dart';

/// 真實的 API 整合測試
///
/// 這個測試會實際連接到本地後端，執行完整的 CRUD 操作
///
/// 前置要求:
/// 1. 本地後端必須在 http://localhost:3002 運行
/// 2. Firebase 必須正確配置
/// 3. 需要有測試用戶
///
/// 執行方式:
/// ```bash
/// flutter test test/integration/real_api_test.dart
/// ```
void main() {
  group('真實 API 整合測試', () {
    late Dio dio;
    late ApiClient apiClient;
    String? authToken;

    setUpAll(() async {
      // 初始化 Firebase (如果需要)
      // await Firebase.initializeApp();

      // 設定 Dio
      dio = Dio(BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 30),
        headers: {
          'Content-Type': 'application/json',
        },
      ));

      // 啟用詳細日誌
      dio.interceptors.add(LogInterceptor(
        requestBody: true,
        responseBody: true,
        error: true,
        logPrint: (obj) => print('[API] $obj'),
      ));

      apiClient = ApiClient(dio);
    });

    test('測試環境配置', () {
      print('\n========================================');
      print('測試環境資訊');
      print('========================================');
      print('Debug Mode: ${AppConfig.isDebugMode}');
      print('API Base URL: ${AppConfig.apiBaseUrl}');
      print('========================================\n');

      expect(AppConfig.isDebugMode, isTrue);
      expect(AppConfig.apiBaseUrl, contains('localhost'));
    });

    test('後端連線檢查 - 測試任意端點返回認證錯誤', () async {
      try {
        await dio.get('/tasks');
        fail('應該要拋出 401 錯誤');
      } catch (e) {
        if (e is DioException) {
          print('\n✅ 後端正常運行');
          print('狀態碼: ${e.response?.statusCode}');
          print('錯誤訊息: ${e.response?.data}');

          // 驗證返回的是認證錯誤，證明後端正常運行
          expect(e.response?.statusCode, equals(401));
          expect(e.response?.data['success'], equals(false));
          expect(e.response?.data['error']['code'],
            anyOf(equals('UNAUTHORIZED'), equals('INTERNAL_ERROR')));
        } else {
          fail('預期是 DioException，但得到: ${e.runtimeType}');
        }
      }
    });

    // TODO: 實作真實的認證測試
    // 需要先有測試用戶或測試 token
    test('完整 CRUD 測試 (需要認證)', () async {
      print('\n⚠️  此測試需要有效的認證 token');
      print('請先實作以下步驟:');
      print('1. 建立測試用戶');
      print('2. 獲取 Firebase ID Token');
      print('3. 將 token 添加到請求 header');
      print('');

      // 示範如何添加認證 header
      /*
      dio.options.headers['Authorization'] = 'Bearer $authToken';

      try {
        // 1. 測試獲取 Areas
        print('測試 GET /api/areas...');
        final areas = await apiClient.getAreas();
        expect(areas, isNotEmpty);
        print('✅ 成功獲取 ${areas.length} 個 Areas');

        // 2. 測試獲取 Products
        print('測試 GET /api/products...');
        final products = await apiClient.getProducts();
        print('✅ 成功獲取 ${products.length} 個 Products');

        // 3. 測試獲取 Tasks
        print('測試 GET /api/tasks...');
        final tasks = await apiClient.getTasks();
        print('✅ 成功獲取 ${tasks.length} 個 Tasks');

        // 4. 測試建立 Task
        if (products.isNotEmpty) {
          print('測試 POST /api/tasks...');
          final newTask = await apiClient.createTask({
            'content': 'Flutter 整合測試任務',
            'product_id': products.first.id,
            'status': 'INBOX',
          });
          expect(newTask.content, equals('Flutter 整合測試任務'));
          print('✅ 成功建立任務: ${newTask.id}');

          // 5. 測試更新 Task
          print('測試 PATCH /api/tasks...');
          final updatedTask = await apiClient.updateTask(
            newTask.id,
            {'status': 'ACTIVE'},
          );
          expect(updatedTask.status, equals('ACTIVE'));
          print('✅ 成功更新任務狀態');

          // 6. 測試刪除 Task
          print('測試 DELETE /api/tasks/${newTask.id}...');
          await apiClient.deleteTask(newTask.id);
          print('✅ 成功刪除任務');
        }

        print('\n🎉 所有 CRUD 測試通過!\n');
      } catch (e) {
        print('\n❌ 測試失敗: $e\n');
        rethrow;
      }
      */
    }, skip: true);

    test('顯示如何獲取測試 Token 的說明', () {
      print('\n========================================');
      print('如何獲取測試 Token');
      print('========================================');
      print('');
      print('方法 1: 使用 Firebase Admin SDK');
      print('  1. 在後端建立測試用戶');
      print('  2. 使用 Firebase Admin 生成 custom token');
      print('  3. 將 token 添加到 Flutter 測試');
      print('');
      print('方法 2: 使用真實登入');
      print('  1. 在 Flutter 測試中初始化 Firebase');
      print('  2. 使用測試帳號登入');
      print('  3. 獲取 ID Token');
      print('');
      print('方法 3: 在後端添加測試模式');
      print('  1. 在後端添加 TEST_MODE 環境變數');
      print('  2. 當 TEST_MODE=true 時跳過認證');
      print('  3. 僅在本地開發環境使用');
      print('');
      print('========================================\n');
    });
  });
}
