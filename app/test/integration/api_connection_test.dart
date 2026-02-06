import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:app/core/config/app_config.dart';

/// API 連線測試
///
/// 驗證 Flutter App 能否正確連接到後端 API
///
/// 執行方式:
/// ```bash
/// flutter test test/integration/api_connection_test.dart
/// ```
void main() {
  group('API Connection Tests', () {
    late Dio dio;

    setUp(() {
      dio = Dio(BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 30),
        headers: {
          'Content-Type': 'application/json',
        },
      ));

      // 啟用日誌
      dio.interceptors.add(LogInterceptor(
        requestBody: true,
        responseBody: true,
        error: true,
      ));
    });

    test('應該能連接到後端 API (Health Check)', () async {
      print('\n========================================');
      print('測試 API Base URL: ${AppConfig.apiBaseUrl}');
      print('========================================\n');

      try {
        // 用 /tasks 端點驗證 server 是否運行（401 = server 活著，只是未認證）
        final response = await dio.get('/tasks');

        print('✅ API 連線成功!');
        print('Status Code: ${response.statusCode}');

        expect(response.statusCode, isIn([200, 401, 403]));
      } catch (e) {
        if (e is DioException && e.response != null) {
          // 收到 HTTP 回應（包括 401）代表 server 有在運行
          print('✅ API server 運行中 (HTTP ${e.response?.statusCode})');
          expect(e.response?.statusCode, isIn([401, 403]));
        } else {
          print('❌ API 連線失敗! (server 可能未啟動)');
          print('錯誤: $e');
          rethrow;
        }
      }
    });

    test('應該能存取 /api/me 端點', () async {
      try {
        // 注意: 這個測試會因為未認證而失敗,但可以驗證端點存在
        final response = await dio.get('/me');

        print('✅ /api/me 端點可存取!');
        print('Status Code: ${response.statusCode}');

        expect(response.statusCode, isIn([200, 401, 403]));
      } catch (e) {
        if (e is DioException && e.response?.statusCode == 401) {
          print('✅ /me 端點存在 (未認證,預期行為)');
          print('Status Code: 401');
          expect(true, true); // 401 是預期的
        } else {
          print('❌ /api/me 端點測試失敗!');
          print('錯誤: $e');
          rethrow;
        }
      }
    });

    test('應該能存取 /api/areas 端點', () async {
      try {
        final response = await dio.get('/areas');

        print('✅ /api/areas 端點可存取!');
        print('Status Code: ${response.statusCode}');

        expect(response.statusCode, isIn([200, 401, 403]));
      } catch (e) {
        if (e is DioException && e.response?.statusCode == 401) {
          print('✅ /areas 端點存在 (未認證,預期行為)');
          expect(true, true);
        } else {
          print('❌ /api/areas 端點測試失敗!');
          print('錯誤: $e');
          rethrow;
        }
      }
    });

    test('應該能存取 /api/products 端點', () async {
      try {
        final response = await dio.get('/products');

        print('✅ /api/products 端點可存取!');
        print('Status Code: ${response.statusCode}');

        expect(response.statusCode, isIn([200, 401, 403]));
      } catch (e) {
        if (e is DioException && e.response?.statusCode == 401) {
          print('✅ /products 端點存在 (未認證,預期行為)');
          expect(true, true);
        } else {
          print('❌ /api/products 端點測試失敗!');
          print('錯誤: $e');
          rethrow;
        }
      }
    });

    test('應該能存取 /api/tasks 端點', () async {
      try {
        final response = await dio.get('/tasks');

        print('✅ /api/tasks 端點可存取!');
        print('Status Code: ${response.statusCode}');

        expect(response.statusCode, isIn([200, 401, 403]));
      } catch (e) {
        if (e is DioException && e.response?.statusCode == 401) {
          print('✅ /tasks 端點存在 (未認證,預期行為)');
          expect(true, true);
        } else {
          print('❌ /api/tasks 端點測試失敗!');
          print('錯誤: $e');
          rethrow;
        }
      }
    });

    test('環境配置應該正確', () {
      print('\n========================================');
      print('環境配置檢查');
      print('========================================');
      print('API Base URL: ${AppConfig.apiBaseUrl}');
      print('Debug Mode: ${AppConfig.isDebugMode}');
      print('API Timeout: ${AppConfig.apiTimeout}s');
      print('========================================\n');

      expect(AppConfig.apiBaseUrl, isNotEmpty);
      expect(AppConfig.apiTimeout, greaterThan(0));
    });
  });
}
