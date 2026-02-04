import 'package:dio/dio.dart';
import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_dual_cache/flutter_dual_cache.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

import '../config/app_config.dart';
import '../services/analytics_service.dart';
import '../../domain/entities/task.dart';
import '../../domain/entities/area.dart';
import '../../domain/entities/product.dart';
import '../network/auth_interceptor.dart';
import '../network/logging_interceptor.dart';
import '../../data/datasources/remote/api_client.dart';
import '../../data/repositories/auth_repository_impl.dart';
import '../../data/repositories/brain_dump_repository_impl.dart';
import '../../data/repositories/unified/unified_repositories.dart';
import '../../data/repositories/cached/cached_repositories.dart';
import '../../data/repositories/user_repository_impl.dart';
import '../../data/datasources/local/task_local_datasource.dart';
import '../../data/datasources/local/area_local_datasource.dart';
import '../../data/datasources/local/product_local_datasource.dart';
import '../../domain/repositories/area_repository.dart';
import '../../domain/repositories/auth_repository.dart';
import '../../domain/repositories/brain_dump_repository.dart';
import '../../domain/repositories/product_repository.dart';
import '../../domain/repositories/task_repository.dart';
import '../../domain/repositories/user_repository.dart';
import '../../domain/repositories/milestone_repository.dart';
import '../../data/repositories/milestone_repository_impl.dart';
import '../../application/use_cases/add_product_reference_use_case.dart';
import '../../application/use_cases/add_sub_item_use_case.dart';
import '../../application/use_cases/apply_reorganization_use_case.dart';
import '../../application/use_cases/create_task_use_case.dart';
import '../../application/use_cases/delete_product_reference_use_case.dart';
import '../../application/use_cases/delete_sub_item_use_case.dart';
import '../../application/use_cases/delete_task_use_case.dart';
import '../../application/use_cases/promote_sub_item_use_case.dart';
import '../../application/use_cases/get_active_tasks_use_case.dart';
import '../../application/use_cases/get_areas_use_case.dart';
import '../../application/use_cases/get_completed_today_tasks_use_case.dart';
import '../../application/use_cases/get_product_references_use_case.dart';
import '../../application/use_cases/get_products_use_case.dart';
import '../../application/use_cases/get_tasks_use_case.dart';
import '../../application/use_cases/reorder_sub_items_use_case.dart';
import '../../application/use_cases/reorganize_product_topics_use_case.dart';
import '../../application/use_cases/submit_brain_dump_use_case.dart';
import '../../application/use_cases/update_sub_item_use_case.dart';
import '../../application/use_cases/update_task_details_use_case.dart';
import '../../application/use_cases/update_task_use_case.dart';
import '../../application/use_cases/schedule_task_reminder_use_case.dart';
import '../../application/use_cases/cancel_task_reminder_use_case.dart';
import '../../application/use_cases/reschedule_all_reminders_use_case.dart';
import '../../core/services/notification_service.dart';
import '../../core/services/local_notification_service.dart';
import '../../domain/repositories/notification_repository.dart';
import '../../data/repositories/notification_repository_impl.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

// ==================== Core Providers ====================

/// Firebase Auth Provider
final firebaseAuthProvider = Provider<FirebaseAuth>((ref) {
  return FirebaseAuth.instance;
});

/// Firebase Analytics Provider
final firebaseAnalyticsProvider = Provider<FirebaseAnalytics>((ref) {
  return FirebaseAnalytics.instance;
});

/// Analytics Service Provider
final analyticsServiceProvider = Provider<AnalyticsService>((ref) {
  final analytics = ref.watch(firebaseAnalyticsProvider);
  return AnalyticsService(analytics: analytics);
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

/// Notification Reminders Box Provider
final remindersBoxProvider = Provider<Box<Map>>((ref) {
  throw UnimplementedError('remindersBoxProvider must be overridden');
});

// ==================== Notification Service Providers ====================

/// Flutter Local Notifications Plugin Provider
final flutterLocalNotificationsPluginProvider = Provider<FlutterLocalNotificationsPlugin>((ref) {
  return FlutterLocalNotificationsPlugin();
});

/// Notification Service Provider
final notificationServiceProvider = Provider<NotificationService>((ref) {
  final plugin = ref.watch(flutterLocalNotificationsPluginProvider);
  return LocalNotificationService(plugin);
});

/// Notification Repository Provider
final notificationRepositoryProvider = Provider<NotificationRepository>((ref) {
  final remindersBox = ref.watch(remindersBoxProvider);
  return NotificationRepositoryImpl(remindersBox);
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

/// Area Repository Provider (統一版本 - 內建快取)
final areaRepositoryProvider = Provider<AreaRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  ref.keepAlive(); // 保持快取存活
  return AreaUnifiedRepository(apiClient);
});

/// Task Repository Provider (統一版本 - 內建快取)
final taskRepositoryProvider = Provider<TaskRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  ref.keepAlive(); // 保持快取存活
  return TaskUnifiedRepository(apiClient);
});

/// Task Unified Repository Provider (暴露 CachedRepository 方法)
///
/// 用於需要訪問 refresh() / silentRefresh() 等快取方法的場景
final taskUnifiedRepositoryProvider = Provider<TaskUnifiedRepository>((ref) {
  return ref.watch(taskRepositoryProvider) as TaskUnifiedRepository;
});

/// Brain Dump Repository Provider
final brainDumpRepositoryProvider = Provider<BrainDumpRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return BrainDumpRepositoryImpl(apiClient);
});

/// Product Repository Provider (統一版本 - 內建快取)
final productRepositoryProvider = Provider<ProductRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  ref.keepAlive(); // 保持快取存活
  return ProductUnifiedRepository(apiClient);
});

/// Reference Cached Repository Provider (按 productId 分組快取)
final referenceCachedRepositoryProvider = Provider.family<ReferenceCachedRepository, String>((ref, productId) {
  final apiClient = ref.watch(apiClientProvider);
  ref.keepAlive(); // 保持快取存活
  return ReferenceCachedRepository(
    apiClient: apiClient,
    productId: productId,
  );
});

/// User Repository Provider
final userRepositoryProvider = Provider<UserRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return UserRepositoryImpl(apiClient);
});

/// Milestone Repository Provider
final milestoneRepositoryProvider = Provider<MilestoneRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return MilestoneRepositoryImpl(apiClient);
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

/// Add Sub Item Use Case Provider
final addSubItemUseCaseProvider = Provider<AddSubItemUseCase>((ref) {
  final repository = ref.watch(taskRepositoryProvider);
  return AddSubItemUseCase(repository);
});

/// Delete Sub Item Use Case Provider
final deleteSubItemUseCaseProvider = Provider<DeleteSubItemUseCase>((ref) {
  final repository = ref.watch(taskRepositoryProvider);
  return DeleteSubItemUseCase(repository);
});

/// Promote Sub Item Use Case Provider
final promoteSubItemUseCaseProvider = Provider<PromoteSubItemUseCase>((ref) {
  final repository = ref.watch(taskRepositoryProvider);
  return PromoteSubItemUseCase(repository);
});

/// Reorder Sub Items Use Case Provider
final reorderSubItemsUseCaseProvider = Provider<ReorderSubItemsUseCase>((ref) {
  final repository = ref.watch(taskRepositoryProvider);
  return ReorderSubItemsUseCase(repository);
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

/// Get Product References Use Case Provider
final getProductReferencesUseCaseProvider =
    Provider<GetProductReferencesUseCase>((ref) {
  final repository = ref.watch(productRepositoryProvider);
  return GetProductReferencesUseCase(repository);
});

/// Reorganize Product Topics Use Case Provider
final reorganizeProductTopicsUseCaseProvider =
    Provider<ReorganizeProductTopicsUseCase>((ref) {
  final repository = ref.watch(productRepositoryProvider);
  return ReorganizeProductTopicsUseCase(productRepository: repository);
});

/// Apply Reorganization Use Case Provider
final applyReorganizationUseCaseProvider =
    Provider<ApplyReorganizationUseCase>((ref) {
  final repository = ref.watch(productRepositoryProvider);
  return ApplyReorganizationUseCase(productRepository: repository);
});

/// Submit Brain Dump Use Case Provider
final submitBrainDumpUseCaseProvider =
    Provider<SubmitBrainDumpUseCase>((ref) {
  final repository = ref.watch(brainDumpRepositoryProvider);
  return SubmitBrainDumpUseCase(repository);
});

/// Add Product Reference Use Case Provider
final addProductReferenceUseCaseProvider =
    Provider<AddProductReferenceUseCase>((ref) {
  final repository = ref.watch(productRepositoryProvider);
  return AddProductReferenceUseCase(repository);
});

/// Delete Product Reference Use Case Provider
final deleteProductReferenceUseCaseProvider =
    Provider<DeleteProductReferenceUseCase>((ref) {
  final repository = ref.watch(productRepositoryProvider);
  return DeleteProductReferenceUseCase(repository);
});

/// Schedule Task Reminder Use Case Provider
final scheduleTaskReminderUseCaseProvider = Provider<ScheduleTaskReminderUseCase>((ref) {
  final notificationService = ref.watch(notificationServiceProvider);
  final notificationRepository = ref.watch(notificationRepositoryProvider);
  final taskRepository = ref.watch(taskRepositoryProvider);
  return ScheduleTaskReminderUseCase(
    notificationService: notificationService,
    notificationRepository: notificationRepository,
    taskRepository: taskRepository,
  );
});

/// Cancel Task Reminder Use Case Provider
final cancelTaskReminderUseCaseProvider = Provider<CancelTaskReminderUseCase>((ref) {
  final notificationService = ref.watch(notificationServiceProvider);
  final notificationRepository = ref.watch(notificationRepositoryProvider);
  final taskRepository = ref.watch(taskRepositoryProvider);
  return CancelTaskReminderUseCase(
    notificationService: notificationService,
    notificationRepository: notificationRepository,
    taskRepository: taskRepository,
  );
});

/// Reschedule All Reminders Use Case Provider
final rescheduleAllRemindersUseCaseProvider = Provider<RescheduleAllRemindersUseCase>((ref) {
  final notificationService = ref.watch(notificationServiceProvider);
  final notificationRepository = ref.watch(notificationRepositoryProvider);
  final taskRepository = ref.watch(taskRepositoryProvider);
  return RescheduleAllRemindersUseCase(
    notificationService: notificationService,
    notificationRepository: notificationRepository,
    taskRepository: taskRepository,
  );
});

// ==================== Cached Stream Providers ====================
// 注意: 統一 Repository 已經內建快取功能,直接使用即可

/// Stream of cached tasks state (for UI binding)
///
/// 直接從 TaskUnifiedRepository 獲取快取 Stream
final cachedTasksStreamProvider =
    StreamProvider<CacheState<List<Task>>>((ref) {
  final repo = ref.watch(taskRepositoryProvider) as TaskUnifiedRepository;
  return repo.stream;
});

/// Stream of cached areas state (for UI binding)
///
/// 直接從 AreaUnifiedRepository 獲取快取 Stream
final cachedAreasStreamProvider =
    StreamProvider<CacheState<List<Area>>>((ref) {
  final repo = ref.watch(areaRepositoryProvider) as AreaUnifiedRepository;
  return repo.stream;
});

/// Stream of cached products state (for UI binding)
///
/// 直接從 ProductUnifiedRepository 獲取快取 Stream
final cachedProductsStreamProvider =
    StreamProvider<CacheState<List<Product>>>((ref) {
  final repo = ref.watch(productRepositoryProvider) as ProductUnifiedRepository;
  return repo.stream;
});

// ==================== Initialization ====================

/// 初始化 Hive、通知服務、時區,並返回 ProviderScope 的 overrides
Future<List<Override>> initializeDependencies() async {
  await Hive.initFlutter();

  // 打開 Hive Boxes
  final tasksBox = await Hive.openBox<Map>('tasks');
  final areasBox = await Hive.openBox<Map>('areas');
  final productsBox = await Hive.openBox<Map>('products');
  final syncQueueBox = await Hive.openBox<Map>('sync_queue');
  final userBox = await Hive.openBox<Map>('user');
  final remindersBox = await Hive.openBox<Map>('reminders');

  // 初始化通知服務（包含時區設置）
  final notificationPlugin = FlutterLocalNotificationsPlugin();
  final notificationService = LocalNotificationService(notificationPlugin);
  await notificationService.initialize(); // 這裡會初始化時區
  await notificationService.requestPermission();

  return [
    tasksBoxProvider.overrideWithValue(tasksBox),
    areasBoxProvider.overrideWithValue(areasBox),
    productsBoxProvider.overrideWithValue(productsBox),
    syncQueueBoxProvider.overrideWithValue(syncQueueBox),
    userBoxProvider.overrideWithValue(userBox),
    remindersBoxProvider.overrideWithValue(remindersBox),
  ];
}
