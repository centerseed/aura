import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

import '../config/app_config.dart';
import '../network/auth_interceptor.dart';
import '../network/logging_interceptor.dart';
import '../../data/datasources/remote/api_client.dart';
import '../../data/repositories/area_repository_impl.dart';
import '../../data/repositories/auth_repository_impl.dart';
import '../../data/repositories/brain_dump_repository_impl.dart';
import '../../data/repositories/product_repository_impl.dart';
import '../../data/repositories/task_repository_impl.dart';
import '../../data/datasources/local/task_local_datasource.dart';
import '../../data/datasources/local/area_local_datasource.dart';
import '../../data/datasources/local/product_local_datasource.dart';
import '../../domain/repositories/area_repository.dart';
import '../../domain/repositories/auth_repository.dart';
import '../../domain/repositories/brain_dump_repository.dart';
import '../../domain/repositories/product_repository.dart';
import '../../domain/repositories/task_repository.dart';
import '../../application/use_cases/create_task_use_case.dart';
import '../../application/use_cases/delete_task_use_case.dart';
import '../../application/use_cases/get_active_tasks_use_case.dart';
import '../../application/use_cases/get_areas_use_case.dart';
import '../../application/use_cases/get_completed_today_tasks_use_case.dart';
import '../../application/use_cases/get_products_use_case.dart';
import '../../application/use_cases/get_tasks_use_case.dart';
import '../../application/use_cases/submit_brain_dump_use_case.dart';
import '../../application/use_cases/update_sub_item_use_case.dart';
import '../../application/use_cases/update_task_details_use_case.dart';
import '../../application/use_cases/update_task_use_case.dart';

// ==================== Core Providers ====================

/// Firebase Auth Provider
final firebaseAuthProvider = Provider<FirebaseAuth>((ref) {
  return FirebaseAuth.instance;
});

/// Dio HTTP Client Provider
final dioProvider = Provider<Dio>((ref) {
  final firebaseAuth = ref.watch(firebaseAuthProvider);

  final dio = Dio(
    BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      connectTimeout: Duration(seconds: AppConfig.apiTimeout),
      receiveTimeout: Duration(seconds: AppConfig.apiTimeout),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ),
  );

  // 添加攔截器
  dio.interceptors.add(AuthInterceptor(firebaseAuth));

  if (AppConfig.isDebugMode) {
    dio.interceptors.add(LoggingInterceptor());
  }

  return dio;
});

// ==================== Hive Box Providers ====================

/// Tasks Box Provider
final tasksBoxProvider = Provider<Box<Map>>((ref) {
  throw UnimplementedError('tasksBoxProvider must be overridden');
});

/// Areas Box Provider
final areasBoxProvider = Provider<Box<Map>>((ref) {
  throw UnimplementedError('areasBoxProvider must be overridden');
});

/// Products Box Provider
final productsBoxProvider = Provider<Box<Map>>((ref) {
  throw UnimplementedError('productsBoxProvider must be overridden');
});

/// Sync Queue Box Provider
final syncQueueBoxProvider = Provider<Box<Map>>((ref) {
  throw UnimplementedError('syncQueueBoxProvider must be overridden');
});

/// User Box Provider
final userBoxProvider = Provider<Box<Map>>((ref) {
  throw UnimplementedError('userBoxProvider must be overridden');
});

// ==================== Local DataSource Providers ====================

/// Task Local DataSource Provider
final taskLocalDataSourceProvider = Provider<TaskLocalDataSource>((ref) {
  final tasksBox = ref.watch(tasksBoxProvider);
  return TaskLocalDataSourceImpl(tasksBox);
});

/// Area Local DataSource Provider
final areaLocalDataSourceProvider = Provider<AreaLocalDataSource>((ref) {
  final areasBox = ref.watch(areasBoxProvider);
  return AreaLocalDataSourceImpl(areasBox);
});

/// Product Local DataSource Provider
final productLocalDataSourceProvider = Provider<ProductLocalDataSource>((ref) {
  final productsBox = ref.watch(productsBoxProvider);
  return ProductLocalDataSourceImpl(productsBox);
});

// ==================== API Client Provider ====================

/// API Client Provider
final apiClientProvider = Provider<ApiClient>((ref) {
  final dio = ref.watch(dioProvider);
  return ApiClient(dio);
});

// ==================== Repository Providers ====================

/// Auth Repository Provider
final authRepositoryProvider = Provider<AuthRepository>((ref) {
  final firebaseAuth = ref.watch(firebaseAuthProvider);
  final apiClient = ref.watch(apiClientProvider);
  return AuthRepositoryImpl(firebaseAuth, apiClient);
});

/// Area Repository Provider
final areaRepositoryProvider = Provider<AreaRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return AreaRepositoryImpl(apiClient);
});

/// Task Repository Provider
final taskRepositoryProvider = Provider<TaskRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return TaskRepositoryImpl(apiClient);
});

/// Brain Dump Repository Provider
final brainDumpRepositoryProvider = Provider<BrainDumpRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return BrainDumpRepositoryImpl(apiClient);
});

/// Product Repository Provider
final productRepositoryProvider = Provider<ProductRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return ProductRepositoryImpl(apiClient);
});

// ==================== Use Case Providers ====================

/// Get Tasks Use Case Provider
final getTasksUseCaseProvider = Provider<GetTasksUseCase>((ref) {
  final repository = ref.watch(taskRepositoryProvider);
  return GetTasksUseCase(repository);
});

/// Get Active Tasks Use Case Provider
final getActiveTasksUseCaseProvider = Provider<GetActiveTasksUseCase>((ref) {
  final repository = ref.watch(taskRepositoryProvider);
  return GetActiveTasksUseCase(repository);
});

/// Get Completed Today Tasks Use Case Provider
final getCompletedTodayTasksUseCaseProvider =
    Provider<GetCompletedTodayTasksUseCase>((ref) {
  final repository = ref.watch(taskRepositoryProvider);
  return GetCompletedTodayTasksUseCase(repository);
});

/// Create Task Use Case Provider
final createTaskUseCaseProvider = Provider<CreateTaskUseCase>((ref) {
  final repository = ref.watch(taskRepositoryProvider);
  return CreateTaskUseCase(repository);
});

/// Update Task Use Case Provider
final updateTaskUseCaseProvider = Provider<UpdateTaskUseCase>((ref) {
  final repository = ref.watch(taskRepositoryProvider);
  return UpdateTaskUseCase(repository);
});

/// Update Task Details Use Case Provider
final updateTaskDetailsUseCaseProvider =
    Provider<UpdateTaskDetailsUseCase>((ref) {
  final repository = ref.watch(taskRepositoryProvider);
  return UpdateTaskDetailsUseCase(repository);
});

/// Delete Task Use Case Provider
final deleteTaskUseCaseProvider = Provider<DeleteTaskUseCase>((ref) {
  final repository = ref.watch(taskRepositoryProvider);
  return DeleteTaskUseCase(repository);
});

/// Update Sub Item Use Case Provider
final updateSubItemUseCaseProvider = Provider<UpdateSubItemUseCase>((ref) {
  final repository = ref.watch(taskRepositoryProvider);
  return UpdateSubItemUseCase(repository);
});

/// Get Areas Use Case Provider
final getAreasUseCaseProvider = Provider<GetAreasUseCase>((ref) {
  final repository = ref.watch(areaRepositoryProvider);
  return GetAreasUseCase(repository);
});

/// Get Products Use Case Provider
final getProductsUseCaseProvider = Provider<GetProductsUseCase>((ref) {
  final repository = ref.watch(productRepositoryProvider);
  return GetProductsUseCase(repository);
});

/// Submit Brain Dump Use Case Provider
final submitBrainDumpUseCaseProvider =
    Provider<SubmitBrainDumpUseCase>((ref) {
  final repository = ref.watch(brainDumpRepositoryProvider);
  return SubmitBrainDumpUseCase(repository);
});

// ==================== Initialization ====================

/// 初始化 Hive 並返回 ProviderScope 的 overrides
Future<List<Override>> initializeDependencies() async {
  await Hive.initFlutter();

  // 打開 Hive Boxes
  final tasksBox = await Hive.openBox<Map>('tasks');
  final areasBox = await Hive.openBox<Map>('areas');
  final productsBox = await Hive.openBox<Map>('products');
  final syncQueueBox = await Hive.openBox<Map>('sync_queue');
  final userBox = await Hive.openBox<Map>('user');

  return [
    tasksBoxProvider.overrideWithValue(tasksBox),
    areasBoxProvider.overrideWithValue(areasBox),
    productsBoxProvider.overrideWithValue(productsBox),
    syncQueueBoxProvider.overrideWithValue(syncQueueBox),
    userBoxProvider.overrideWithValue(userBox),
  ];
}
