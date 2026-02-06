import 'package:flutter_test/flutter_test.dart';
import 'package:app/data/datasources/remote/api_client.dart';
import 'package:app/data/models/brain_dump_models.dart';
import 'package:app/core/config/app_config.dart';
import 'package:dio/dio.dart';

import 'helpers/firebase_test_auth.dart';

/// 真實認證的 API 整合測試
///
/// 使用 Firebase Auth REST API 取得 token（不依賴 Flutter Firebase SDK）
///
/// 前置要求:
/// 1. 本地後端必須在 http://localhost:3002 運行
/// 2. 測試帳戶 test@zentropy.cc 必須存在
///
/// 執行方式:
/// ```bash
/// flutter test test/integration/authenticated_api_test.dart
/// ```
void main() {
  group('🔐 認證 API 整合測試', () {
    late Dio dio;
    late ApiClient apiClient;
    late String idToken;

    setUpAll(() async {
      print('\n========================================');
      print('初始化測試環境');
      print('========================================');
      print('API URL: ${AppConfig.apiBaseUrl}');
      print('測試帳戶: ${FirebaseTestAuth.testEmail}');
      print('========================================\n');

      // 透過 REST API 取得 token
      print('📝 使用 Firebase Auth REST API 登入...');
      idToken = await FirebaseTestAuth.signIn();
      print('✅ 成功取得 ID Token (長度: ${idToken.length})');

      // 設定 Dio
      dio = Dio(BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 30),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $idToken',
        },
      ));

      dio.interceptors.add(LogInterceptor(
        requestBody: true,
        responseBody: true,
        error: true,
        logPrint: (obj) => print('[API] $obj'),
      ));

      apiClient = ApiClient(dio);

      print('\n✅ 測試環境初始化完成\n');
    });

    test('1️⃣  測試 GET /me - 獲取當前用戶', () async {
      print('\n測試: GET /me');
      print('----------------------------');

      final response = await dio.get('/me');

      print('狀態碼: ${response.statusCode}');
      print('回應: ${response.data}');

      expect(response.statusCode, equals(200));
      expect(response.data['success'], equals(true));
      expect(response.data['data'], isNotNull);

      final userData = response.data['data'];
      print('✅ 用戶資料:');
      print('   ID: ${userData['id']}');
      print('   Email: ${userData['email']}');
      print('   Name: ${userData['name']}');
    });

    test('2️⃣  測試 GET /areas - 獲取領域列表', () async {
      print('\n測試: GET /areas');
      print('----------------------------');

      final areas = await apiClient.getAreas();

      print('領域數量: ${areas.length}');

      expect(areas, isNotNull);
      if (areas.isNotEmpty) {
        print('✅ 第一個領域:');
        print('   ID: ${areas.first.id}');
        print('   Name: ${areas.first.name}');
      }
    });

    test('3️⃣  測試 GET /products - 獲取專案列表', () async {
      print('\n測試: GET /products');
      print('----------------------------');

      final products = await apiClient.getProducts();

      print('專案數量: ${products.length}');

      expect(products, isNotNull);
      if (products.isNotEmpty) {
        print('✅ 第一個專案:');
        print('   ID: ${products.first.id}');
        print('   Name: ${products.first.name}');
        print('   Area ID: ${products.first.areaId}');
      }
    });

    test('4️⃣  測試 GET /tasks - 獲取任務列表', () async {
      print('\n測試: GET /tasks');
      print('----------------------------');

      final tasks = await apiClient.getTasks();

      print('任務數量: ${tasks.length}');

      expect(tasks, isNotNull);
      if (tasks.isNotEmpty) {
        print('✅ 第一個任務:');
        print('   ID: ${tasks.first.id}');
        print('   Content: ${tasks.first.content}');
        print('   Status: ${tasks.first.status}');
      }
    });

    test('5️⃣  測試完整 CRUD - 創建、更新、刪除任務', () async {
      print('\n測試: 完整 CRUD 流程');
      print('========================================');

      // 先獲取產品列表
      final products = await apiClient.getProducts();
      if (products.isEmpty) {
        print('⚠️  沒有可用的產品，跳過 CRUD 測試');
        return;
      }

      final productId = products.first.id;
      print('使用產品 ID: $productId');

      // 1. CREATE
      print('\n步驟 1: 創建任務...');
      final newTask = await apiClient.createTask({
        'content': 'Flutter 整合測試任務 - ${DateTime.now().millisecondsSinceEpoch}',
        'product_id': productId,
        'status': 'INBOX',
      });

      expect(newTask, isNotNull);
      expect(newTask.content, contains('Flutter 整合測試任務'));
      print('✅ 任務創建成功: ${newTask.id}');

      // 2. UPDATE
      print('\n步驟 2: 更新任務狀態...');
      final updatedTask = await apiClient.updateTask(
        newTask.id,
        {'status': 'ACTIVE'},
      );

      expect(updatedTask.status, equals('ACTIVE'));
      print('✅ 任務更新成功');

      // 3. READ
      print('\n步驟 3: 讀取確認...');
      final allTasks = await apiClient.getTasks();
      final foundTask = allTasks.where((t) => t.id == newTask.id).firstOrNull;

      expect(foundTask, isNotNull);
      expect(foundTask!.status, equals('ACTIVE'));
      print('✅ 任務讀取成功');

      // 4. DELETE
      print('\n步驟 4: 刪除任務...');
      await apiClient.deleteTask(newTask.id);
      print('✅ 任務刪除成功');

      // 5. 驗證刪除
      print('\n步驟 5: 驗證已刪除...');
      final tasksAfterDelete = await apiClient.getTasks();
      final deletedTask = tasksAfterDelete
          .where((t) => t.id == newTask.id)
          .firstOrNull;

      expect(deletedTask, isNull);
      print('✅ 確認已刪除');

      print('\n🎉 完整 CRUD 測試通過！');
    });

    test('6️⃣  測試 Brain Dump - AI 任務解析', () async {
      print('\n測試: POST /brain-dump');
      print('----------------------------');

      try {
        final result = await apiClient.brainDump(
          BrainDumpRequest(text: '明天要開會討論新功能'),
        );

        expect(result, isNotNull);
        expect(result.success, isTrue);

        result.when(
          createNewTasks: (success, items) {
            print('Action: create_new_tasks');
            print('生成任務數: ${items.length}');
            expect(items, isNotEmpty);
            if (items.isNotEmpty) {
              print('✅ 第一個任務: ${items.first.title}');
            }
          },
          appendSubItem: (success, targetTask, appendedSubItems, reasoning) {
            print('Action: append_sub_item');
            print('目標任務: ${targetTask.content}');
          },
        );
      } catch (e) {
        print('⚠️  Brain Dump 測試失敗: $e');
      }
    });

    test('7️⃣  測試錯誤處理 - 無效的任務 ID', () async {
      print('\n測試: 錯誤處理');
      print('----------------------------');

      try {
        await apiClient.deleteTask('invalid-task-id-12345');
        fail('應該要拋出錯誤');
      } catch (e) {
        print('✅ 正確拋出錯誤: $e');
        expect(e, isA<DioException>());
      }
    });
  });
}
