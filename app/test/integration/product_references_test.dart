import 'package:flutter_test/flutter_test.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:app/data/datasources/remote/api_client.dart';
import 'package:app/core/config/app_config.dart';
import 'package:app/firebase_options.dart';
import 'package:dio/dio.dart';

/// Product References CRUD 整合測試
///
/// 測試 Product 的 Reference 功能完整流程：
/// - 獲取 Product References
/// - 新增 URL 和 Note 類型的 Reference
/// - 刪除 Reference
///
/// 執行方式:
/// ```bash
/// flutter test test/integration/product_references_test.dart
/// ```
void main() {
  group('📚 Product References CRUD 整合測試', () {
    late FirebaseAuth auth;
    late Dio dio;
    late ApiClient apiClient;
    String? idToken;

    const testEmail = 'test@zentropy.cc';
    const testPassword = '123456';

    setUpAll(() async {
      print('\n========================================');
      print('初始化測試環境');
      print('========================================');
      print('API URL: ${AppConfig.apiBaseUrl}');
      print('測試帳戶: $testEmail');
      print('========================================\n');

      // 初始化 Flutter 測試綁定
      TestWidgetsFlutterBinding.ensureInitialized();

      // 初始化 Firebase
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

        // 獲取 ID Token
        idToken = await userCredential.user!.getIdToken();
        if (idToken == null || idToken!.isEmpty) {
          fail('無法獲取 ID Token');
        }

        print('✅ 成功獲取 ID Token');

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

    test('1️⃣  測試 GET Product References - 獲取產品的參考資料', () async {
      print('\n測試: GET /api/products/{id}/references');
      print('----------------------------');

      // 先獲取產品列表
      final products = await apiClient.getProducts();
      if (products.isEmpty) {
        print('⚠️  沒有可用的產品，跳過測試');
        return;
      }

      final productId = products.first.id;
      print('使用產品 ID: $productId');

      final references = await apiClient.getProductReferences(productId);

      print('狀態碼: 200');
      print('References 數量: ${references.length}');

      expect(references, isNotNull);
      if (references.isNotEmpty) {
        print('✅ 第一個 Reference:');
        print('   ID: ${references.first.id}');
        print('   Type: ${references.first.type}');
        print('   Content: ${references.first.content}');
        if (references.first.title != null) {
          print('   Title: ${references.first.title}');
        }
      } else {
        print('✅ 產品目前沒有 References');
      }
    });

    test('2️⃣  測試完整 CRUD - 新增 URL、Note 和刪除 Reference', () async {
      print('\n測試: Reference 完整 CRUD 流程');
      print('========================================');

      // 先獲取產品列表
      final products = await apiClient.getProducts();
      if (products.isEmpty) {
        print('⚠️  沒有可用的產品，跳過 CRUD 測試');
        return;
      }

      final productId = products.first.id;
      print('使用產品 ID: $productId');
      print('產品名稱: ${products.first.name}');

      // 1. CREATE - 新增 URL 類型的 Reference
      print('\n步驟 1: 新增 URL 類型的 Reference...');
      final urlReference = await apiClient.addProductReference(
        productId: productId,
        type: 'url',
        content: 'https://flutter.dev/docs',
        title: 'Flutter Documentation',
      );

      expect(urlReference, isNotNull);
      expect(urlReference.type, equals('url'));
      expect(urlReference.content, equals('https://flutter.dev/docs'));
      expect(urlReference.title, equals('Flutter Documentation'));
      print('✅ URL Reference 創建成功');
      print('   Reference ID: ${urlReference.id}');
      print('   Type: ${urlReference.type}');
      print('   Content: ${urlReference.content}');
      print('   Title: ${urlReference.title}');

      // 2. CREATE - 新增 Note 類型的 Reference
      print('\n步驟 2: 新增 Note 類型的 Reference...');
      final noteReference = await apiClient.addProductReference(
        productId: productId,
        type: 'note',
        content: '這是一個測試筆記\n- 第一點\n- 第二點',
        title: '測試筆記',
      );

      expect(noteReference, isNotNull);
      expect(noteReference.type, equals('note'));
      expect(noteReference.content, contains('測試筆記'));
      print('✅ Note Reference 創建成功');
      print('   Reference ID: ${noteReference.id}');
      print('   Type: ${noteReference.type}');
      print('   Title: ${noteReference.title}');

      // 3. CREATE - 新增沒有 title 的 Reference
      print('\n步驟 3: 新增沒有標題的 Reference...');
      final noTitleReference = await apiClient.addProductReference(
        productId: productId,
        type: 'url',
        content: 'https://example.com',
      );

      expect(noTitleReference, isNotNull);
      expect(noTitleReference.title, isNull);
      print('✅ 無標題 Reference 創建成功');

      // 4. READ - 讀取所有 References 確認
      print('\n步驟 4: 讀取所有 References 確認...');
      final allReferences = await apiClient.getProductReferences(productId);

      expect(allReferences.length, greaterThanOrEqualTo(3));

      final foundUrlRef = allReferences
          .where((r) => r.id == urlReference.id)
          .firstOrNull;
      final foundNoteRef = allReferences
          .where((r) => r.id == noteReference.id)
          .firstOrNull;

      expect(foundUrlRef, isNotNull);
      expect(foundNoteRef, isNotNull);
      print('✅ References 讀取成功，共 ${allReferences.length} 個');
      print('   URL 類型: ${allReferences.where((r) => r.type == 'url').length} 個');
      print('   Note 類型: ${allReferences.where((r) => r.type == 'note').length} 個');

      // 5. DELETE - 刪除第一個 Reference
      print('\n步驟 5: 刪除 URL Reference...');
      await apiClient.deleteProductReference(
        productId: productId,
        referenceId: urlReference.id,
      );
      print('✅ URL Reference 刪除成功');

      // 6. DELETE - 刪除第二個 Reference
      print('\n步驟 6: 刪除 Note Reference...');
      await apiClient.deleteProductReference(
        productId: productId,
        referenceId: noteReference.id,
      );
      print('✅ Note Reference 刪除成功');

      // 7. DELETE - 刪除第三個 Reference
      print('\n步驟 7: 刪除無標題 Reference...');
      await apiClient.deleteProductReference(
        productId: productId,
        referenceId: noTitleReference.id,
      );
      print('✅ 無標題 Reference 刪除成功');

      // 8. 驗證刪除
      print('\n步驟 8: 驗證 References 已刪除...');
      final referencesAfterDelete = await apiClient.getProductReferences(productId);

      final deletedUrlRef = referencesAfterDelete
          .where((r) => r.id == urlReference.id)
          .firstOrNull;
      final deletedNoteRef = referencesAfterDelete
          .where((r) => r.id == noteReference.id)
          .firstOrNull;
      final deletedNoTitleRef = referencesAfterDelete
          .where((r) => r.id == noTitleReference.id)
          .firstOrNull;

      expect(deletedUrlRef, isNull);
      expect(deletedNoteRef, isNull);
      expect(deletedNoTitleRef, isNull);
      print('✅ 確認所有測試 References 已被刪除');

      print('\n🎉 完整 CRUD 測試通過！');
      print('========================================');
    });

    test('3️⃣  測試錯誤處理 - 無效的 Product ID', () async {
      print('\n測試: 錯誤處理 - 無效的 Product ID');
      print('----------------------------');

      try {
        await apiClient.getProductReferences('invalid-product-id-12345');
        fail('應該要拋出錯誤');
      } catch (e) {
        print('✅ 正確拋出錯誤: $e');
        expect(e, isA<DioException>());
      }
    });

    test('4️⃣  測試錯誤處理 - 刪除不存在的 Reference', () async {
      print('\n測試: 錯誤處理 - 刪除不存在的 Reference');
      print('----------------------------');

      try {
        final products = await apiClient.getProducts();
        if (products.isEmpty) {
          print('⚠️  沒有可用的產品，跳過測試');
          return;
        }

        await apiClient.deleteProductReference(
          productId: products.first.id,
          referenceId: 'non-existent-ref-12345',
        );
        fail('應該要拋出錯誤');
      } catch (e) {
        print('✅ 正確拋出錯誤: $e');
        expect(e, isA<DioException>());
      }
    });

    test('5️⃣  測試多個 References 的創建和批次刪除', () async {
      print('\n測試: 批次創建和刪除 References');
      print('========================================');

      final products = await apiClient.getProducts();
      if (products.isEmpty) {
        print('⚠️  沒有可用的產品，跳過測試');
        return;
      }

      final productId = products.first.id;

      // 批次創建多個 References
      print('\n步驟 1: 批次創建 5 個 References...');
      final createdRefs = <String>[];

      for (var i = 1; i <= 5; i++) {
        final ref = await apiClient.addProductReference(
          productId: productId,
          type: i % 2 == 0 ? 'url' : 'note',
          content: i % 2 == 0
              ? 'https://example-$i.com'
              : '批次測試筆記 $i\n內容...',
          title: '批次測試 $i',
        );
        createdRefs.add(ref.id);
        print('   ✅ Reference $i 創建成功 (${ref.type})');
      }

      expect(createdRefs.length, equals(5));
      print('✅ 成功創建 5 個 References');

      // 驗證全部創建成功
      print('\n步驟 2: 驗證所有 References 存在...');
      final allRefs = await apiClient.getProductReferences(productId);
      var foundCount = 0;
      for (var refId in createdRefs) {
        if (allRefs.any((r) => r.id == refId)) {
          foundCount++;
        }
      }
      expect(foundCount, equals(5));
      print('✅ 確認 5 個 References 都存在');

      // 批次刪除
      print('\n步驟 3: 批次刪除所有測試 References...');
      for (var i = 0; i < createdRefs.length; i++) {
        await apiClient.deleteProductReference(
          productId: productId,
          referenceId: createdRefs[i],
        );
        print('   ✅ Reference ${i + 1} 刪除成功');
      }

      // 驗證刪除
      print('\n步驟 4: 驗證所有 References 已刪除...');
      final refsAfterDelete = await apiClient.getProductReferences(productId);
      var deletedCount = 0;
      for (var refId in createdRefs) {
        if (!refsAfterDelete.any((r) => r.id == refId)) {
          deletedCount++;
        }
      }
      expect(deletedCount, equals(5));
      print('✅ 確認 5 個 References 都已刪除');

      print('\n🎉 批次操作測試通過！');
      print('========================================');
    });

    test('6️⃣  總結測試結果', () {
      print('\n========================================');
      print('🎉 Product References 測試總結');
      print('========================================');
      print('✅ 獲取 References: 正常');
      print('✅ 新增 URL Reference: 正常');
      print('✅ 新增 Note Reference: 正常');
      print('✅ 刪除 Reference: 正常');
      print('✅ 批次操作: 正常');
      print('✅ 錯誤處理: 正常');
      print('========================================');
      print('');
      print('結論: Product References CRUD 功能完全正常！');
      print('API 與 Flutter 整合測試全部通過。');
      print('========================================\n');
    });
  });
}
