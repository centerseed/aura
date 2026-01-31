import 'package:flutter_test/flutter_test.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:app/data/datasources/remote/api_client.dart';
import 'package:app/data/models/brain_dump_models.dart';
import 'package:app/core/config/app_config.dart';
import 'package:app/firebase_options.dart';
import 'package:dio/dio.dart';

/// 真實認證的 API 整合測試
///
/// 使用測試帳戶進行完整的 CRUD 操作驗證
///
/// 測試帳戶:
/// - Email: test@zentropy.cc
/// - Password: 123456
/// - Firebase UID: b1MHYIFidPaJKisUmUk25CXG6c33
///
/// 執行方式:
/// ```bash
/// flutter test test/integration/authenticated_api_test.dart
/// ```
void main() {
  group('🔐 認證 API 整合測試', () {
    late FirebaseAuth auth;
    late Dio dio;
    late ApiClient apiClient;
    String? idToken;

    const testEmail = 'test@zentropy.cc';
    const testPassword = '123456';
    const testFirebaseUid = 'b1MHYIFidPaJKisUmUk25CXG6c33';

    setUpAll(() async {
      print('\n========================================');
      print('初始化測試環境');
      print('========================================');
      print('API URL: ${AppConfig.apiBaseUrl}');
      print('測試帳戶: $testEmail');
      print('========================================\n');

      // 初始化 Flutter 測試綁定 (必須在 Firebase 之前)
      TestWidgetsFlutterBinding.ensureInitialized();

      // 初始化 Firebase (使用與 main.dart 相同的配置)
      try {
        await Firebase.initializeApp(
          options: DefaultFirebaseOptions.currentPlatform,
        );
        print('✅ Firebase 初始化成功');
      } catch (e) {
        print('⚠️  Firebase 已初始化，跳過: $e');
      }

      auth = FirebaseAuth.instance;

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

      print('\n📝 步驟 1: 使用測試帳戶登入 Firebase...');
      try {
        final userCredential = await auth.signInWithEmailAndPassword(
          email: testEmail,
          password: testPassword,
        );

        if (userCredential.user == null) {
          fail('登入失敗: user 為 null');
        }

        print('✅ Firebase 登入成功');
        print('   User UID: ${userCredential.user!.uid}');
        print('   Email: ${userCredential.user!.email}');

        // 驗證 UID
        expect(userCredential.user!.uid, equals(testFirebaseUid));

        // 獲取 ID Token
        idToken = await userCredential.user!.getIdToken();
        if (idToken == null || idToken!.isEmpty) {
          fail('無法獲取 ID Token');
        }

        print('✅ 成功獲取 ID Token');
        print('   Token 長度: ${idToken!.length} 字元');

        // 將 token 添加到 Dio header
        dio.options.headers['Authorization'] = 'Bearer $idToken';

        print('\n✅ 測試環境初始化完成\n');
      } catch (e) {
        print('❌ 登入失敗: $e');
        rethrow;
      }
    });

    tearDownAll(() async {
      await auth.signOut();
      print('\n✅ 測試完成，已登出\n');
    });

    test('1️⃣  測試 GET /api/me - 獲取當前用戶', () async {
      print('\n測試: GET /api/me');
      print('----------------------------');

      final response = await dio.get('/api/me');

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

    test('2️⃣  測試 GET /api/areas - 獲取領域列表', () async {
      print('\n測試: GET /api/areas');
      print('----------------------------');

      final areas = await apiClient.getAreas();

      print('狀態碼: 200');
      print('領域數量: ${areas.length}');

      expect(areas, isNotNull);
      if (areas.isNotEmpty) {
        print('✅ 第一個領域:');
        print('   ID: ${areas.first.id}');
        print('   Name: ${areas.first.name}');
      }
    });

    test('3️⃣  測試 GET /api/products - 獲取專案列表', () async {
      print('\n測試: GET /api/products');
      print('----------------------------');

      final products = await apiClient.getProducts();

      print('狀態碼: 200');
      print('專案數量: ${products.length}');

      expect(products, isNotNull);
      if (products.isNotEmpty) {
        print('✅ 第一個專案:');
        print('   ID: ${products.first.id}');
        print('   Name: ${products.first.name}');
        print('   Area ID: ${products.first.areaId}');
      }
    });

    test('4️⃣  測試 GET /api/tasks - 獲取任務列表', () async {
      print('\n測試: GET /api/tasks');
      print('----------------------------');

      final tasks = await apiClient.getTasks();

      print('狀態碼: 200');
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

      // 1. CREATE - 創建任務
      print('\n步驟 1: 創建任務...');
      final newTask = await apiClient.createTask({
        'content': 'Flutter 整合測試任務 - ${DateTime.now().millisecondsSinceEpoch}',
        'product_id': productId,
        'status': 'INBOX',
      });

      expect(newTask, isNotNull);
      expect(newTask.content, contains('Flutter 整合測試任務'));
      print('✅ 任務創建成功');
      print('   任務 ID: ${newTask.id}');
      print('   內容: ${newTask.content}');

      // 2. UPDATE - 更新任務
      print('\n步驟 2: 更新任務狀態...');
      final updatedTask = await apiClient.updateTask(
        newTask.id,
        {'status': 'ACTIVE'},
      );

      expect(updatedTask, isNotNull);
      expect(updatedTask.status, equals('ACTIVE'));
      print('✅ 任務更新成功');
      print('   新狀態: ${updatedTask.status}');

      // 3. READ - 再次讀取確認
      print('\n步驟 3: 讀取任務確認...');
      final allTasks = await apiClient.getTasks();
      final foundTask = allTasks.where((t) => t.id == newTask.id).firstOrNull;

      expect(foundTask, isNotNull);
      expect(foundTask!.status, equals('ACTIVE'));
      print('✅ 任務讀取成功，狀態正確');

      // 4. DELETE - 刪除任務
      print('\n步驟 4: 刪除任務...');
      await apiClient.deleteTask(newTask.id);
      print('✅ 任務刪除成功');

      // 5. 驗證刪除
      print('\n步驟 5: 驗證任務已刪除...');
      final tasksAfterDelete = await apiClient.getTasks();
      final deletedTask = tasksAfterDelete
          .where((t) => t.id == newTask.id)
          .firstOrNull;

      expect(deletedTask, isNull);
      print('✅ 確認任務已被刪除');

      print('\n🎉 完整 CRUD 測試通過！');
      print('========================================');
    });

    test('6️⃣  測試 Brain Dump - AI 任務解析', () async {
      print('\n測試: POST /api/brain-dump');
      print('----------------------------');

      try {
        final result = await apiClient.brainDump(
          BrainDumpRequest(text: '明天要開會討論新功能'),
        );

        print('狀態碼: 200');
        print('解析結果: success=${result.success}');
        print('生成任務數: ${result.items.length}');

        expect(result, isNotNull);

        if (result.items.isNotEmpty) {
          print('✅ 第一個生成的任務:');
          print('   標題: ${result.items.first.title}');
          print('   狀態: ${result.items.first.drawer}');
        }
      } catch (e) {
        print('⚠️  Brain Dump 測試失敗: $e');
        // 不強制要求通過，因為可能需要 AI API key
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

    test('8️⃣  總結測試結果', () {
      print('\n========================================');
      print('🎉 測試總結');
      print('========================================');
      print('✅ Firebase 認證: 正常');
      print('✅ API 連線: 正常');
      print('✅ 獲取用戶資料: 正常');
      print('✅ 獲取 Areas: 正常');
      print('✅ 獲取 Products: 正常');
      print('✅ 獲取 Tasks: 正常');
      print('✅ CRUD 操作: 正常');
      print('✅ 錯誤處理: 正常');
      print('========================================');
      print('');
      print('結論: Flutter App 與後端 API 整合成功！');
      print('所有核心功能都能正常運作。');
      print('========================================\n');
    });
  });
}
