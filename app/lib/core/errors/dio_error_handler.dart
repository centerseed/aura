import 'package:dio/dio.dart';

import 'failures.dart';

/// Converts Dio exceptions to domain Failure types.
///
/// This handler provides consistent error mapping across all repositories:
/// - Timeout errors -> NetworkFailure
/// - Connection errors -> NetworkFailure
/// - HTTP errors -> ServerFailure, AuthFailure, or ValidationFailure based on response
/// - Unknown errors -> UnknownFailure
///
/// Example usage:
/// ```dart
/// try {
///   final result = await apiClient.someMethod();
///   return Right(result);
/// } catch (e) {
///   return Left(handleDioError(e));
/// }
/// ```
Failure handleDioError(Object error) {
  if (error is DioException) {
    return _handleDioException(error);
  }
  return UnknownFailure(error.toString());
}

Failure _handleDioException(DioException error) {
  // Handle timeout errors
  if (_isTimeoutError(error.type)) {
    return const NetworkFailure('Connection timeout');
  }

  // Handle connection errors
  if (error.type == DioExceptionType.connectionError) {
    return const NetworkFailure('No internet connection');
  }

  // Handle HTTP response errors
  if (error.response != null) {
    return _handleResponseError(error.response!);
  }

  // Fallback for other Dio errors
  return ServerFailure(error.message ?? 'Network request failed');
}

bool _isTimeoutError(DioExceptionType type) {
  return type == DioExceptionType.connectionTimeout ||
      type == DioExceptionType.receiveTimeout ||
      type == DioExceptionType.sendTimeout;
}

Failure _handleResponseError(Response response) {
  // Try to parse API standard error format first
  final apiFailure = _parseApiErrorResponse(response.data);
  if (apiFailure != null) {
    return apiFailure;
  }

  // Fall back to HTTP status code mapping
  return _mapStatusCodeToFailure(response.statusCode);
}

/// Parses the API standard error response format:
/// ```json
/// {
///   "error": {
///     "code": "VALIDATION_ERROR",
///     "message": "Invalid input"
///   }
/// }
/// ```
Failure? _parseApiErrorResponse(dynamic responseData) {
  if (responseData is! Map<String, dynamic>) {
    return null;
  }

  final errorData = responseData['error'];
  if (errorData is! Map<String, dynamic>) {
    return null;
  }

  final message = errorData['message'] as String? ?? 'Unknown error';
  final code = errorData['code'] as String?;

  return _mapErrorCodeToFailure(code, message);
}

Failure _mapErrorCodeToFailure(String? code, String message) {
  switch (code) {
    case 'VALIDATION_ERROR':
      return ValidationFailure(message);
    case 'UNAUTHORIZED':
      return AuthFailure(message);
    case 'NOT_FOUND':
      return ServerFailure('Resource not found: $message');
    default:
      return ServerFailure(message);
  }
}

Failure _mapStatusCodeToFailure(int? statusCode) {
  if (statusCode == null) {
    return const ServerFailure('Unknown server error');
  }

  if (statusCode == 401) {
    return const AuthFailure('Unauthorized');
  }
  if (statusCode == 404) {
    return const ServerFailure('Resource not found');
  }
  if (statusCode >= 500) {
    return ServerFailure('Server error: $statusCode');
  }

  return ServerFailure('HTTP error: $statusCode');
}
