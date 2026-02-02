import 'package:dio/dio.dart';

/// 日誌攔截器
/// Debug 模式下記錄所有 API 請求和響應（簡化版）
class LoggingInterceptor extends Interceptor {
  /// 是否顯示詳細日誌（包含完整 response data）
  final bool verbose;

  LoggingInterceptor({this.verbose = false});

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    print('🔵 ${options.method} ${options.uri.path}');
    if (verbose && options.data != null) {
      print('   Body: ${options.data}');
    }
    handler.next(options);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    final path = response.requestOptions.uri.path;
    final status = response.statusCode;

    // 簡化輸出：只顯示狀態碼和資料摘要
    if (verbose) {
      print('🟢 $status $path');
      print('   Data: ${response.data}');
    } else {
      // 顯示資料結構摘要而非完整內容
      final dataSummary = _getDataSummary(response.data);
      print('🟢 $status $path → $dataSummary');
    }
    handler.next(response);
  }

  String _getDataSummary(dynamic data) {
    if (data == null) return 'null';
    if (data is Map) {
      final keys = data.keys.toList();
      if (data.containsKey('data')) {
        final innerData = data['data'];
        if (innerData is Map) {
          // {data: {tasks: [45 items], message: "..."}, meta: {...}}
          final innerKeys = innerData.keys.toList();
          final summaries = innerKeys.map((key) {
            final value = innerData[key];
            if (value is List) {
              return '$key: ${value.length} items';
            }
            return key;
          }).join(', ');
          return '{data: {$summaries}}';
        }
      }
      return '{${keys.join(', ')}}';
    }
    if (data is List) return '[${data.length} items]';
    return data.toString().substring(0, 50);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final path = err.requestOptions.uri.path;
    final status = err.response?.statusCode ?? 'null';
    final message = err.message ?? 'Unknown error';

    print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    print('🔴 ERROR ║ ${err.requestOptions.method} $path');
    print('Status: $status');
    print('Message: ${message.split('\n').first}'); // 只顯示第一行
    if (verbose && err.response?.data != null) {
      print('Response: ${err.response?.data}');
    }
    print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    handler.next(err);
  }
}
