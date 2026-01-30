import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:get_it/get_it.dart';
import 'package:hive_flutter/hive_flutter.dart';

import '../config/app_config.dart';
import '../network/auth_interceptor.dart';
import '../network/logging_interceptor.dart';
import '../../data/datasources/remote/api_client.dart';
import '../../domain/repositories/auth_repository.dart';
import '../../data/repositories/auth_repository_impl.dart';
import '../../domain/repositories/area_repository.dart';
import '../../data/repositories/area_repository_impl.dart';
import '../../domain/repositories/task_repository.dart';
import '../../data/repositories/task_repository_impl.dart';
import '../../domain/repositories/brain_dump_repository.dart';
import '../../data/repositories/brain_dump_repository_impl.dart';
import '../../domain/repositories/product_repository.dart';
import '../../data/repositories/product_repository_impl.dart';

/// GetIt 依賴注入容器
final getIt = GetIt.instance;

/// 初始化所有依賴
Future<void> setupDependencyInjection() async {
  // ==================== Core ====================

  // Firebase Auth
  getIt.registerSingleton<FirebaseAuth>(FirebaseAuth.instance);

  // Dio HTTP Client
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
  dio.interceptors.add(AuthInterceptor(getIt<FirebaseAuth>()));

  if (AppConfig.isDebugMode) {
    dio.interceptors.add(LoggingInterceptor());
  }

  getIt.registerSingleton<Dio>(dio);

  // ==================== Local Storage (Hive) ====================

  await Hive.initFlutter();

  // 打開 Hive Boxes
  final tasksBox = await Hive.openBox<Map>('tasks');
  final areasBox = await Hive.openBox<Map>('areas');
  final productsBox = await Hive.openBox<Map>('products');
  final syncQueueBox = await Hive.openBox<Map>('sync_queue');
  final userBox = await Hive.openBox<Map>('user');

  getIt.registerSingleton<Box<Map>>(tasksBox, instanceName: 'tasks');
  getIt.registerSingleton<Box<Map>>(areasBox, instanceName: 'areas');
  getIt.registerSingleton<Box<Map>>(productsBox, instanceName: 'products');
  getIt.registerSingleton<Box<Map>>(syncQueueBox, instanceName: 'sync_queue');
  getIt.registerSingleton<Box<Map>>(userBox, instanceName: 'user');

  // ==================== API Client ====================

  getIt.registerSingleton<ApiClient>(ApiClient(getIt<Dio>()));

  // ==================== Data Sources ====================
  // TODO: 註冊 Remote 和 Local DataSources

  // ==================== Repositories ====================
  // ==================== Repositories ====================
  getIt.registerLazySingleton<AuthRepository>(
    () => AuthRepositoryImpl(getIt<FirebaseAuth>(), getIt<ApiClient>()),
  );
  getIt.registerLazySingleton<AreaRepository>(
    () => AreaRepositoryImpl(getIt<ApiClient>()),
  );
  getIt.registerLazySingleton<TaskRepository>(
    () => TaskRepositoryImpl(getIt<ApiClient>()),
  );
  getIt.registerLazySingleton<BrainDumpRepository>(
    () => BrainDumpRepositoryImpl(getIt<ApiClient>()),
  );
  getIt.registerLazySingleton<ProductRepository>(
    () => ProductRepositoryImpl(getIt<ApiClient>()),
  );

  // ==================== Use Cases ====================
  // TODO: 註冊 Use Cases
}

/// 清除所有依賴（用於測試）
Future<void> tearDownDependencies() async {
  await getIt.reset();
  await Hive.close();
}
