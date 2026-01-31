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
        // 嘗試連接到根路徑
        final response = await dio.get('/');

        print('✅ API 連線成功!');
        print('Status Code: ${response.statusCode}');
        print('Response: ${response.data}');

        expect(response.statusCode, equals(200));
      } catch (e) {
        print('❌ API 連線失敗!');
        print('錯誤: $e');

        if (e is DioException) {
          print('錯誤類型: ${e.type}');
          print('錯誤訊息: ${e.message}');
          if (e.response != null) {
            print('回應狀態碼: ${e.response?.statusCode}');
            print('回應內容: ${e.response?.data}');
          }
        }

        rethrow;
      }
    });

    test('應該能存取 /api/me 端點', () async {
      try {
        // 注意: 這個測試會因為未認證而失敗,但可以驗證端點存在
        final response = await dio.get('/api/me');

        print('✅ /api/me 端點可存取!');
        print('Status Code: ${response.statusCode}');

        expect(response.statusCode, isIn([200, 401, 403]));
      } catch (e) {
        if (e is DioException && e.response?.statusCode == 401) {
          print('✅ /api/me 端點存在 (未認證,預期行為)');
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
        final response = await dio.get('/api/areas');

        print('✅ /api/areas 端點可存取!');
        print('Status Code: ${response.statusCode}');

        expect(response.statusCode, isIn([200, 401, 403]));
      } catch (e) {
        if (e is DioException && e.response?.statusCode == 401) {
          print('✅ /api/areas 端點存在 (未認證,預期行為)');
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
        final response = await dio.get('/api/products');

        print('✅ /api/products 端點可存取!');
        print('Status Code: ${response.statusCode}');

        expect(response.statusCode, isIn([200, 401, 403]));
      } catch (e) {
        if (e is DioException && e.response?.statusCode == 401) {
          print('✅ /api/products 端點存在 (未認證,預期行為)');
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
        final response = await dio.get('/api/tasks');

        print('✅ /api/tasks 端點可存取!');
        print('Status Code: ${response.statusCode}');

        expect(response.statusCode, isIn([200, 401, 403]));
      } catch (e) {
        if (e is DioException && e.response?.statusCode == 401) {
          print('✅ /api/tasks 端點存在 (未認證,預期行為)');
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
      print('環境: ${AppConfig.environment.name}');
      print('API Base URL: ${AppConfig.apiBaseUrl}');
      print('Firebase Project ID: ${AppConfig.firebaseProjectId}');
      print('App Name: ${AppConfig.appName}');
      print('App Version: ${AppConfig.appVersion}');
      print('Debug Mode: ${AppConfig.isDebugMode}');
      print('API Timeout: ${AppConfig.apiTimeout}s');
      print('========================================\n');

      expect(AppConfig.apiBaseUrl, isNotEmpty);
      expect(AppConfig.firebaseProjectId, isNotEmpty);

      // 根據環境驗證 Base URL
      if (AppConfig.environment == Environment.production) {
        expect(
          AppConfig.apiBaseUrl,
          equals('https://zentropy-api-894512935237.asia-east1.run.app'),
        );
      }
    });
  });
}
