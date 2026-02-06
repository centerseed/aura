import 'package:flutter_test/flutter_test.dart';
import 'package:app/data/datasources/remote/api_client.dart';
import 'package:app/core/config/app_config.dart';
import 'package:dio/dio.dart';

import 'helpers/firebase_test_auth.dart';

/// Product References CRUD 整合測試
///
/// 使用 Firebase Auth REST API 取得 token（不依賴 Flutter Firebase SDK）
///
/// 執行方式:
/// ```bash
/// flutter test test/integration/product_references_test.dart
/// ```
void main() {
  group('📚 Product References CRUD 整合測試', () {
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

    test('1️⃣  測試 GET Product References - 獲取產品的參考資料', () async {
      print('\n測試: GET /products/{id}/references');
      print('----------------------------');

      final products = await apiClient.getProducts();
      if (products.isEmpty) {
        print('⚠️  沒有可用的產品，跳過測試');
        return;
      }

      final productId = products.first.id;
      print('使用產品 ID: $productId');

      final references = await apiClient.getProductReferences(productId);

      print('References 數量: ${references.length}');

      expect(references, isNotNull);
      if (references.isNotEmpty) {
        print('✅ 第一個 Reference:');
        print('   ID: ${references.first.id}');
        print('   Type: ${references.first.type}');
        print('   Content: ${references.first.content}');
      } else {
        print('✅ 產品目前沒有 References');
      }
    });

    test('2️⃣  測試完整 CRUD - 新增 URL、Note 和刪除 Reference', () async {
      print('\n測試: Reference 完整 CRUD 流程');
      print('========================================');

      final products = await apiClient.getProducts();
      if (products.isEmpty) {
        print('⚠️  沒有可用的產品，跳過 CRUD 測試');
        return;
      }

      final productId = products.first.id;
      print('使用產品 ID: $productId');

      // 1. CREATE - URL
      print('\n步驟 1: 新增 URL Reference...');
      final urlReference = await apiClient.addProductReference(
        productId: productId,
        type: 'url',
        content: 'https://flutter.dev/docs',
        title: 'Flutter Documentation',
      );

      expect(urlReference.type, equals('url'));
      expect(urlReference.content, equals('https://flutter.dev/docs'));
      print('✅ URL Reference 創建成功: ${urlReference.id}');

      // 2. CREATE - Note
      print('\n步驟 2: 新增 Note Reference...');
      final noteReference = await apiClient.addProductReference(
        productId: productId,
        type: 'note',
        content: '這是一個測試筆記\n- 第一點\n- 第二點',
        title: '測試筆記',
      );

      expect(noteReference.type, equals('note'));
      print('✅ Note Reference 創建成功: ${noteReference.id}');

      // 3. READ - 確認
      print('\n步驟 3: 讀取所有 References 確認...');
      final allReferences = await apiClient.getProductReferences(productId);
      expect(allReferences.any((r) => r.id == urlReference.id), isTrue);
      expect(allReferences.any((r) => r.id == noteReference.id), isTrue);
      print('✅ References 讀取成功，共 ${allReferences.length} 個');

      // 4. DELETE
      print('\n步驟 4: 刪除測試 References...');
      await apiClient.deleteProductReference(
        productId: productId,
        referenceId: urlReference.id,
      );
      await apiClient.deleteProductReference(
        productId: productId,
        referenceId: noteReference.id,
      );
      print('✅ 刪除成功');

      // 5. 驗證刪除
      print('\n步驟 5: 驗證已刪除...');
      final refsAfterDelete = await apiClient.getProductReferences(productId);
      expect(refsAfterDelete.any((r) => r.id == urlReference.id), isFalse);
      expect(refsAfterDelete.any((r) => r.id == noteReference.id), isFalse);
      print('✅ 確認已刪除');

      print('\n🎉 完整 CRUD 測試通過！');
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
  });
}
