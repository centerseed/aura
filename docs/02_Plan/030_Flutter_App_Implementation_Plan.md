# Zentropy Flutter App 實現計劃 (Implementation Plan)

**版本 1.0 - 移動端應用開發藍圖**

---

## 一、專案概述 (Project Overview)

### 1.1 專案目標
建立 Zentropy 的移動端 Flutter 應用，提供：
- **快速捕捉**：隨時隨地記錄想法，AI 自動分類
- **今日焦點**：清晰顯示「現在該做什麼」
- **無縫同步**：與 Web POC 共享數據，多設備無縫體驗

### 1.2 技術基礎
✅ **已完成**：
- 後端 FastAPI + Prisma ORM
- PostgreSQL 資料庫
- Firebase Authentication (Supabase Auth)
- 完整的 RESTful API（Brain Dump、Tasks CRUD、Library 等）
- Web POC 驗證核心 AI 功能

🎯 **待實現**：
- Flutter 前端應用
- 離線優先數據同步
- 移動端專屬 UX（手勢、語音輸入）

---

## 二、技術架構設計 (Technical Architecture)

### 2.1 技術棧選擇

#### 2.1.1 核心框架
```yaml
Flutter SDK: ^3.24.0
Dart: ^3.5.0

狀態管理:
  - riverpod: ^2.6.1
  - flutter_riverpod: ^2.6.1

路由導航:
  - go_router: ^14.0.0

本地存儲:
  - hive: ^2.2.3
  - hive_flutter: ^1.1.0
  
網路請求:
  - dio: ^5.7.0
  - retrofit: ^4.4.0
  - retrofit_generator: ^9.1.4
  
認證:
  - firebase_auth: ^5.3.3
  - firebase_core: ^3.8.1
  
UI 組件:
  - flutter_svg: ^2.0.10
  - cached_network_image: ^3.4.1
  - shimmer: ^3.0.0
  
工具:
  - freezed: ^2.5.7
  - freezed_annotation: ^2.4.4
  - json_annotation: ^4.9.0
  - get_it: ^8.0.2
```

#### 2.1.2 開發工具
```yaml
代碼生成:
  - build_runner: ^2.4.13
  - json_serializable: ^6.8.0
  
測試:
  - flutter_test: sdk
  - mockito: ^5.4.4
  - integration_test: sdk
  
代碼品質:
  - flutter_lints: ^5.0.0
  - very_good_analysis: ^6.0.0
```

---

### 2.2 專案結構 (Project Structure)

```
naruvia_app/
├── lib/
│   ├── main.dart                      # 應用入口
│   ├── app.dart                       # App Widget
│   │
│   ├── core/                          # 核心層
│   │   ├── config/
│   │   │   ├── app_config.dart        # 配置（API URL、環境變數）
│   │   │   └── theme/
│   │   │       ├── app_theme.dart     # 主題定義
│   │   │       ├── app_colors.dart    # 色彩系統
│   │   │       └── app_text_styles.dart # 字體系統
│   │   ├── constants/
│   │   │   ├── api_endpoints.dart     # API 端點常量
│   │   │   └── app_constants.dart     # 應用常量
│   │   ├── di/
│   │   │   └── injection.dart         # 依賴注入配置 (GetIt)
│   │   ├── errors/
│   │   │   ├── failures.dart          # 錯誤類型定義
│   │   │   └── exceptions.dart        # 例外處理
│   │   └── utils/
│   │       ├── date_formatter.dart    # 日期格式化
│   │       └── validators.dart        # 驗證器
│   │
│   ├── domain/                        # 領域層 (業務邏輯)
│   │   ├── entities/                  # 實體類別
│   │   │   ├── user.dart
│   │   │   ├── area.dart
│   │   │   ├── product.dart
│   │   │   ├── topic.dart
│   │   │   ├── task.dart
│   │   │   └── milestone.dart
│   │   ├── repositories/              # Repository 介面
│   │   │   ├── auth_repository.dart
│   │   │   ├── library_repository.dart
│   │   │   ├── task_repository.dart
│   │   │   └── brain_dump_repository.dart
│   │   └── usecases/                  # 用例（業務邏輯）
│   │       ├── auth/
│   │       │   ├── sign_in_usecase.dart
│   │       │   └── sign_out_usecase.dart
│   │       ├── tasks/
│   │       │   ├── create_task_usecase.dart
│   │       │   ├── update_task_usecase.dart
│   │       │   ├── complete_task_usecase.dart
│   │       │   └── get_today_tasks_usecase.dart
│   │       └── brain_dump/
│   │           └── brain_dump_usecase.dart
│   │
│   ├── data/                          # 資料層
│   │   ├── models/                    # API 響應模型
│   │   │   ├── user_model.dart
│   │   │   ├── area_model.dart
│   │   │   ├── product_model.dart
│   │   │   ├── task_model.dart
│   │   │   └── brain_dump_response.dart
│   │   ├── datasources/
│   │   │   ├── remote/                # 遠端數據源 (API)
│   │   │   │   ├── auth_remote_datasource.dart
│   │   │   │   ├── library_remote_datasource.dart
│   │   │   │   ├── task_remote_datasource.dart
│   │   │   │   └── api_client.dart    # Retrofit API Client
│   │   │   └── local/                 # 本地數據源 (Hive)
│   │   │       ├── auth_local_datasource.dart
│   │   │       ├── library_local_datasource.dart
│   │   │       └── task_local_datasource.dart
│   │   └── repositories/              # Repository 實現
│   │       ├── auth_repository_impl.dart
│   │       ├── library_repository_impl.dart
│   │       ├── task_repository_impl.dart
│   │       └── brain_dump_repository_impl.dart
│   │
│   └── presentation/                  # 表現層 (UI)
│       ├── routes/
│       │   └── app_router.dart        # GoRouter 配置
│       ├── providers/                 # Riverpod Providers
│       │   ├── auth_provider.dart
│       │   ├── library_provider.dart
│       │   ├── task_provider.dart
│       │   └── theme_provider.dart
│       ├── screens/                   # 頁面
│       │   ├── splash/
│       │   │   └── splash_screen.dart
│       │   ├── onboarding/
│       │   │   ├── onboarding_screen.dart
│       │   │   └── widgets/
│       │   │       └── onboarding_page.dart
│       │   ├── auth/
│       │   │   ├── signin_screen.dart
│       │   │   └── signup_screen.dart
│       │   ├── dashboard/
│       │   │   ├── dashboard_screen.dart
│       │   │   └── widgets/
│       │   │       ├── today_view.dart
│       │   │       ├── structure_view.dart
│       │   │       ├── week_view.dart
│       │   │       └── quick_stats_card.dart
│       │   ├── quick_capture/
│       │   │   ├── quick_capture_screen.dart
│       │   │   └── widgets/
│       │   │       ├── text_input_tab.dart
│       │   │       ├── voice_input_tab.dart
│       │   │       └── ai_suggestion_card.dart
│       │   ├── inbox/
│       │   │   ├── inbox_screen.dart
│       │   │   └── widgets/
│       │   │       └── inbox_item_card.dart
│       │   ├── library/
│       │   │   ├── library_screen.dart
│       │   │   ├── product_detail_screen.dart
│       │   │   └── widgets/
│       │   │       ├── area_section.dart
│       │   │       └── product_card.dart
│       │   └── profile/
│       │       ├── profile_screen.dart
│       │       └── settings_screen.dart
│       └── widgets/                   # 共用組件
│           ├── bottom_nav_bar.dart
│           ├── task_card/
│           │   ├── task_card_large.dart
│           │   └── task_card_small.dart
│           ├── buttons/
│           │   ├── primary_button.dart
│           │   └── secondary_button.dart
│           ├── inputs/
│           │   └── multi_line_text_field.dart
│           └── loading/
│               ├── shimmer_loading.dart
│               └── loading_indicator.dart
│
├── test/                              # 單元測試
├── integration_test/                  # 整合測試
├── assets/                            # 資源文件
│   ├── images/
│   ├── icons/
│   └── fonts/
└── pubspec.yaml                       # 依賴配置
```

---

### 2.3 架構模式：Clean Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Presentation Layer                    │
│  (Screens, Widgets, Providers - 依賴 Domain)            │
└────────────────────┬────────────────────────────────────┘
                     │ 依賴
┌────────────────────▼────────────────────────────────────┐
│                    Domain Layer                         │
│  (Entities, UseCases, Repository Interfaces)            │
│  - 純 Dart，無 Flutter 依賴                              │
│  - 業務邏輯核心                                          │
└────────────────────┬────────────────────────────────────┘
                     │ 實現
┌────────────────────▼────────────────────────────────────┐
│                     Data Layer                          │
│  (Models, Repositories Implementation, DataSources)     │
│  - API 調用 (Retrofit + Dio)                            │
│  - 本地存儲 (Hive)                                       │
│  - 數據同步邏輯                                          │
└─────────────────────────────────────────────────────────┘
```

**依賴規則**：
- Presentation 依賴 Domain
- Data 實現 Domain 定義的介面
- Domain 不依賴任何外層（純業務邏輯）

---

## 三、API 整合方案 (API Integration)

### 3.1 API Client 設計

#### 3.1.1 Retrofit API Client
```dart
// lib/data/datasources/remote/api_client.dart
import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';
import '../../models/brain_dump_response.dart';
import '../../models/task_model.dart';
import '../../models/library_response.dart';

part 'api_client.g.dart';

@RestApi(baseUrl: "https://zentropy-web-isakqhri2a-de.a.run.app")
abstract class ApiClient {
  factory ApiClient(Dio dio, {String baseUrl}) = _ApiClient;
  
  // ==================== Auth ====================
  @POST("/api/auth/signin")
  Future<UserResponse> signIn(@Body() Map<String, dynamic> body);
  
  @GET("/api/me")
  Future<UserResponse> getCurrentUser();
  
  // ==================== Brain Dump ====================
  @POST("/api/brain-dump")
  Future<BrainDumpResponse> brainDump(@Body() BrainDumpRequest request);
  
  // ==================== Tasks ====================
  @GET("/api/tasks")
  Future<List<TaskModel>> getTasks({
    @Query("status") String? status,
    @Query("due_date_from") String? dueDateFrom,
    @Query("due_date_to") String? dueDateTo,
  });
  
  @POST("/api/tasks")
  Future<TaskModel> createTask(@Body() CreateTaskRequest request);
  
  @PATCH("/api/tasks/{taskId}")
  Future<TaskModel> updateTask(
    @Path("taskId") String taskId,
    @Body() UpdateTaskRequest request,
  );
  
  @DELETE("/api/tasks/{taskId}")
  Future<void> deleteTask(@Path("taskId") String taskId);
  
  // ==================== Library ====================
  @GET("/api/library")
  Future<LibraryResponse> getLibrary();
  
  // ==================== Products ====================
  @POST("/api/products")
  Future<ProductModel> createProduct(@Body() CreateProductRequest request);
  
  @PATCH("/api/products/{id}")
  Future<ProductModel> updateProduct(
    @Path("id") String id,
    @Body() UpdateProductRequest request,
  );
  
  // ==================== Milestones ====================
  @GET("/api/milestones")
  Future<List<MilestoneModel>> getMilestones();
  
  @POST("/api/milestones")
  Future<MilestoneModel> createMilestone(@Body() CreateMilestoneRequest request);
}
```

#### 3.1.2 Dio 攔截器 (Interceptor)
```dart
// lib/core/network/auth_interceptor.dart
import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';

class AuthInterceptor extends Interceptor {
  final FirebaseAuth _auth;
  
  AuthInterceptor(this._auth);
  
  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    try {
      // 獲取 Firebase ID Token
      final user = _auth.currentUser;
      if (user != null) {
        final token = await user.getIdToken();
        options.headers['Authorization'] = 'Bearer $token';
      }
      handler.next(options);
    } catch (e) {
      handler.reject(
        DioException(
          requestOptions: options,
          error: 'Failed to get auth token: $e',
        ),
      );
    }
  }
  
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    // 401 錯誤處理：自動登出
    if (err.response?.statusCode == 401) {
      _auth.signOut();
    }
    handler.next(err);
  }
}
```

#### 3.1.3 依賴注入配置
```dart
// lib/core/di/injection.dart
import 'package:get_it/get_it.dart';
import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:hive_flutter/hive_flutter.dart';

final getIt = GetIt.instance;

Future<void> setupDependencyInjection() async {
  // ==================== Core ====================
  getIt.registerSingleton<FirebaseAuth>(FirebaseAuth.instance);
  
  // Dio 配置
  final dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 30),
    receiveTimeout: const Duration(seconds: 30),
    headers: {'Content-Type': 'application/json'},
  ));
  
  // 添加攔截器
  dio.interceptors.add(AuthInterceptor(getIt<FirebaseAuth>()));
  dio.interceptors.add(LogInterceptor(responseBody: true));
  
  getIt.registerSingleton<Dio>(dio);
  
  // API Client
  getIt.registerSingleton<ApiClient>(
    ApiClient(getIt<Dio>()),
  );
  
  // ==================== Local Storage ====================
  await Hive.initFlutter();
  
  final tasksBox = await Hive.openBox<Map>('tasks');
  final areasBox = await Hive.openBox<Map>('areas');
  final productsBox = await Hive.openBox<Map>('products');
  
  getIt.registerSingleton<Box<Map>>(tasksBox, instanceName: 'tasks');
  getIt.registerSingleton<Box<Map>>(areasBox, instanceName: 'areas');
  getIt.registerSingleton<Box<Map>>(productsBox, instanceName: 'products');
  
  // ==================== Data Sources ====================
  getIt.registerLazySingleton<TaskRemoteDataSource>(
    () => TaskRemoteDataSourceImpl(getIt<ApiClient>()),
  );
  
  getIt.registerLazySingleton<TaskLocalDataSource>(
    () => TaskLocalDataSourceImpl(getIt<Box<Map>>(instanceName: 'tasks')),
  );
  
  // ==================== Repositories ====================
  getIt.registerLazySingleton<TaskRepository>(
    () => TaskRepositoryImpl(
      remoteDataSource: getIt<TaskRemoteDataSource>(),
      localDataSource: getIt<TaskLocalDataSource>(),
    ),
  );
  
  // ==================== Use Cases ====================
  getIt.registerLazySingleton(() => GetTodayTasksUseCase(getIt()));
  getIt.registerLazySingleton(() => CompleteTaskUseCase(getIt()));
  getIt.registerLazySingleton(() => BrainDumpUseCase(getIt()));
}
```

---

### 3.2 資料模型定義

#### 3.2.1 Task Model
```dart
// lib/data/models/task_model.dart
import 'package:freezed_annotation/freezed_annotation.dart';
import '../../domain/entities/task.dart';

part 'task_model.freezed.dart';
part 'task_model.g.dart';

@freezed
class TaskModel with _$TaskModel {
  const factory TaskModel({
    required String id,
    required String userId,
    required String productId,
    String? topicId,
    required String content,
    required String status,
    DateTime? dueDate,
    double? timeConfidence,
    String? inferredFromMilestone,
    @JsonKey(name: 'ai_analysis') Map<String, dynamic>? aiAnalysis,
    @JsonKey(name: 'sub_items') List<SubItemModel>? subItems,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) = _TaskModel;
  
  factory TaskModel.fromJson(Map<String, dynamic> json) =>
      _$TaskModelFromJson(json);
  
  // 轉換為 Domain Entity
  const TaskModel._();
  Task toEntity() => Task(
    id: id,
    content: content,
    status: TaskStatus.values.byName(status.toLowerCase()),
    dueDate: dueDate,
    timeConfidence: timeConfidence,
    productId: productId,
    topicId: topicId,
    subItems: subItems?.map((e) => e.toEntity()).toList(),
  );
}

@freezed
class SubItemModel with _$SubItemModel {
  const factory SubItemModel({
    required String id,
    required String content,
    required bool completed,
    DateTime? completedAt,
  }) = _SubItemModel;
  
  factory SubItemModel.fromJson(Map<String, dynamic> json) =>
      _$SubItemModelFromJson(json);
  
  const SubItemModel._();
  SubItem toEntity() => SubItem(
    id: id,
    content: content,
    completed: completed,
  );
}
```

#### 3.2.2 Brain Dump Request/Response
```dart
// lib/data/models/brain_dump_response.dart
import 'package:freezed_annotation/freezed_annotation.dart';

part 'brain_dump_response.freezed.dart';
part 'brain_dump_response.g.dart';

@freezed
class BrainDumpRequest with _$BrainDumpRequest {
  const factory BrainDumpRequest({
    required String text,
  }) = _BrainDumpRequest;
  
  factory BrainDumpRequest.fromJson(Map<String, dynamic> json) =>
      _$BrainDumpRequestFromJson(json);
}

@freezed
class BrainDumpResponse with _$BrainDumpResponse {
  const factory BrainDumpResponse({
    required bool success,
    required List<BrainDumpItem> items,
  }) = _BrainDumpResponse;
  
  factory BrainDumpResponse.fromJson(Map<String, dynamic> json) =>
      _$BrainDumpResponseFromJson(json);
}

@freezed
class BrainDumpItem with _$BrainDumpItem {
  const factory BrainDumpItem({
    required String id,
    required String title,
    required String narrative,
    required String drawer,
    required BrainDumpTag tag,
    String? dueDate,
    double? timeConfidence,
    String? timeReasoning,
  }) = _BrainDumpItem;
  
  factory BrainDumpItem.fromJson(Map<String, dynamic> json) =>
      _$BrainDumpItemFromJson(json);
}

@freezed
class BrainDumpTag with _$BrainDumpTag {
  const factory BrainDumpTag({
    required String area,
    required String product,
    String? topic,
  }) = _BrainDumpTag;
  
  factory BrainDumpTag.fromJson(Map<String, dynamic> json) =>
      _$BrainDumpTagFromJson(json);
}
```

---

## 四、認證流程設計 (Authentication Flow)

### 4.1 Firebase Auth 整合

#### 4.1.1 認證 Repository
```dart
// lib/data/repositories/auth_repository_impl.dart
import 'package:firebase_auth/firebase_auth.dart';
import 'package:dartz/dartz.dart';
import '../../domain/repositories/auth_repository.dart';
import '../../core/errors/failures.dart';

class AuthRepositoryImpl implements AuthRepository {
  final FirebaseAuth _firebaseAuth;
  final ApiClient _apiClient;
  
  AuthRepositoryImpl(this._firebaseAuth, this._apiClient);
  
  @override
  Stream<User?> get authStateChanges => _firebaseAuth.authStateChanges();
  
  @override
  Future<Either<Failure, User>> signInWithEmailAndPassword({
    required String email,
    required String password,
  }) async {
    try {
      final credential = await _firebaseAuth.signInWithEmailAndPassword(
        email: email,
        password: password,
      );
      
      if (credential.user == null) {
        return Left(AuthFailure('Sign in failed'));
      }
      
      // 呼叫後端 API 同步用戶資訊
      await _apiClient.signIn({
        'email': email,
        'firebase_uid': credential.user!.uid,
      });
      
      return Right(credential.user!);
    } on FirebaseAuthException catch (e) {
      return Left(AuthFailure(e.message ?? 'Authentication failed'));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }
  
  @override
  Future<Either<Failure, void>> signOut() async {
    try {
      await _firebaseAuth.signOut();
      return const Right(null);
    } catch (e) {
      return Left(AuthFailure(e.toString()));
    }
  }
  
  @override
  Future<Either<Failure, String>> getIdToken() async {
    try {
      final user = _firebaseAuth.currentUser;
      if (user == null) {
        return Left(AuthFailure('No user logged in'));
      }
      final token = await user.getIdToken();
      return Right(token ?? '');
    } catch (e) {
      return Left(AuthFailure(e.toString()));
    }
  }
}
```

#### 4.1.2 認證狀態管理 (Riverpod)
```dart
// lib/presentation/providers/auth_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../core/di/injection.dart';
import '../../domain/repositories/auth_repository.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return getIt<AuthRepository>();
});

final authStateProvider = StreamProvider<User?>((ref) {
  return ref.watch(authRepositoryProvider).authStateChanges;
});

final currentUserProvider = Provider<User?>((ref) {
  return ref.watch(authStateProvider).value;
});

final isAuthenticatedProvider = Provider<bool>((ref) {
  return ref.watch(currentUserProvider) != null;
});
```

---

### 4.2 路由保護

```dart
// lib/presentation/routes/app_router.dart
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final isAuthenticated = ref.watch(isAuthenticatedProvider);
  
  return GoRouter(
    initialLocation: '/splash',
    redirect: (context, state) {
      final isGoingToAuth = state.matchedLocation.startsWith('/auth');
      
      if (!isAuthenticated && !isGoingToAuth && state.matchedLocation != '/splash') {
        return '/auth/signin';
      }
      
      if (isAuthenticated && isGoingToAuth) {
        return '/dashboard';
      }
      
      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/auth/signin',
        builder: (context, state) => const SignInScreen(),
      ),
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => const OnboardingScreen(),
      ),
      GoRoute(
        path: '/dashboard',
        builder: (context, state) => const DashboardScreen(),
      ),
      GoRoute(
        path: '/quick-capture',
        builder: (context, state) => const QuickCaptureScreen(),
      ),
      // ... 其他路由
    ],
  );
});
```

---

## 五、離線優先與數據同步 (Offline-First & Data Sync)

### 5.1 同步策略設計

#### 5.1.1 三層數據流
```
┌─────────────────────────────────────┐
│        Presentation Layer           │
│  (UI 只關心 Repository，不知道來源)  │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│         Repository Layer            │
│  決策邏輯：                          │
│  • 優先返回 Local Cache             │
│  • 背景同步 Remote                  │
│  • 衝突解決策略                     │
└─────┬─────────────────┬─────────────┘
      │                 │
┌─────▼────────┐ ┌──────▼──────────┐
│ Local Source │ │  Remote Source  │
│   (Hive)     │ │   (API Client)  │
└──────────────┘ └─────────────────┘
```

#### 5.1.2 Repository 實現範例
```dart
// lib/data/repositories/task_repository_impl.dart
import 'package:dartz/dartz.dart';
import '../../domain/entities/task.dart';
import '../../domain/repositories/task_repository.dart';
import '../datasources/local/task_local_datasource.dart';
import '../datasources/remote/task_remote_datasource.dart';

class TaskRepositoryImpl implements TaskRepository {
  final TaskRemoteDataSource remoteDataSource;
  final TaskLocalDataSource localDataSource;
  
  TaskRepositoryImpl({
    required this.remoteDataSource,
    required this.localDataSource,
  });
  
  @override
  Future<Either<Failure, List<Task>>> getTodayTasks() async {
    try {
      // 1. 先從本地獲取（立即返回）
      final localTasks = await localDataSource.getTodayTasks();
      
      // 2. 背景同步遠端數據
      _syncInBackground();
      
      return Right(localTasks.map((model) => model.toEntity()).toList());
    } catch (e) {
      return Left(CacheFailure(e.toString()));
    }
  }
  
  @override
  Future<Either<Failure, Task>> completeTask(String taskId) async {
    try {
      // 1. 立即更新本地（樂觀更新）
      await localDataSource.updateTaskStatus(taskId, 'ARCHIVE', completed: true);
      
      // 2. 背景同步遠端
      _syncTaskToRemote(taskId);
      
      final updatedTask = await localDataSource.getTaskById(taskId);
      return Right(updatedTask.toEntity());
    } catch (e) {
      // 回滾本地變更
      await localDataSource.rollbackTaskUpdate(taskId);
      return Left(CacheFailure(e.toString()));
    }
  }
  
  Future<void> _syncInBackground() async {
    try {
      final remoteTasks = await remoteDataSource.getTasks();
      await localDataSource.saveAll(remoteTasks);
    } catch (e) {
      // 靜默失敗，下次再同步
      print('Background sync failed: $e');
    }
  }
  
  Future<void> _syncTaskToRemote(String taskId) async {
    try {
      final localTask = await localDataSource.getTaskById(taskId);
      await remoteDataSource.updateTask(
        taskId,
        UpdateTaskRequest.fromModel(localTask),
      );
    } catch (e) {
      // 標記為待同步，稍後重試
      await localDataSource.markAsPendingSync(taskId);
    }
  }
}
```

---

### 5.2 衝突解決策略

#### 5.2.1 時間戳衝突解決
```dart
// lib/core/sync/conflict_resolver.dart
class ConflictResolver {
  /// 解決任務更新衝突
  /// 策略：最後寫入優先 (Last-Write-Wins)
  Task resolveTaskConflict(Task local, Task remote) {
    final localTimestamp = local.updatedAt ?? DateTime(1970);
    final remoteTimestamp = remote.updatedAt ?? DateTime(1970);
    
    // 1. 時間戳較新的優先
    if (localTimestamp.isAfter(remoteTimestamp)) {
      return local;
    } else if (remoteTimestamp.isAfter(localTimestamp)) {
      return remote;
    }
    
    // 2. 時間戳相同，特殊處理
    return _resolveSpecialCases(local, remote);
  }
  
  Task _resolveSpecialCases(Task local, Task remote) {
    // 規則 1: 刪除優先
    if (local.deletedAt != null || remote.deletedAt != null) {
      return local.deletedAt != null ? local : remote;
    }
    
    // 規則 2: 完成狀態優先
    if (local.status == TaskStatus.archive || remote.status == TaskStatus.archive) {
      return local.status == TaskStatus.archive ? local : remote;
    }
    
    // 規則 3: 默認保留 Remote（服務器為準）
    return remote;
  }
}
```

#### 5.2.2 待同步佇列
```dart
// lib/data/datasources/local/sync_queue_datasource.dart
class SyncQueueDataSource {
  final Box<Map> _syncQueueBox;
  
  SyncQueueDataSource(this._syncQueueBox);
  
  /// 添加待同步項目
  Future<void> enqueue(SyncItem item) async {
    await _syncQueueBox.put(item.id, item.toJson());
  }
  
  /// 獲取所有待同步項目
  Future<List<SyncItem>> getPendingItems() async {
    return _syncQueueBox.values
        .map((json) => SyncItem.fromJson(json))
        .toList();
  }
  
  /// 標記為已同步
  Future<void> markAsSynced(String itemId) async {
    await _syncQueueBox.delete(itemId);
  }
  
  /// 批次同步
  Future<void> syncAll(ApiClient apiClient) async {
    final items = await getPendingItems();
    
    for (final item in items) {
      try {
        await _syncSingleItem(item, apiClient);
        await markAsSynced(item.id);
      } catch (e) {
        // 記錄錯誤但繼續同步其他項目
        print('Failed to sync item ${item.id}: $e');
      }
    }
  }
  
  Future<void> _syncSingleItem(SyncItem item, ApiClient apiClient) async {
    switch (item.type) {
      case SyncType.taskUpdate:
        await apiClient.updateTask(item.id, item.payload);
        break;
      case SyncType.taskCreate:
        await apiClient.createTask(item.payload);
        break;
      case SyncType.taskDelete:
        await apiClient.deleteTask(item.id);
        break;
    }
  }
}
```

---

## 六、開發階段規劃 (Development Phases)

### Phase 1: 基礎建設 (Week 1-2)

#### Sprint 1: 專案初始化 (Week 1)
**目標**：建立專案骨架與開發環境

**任務清單**：
- [ ] 初始化 Flutter 專案
  ```bash
  flutter create naruvia_app --org com.zentropy
  cd naruvia_app
  flutter pub add riverpod flutter_riverpod go_router dio retrofit hive
  ```
- [ ] 配置依賴注入 (GetIt)
- [ ] 建立 Clean Architecture 目錄結構
- [ ] 配置 Firebase (iOS + Android)
  - 下載 `google-services.json` (Android)
  - 下載 `GoogleService-Info.plist` (iOS)
  - 配置 `firebase_core`
- [ ] 建立 API Client (Retrofit)
- [ ] 建立基礎 Models (Task, Area, Product)
- [ ] 配置環境變數 (開發/生產環境 API URL)

**交付物**：
- 可編譯且運行的空白 App
- 完整的目錄結構
- Firebase 連線成功

---

#### Sprint 2: 認證流程 (Week 2)
**目標**：實現登入/登出功能

**任務清單**：
- [ ] 實現 Auth Repository
- [ ] 實現 SignIn/SignOut Use Cases
- [ ] 建立 SignIn Screen UI
- [ ] 建立 Auth State Provider (Riverpod)
- [ ] 實現路由保護 (GoRouter redirect)
- [ ] 建立 Splash Screen（檢查認證狀態）
- [ ] 錯誤處理（顯示錯誤訊息）

**交付物**：
- 用戶可以登入/登出
- 未登入自動導向登入頁
- 登入後自動導向 Dashboard

**測試**：
```bash
# 整合測試
flutter test integration_test/auth_flow_test.dart
```

---

### Phase 2: 核心功能 (Week 3-4)

#### Sprint 3: Dashboard 與 Task 顯示 (Week 3)
**目標**：顯示今日任務與結構視圖

**任務清單**：
- [ ] 實現 Library Repository (獲取 Area/Product/Task)
- [ ] 實現 Task Repository (CRUD)
- [ ] 建立 Dashboard Screen
  - Bottom Navigation
  - Today View
  - Structure View
  - Week View (基礎版)
- [ ] 建立 Task Card 組件
  - 大卡片 (Today View)
  - 小卡片 (列表)
- [ ] 實現任務篩選邏輯（今日、本週、逾期）
- [ ] 實現下拉刷新

**交付物**：
- Dashboard 顯示今日任務
- 可切換 Today/Structure/Week 視圖
- 下拉可刷新數據

---

#### Sprint 4: Quick Capture (Week 4)
**目標**：實現快速捕捉功能

**任務清單**：
- [ ] 實現 Brain Dump Repository
- [ ] 建立 Quick Capture Screen
  - 文字輸入 Tab
  - AI 處理 Loading 動畫
  - 結果預覽 UI
- [ ] 實現 Brain Dump 流程
  1. 用戶輸入
  2. 調用 API
  3. 顯示結果
  4. 用戶確認
- [ ] 實現任務創建成功動畫
- [ ] 錯誤處理（API 失敗、網路錯誤）

**交付物**：
- FAB 點擊打開 Quick Capture
- 輸入文字後 AI 自動分類
- 可預覽並確認創建

**測試**：
```dart
// widget_test/quick_capture_test.dart
testWidgets('Brain dump creates task successfully', (tester) async {
  // ... 測試邏輯
});
```

---

### Phase 3: 進階功能 (Week 5-6)

#### Sprint 5: Inbox 與任務操作 (Week 5)
**目標**：實現收件匣與任務管理

**任務清單**：
- [ ] 建立 Inbox Screen
- [ ] 實現滑動手勢
  - 左滑刪除 (Dismissible Widget)
  - 右滑完成
- [ ] 實現長按彈出 Action Sheet
- [ ] 實現任務編輯功能
- [ ] 實現任務完成動畫
- [ ] 實現 Inbox Zero 慶祝動畫

**交付物**：
- Inbox 顯示未分類任務
- 滑動操作流暢
- 完成動畫精美

---

#### Sprint 6: 離線與同步 (Week 6)
**目標**：實現離線優先邏輯

**任務清單**：
- [ ] 實現 Hive 本地存儲
  - Task Box
  - Area/Product Box
- [ ] 實現本地優先策略
  - 讀取優先從本地
  - 背景同步遠端
- [ ] 實現待同步佇列
- [ ] 實現衝突解決邏輯
- [ ] 實現網路狀態監聽
- [ ] 顯示離線/同步狀態 UI

**交付物**：
- App 離線可用（查看已下載任務）
- 離線創建的任務會在連線後同步
- 衝突自動解決

**測試**：
```dart
// integration_test/offline_sync_test.dart
testWidgets('Offline task syncs when online', (tester) async {
  // 1. 斷網
  // 2. 創建任務
  // 3. 連網
  // 4. 驗證同步
});
```

---

### Phase 4: 優化與拋光 (Week 7-8)

#### Sprint 7: UX 優化 (Week 7)
**任務清單**：
- [ ] 實現所有微互動動畫
  - 頁面轉場
  - 卡片縮放
  - Loading 狀態
- [ ] 實現暗色模式
- [ ] 實現主題切換
- [ ] 優化字體大小（支援系統設定）
- [ ] 無障礙標籤 (Semantics)
- [ ] 效能優化
  - 列表虛擬化
  - 圖片快取

**交付物**：
- 動畫流暢度達 60fps
- 暗色模式完善
- 無障礙測試通過

---

#### Sprint 8: 測試與發布準備 (Week 8)
**任務清單**：
- [ ] 單元測試覆蓋率 > 70%
- [ ] Widget 測試核心流程
- [ ] 整合測試關鍵場景
- [ ] 配置 CI/CD (GitHub Actions)
  ```yaml
  name: Flutter CI
  on: [push, pull_request]
  jobs:
    test:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v2
        - uses: subosito/flutter-action@v2
        - run: flutter pub get
        - run: flutter test
  ```
- [ ] Beta 測試 (TestFlight / Internal Testing)
- [ ] 修復 Beta 反饋問題
- [ ] App Store / Google Play 上架準備

**交付物**：
- Beta 版本可供測試
- 測試覆蓋率報告
- 上架準備文件

---

## 七、技術風險與緩解策略 (Risks & Mitigation)

### 7.1 技術風險

| 風險 | 嚴重性 | 可能性 | 緩解策略 |
|------|--------|--------|----------|
| **API 延遲導致 UX 卡頓** | 高 | 中 | • 本地優先策略<br>• Loading 骨架屏<br>• 樂觀更新 |
| **Firebase Auth Token 過期** | 中 | 高 | • Dio Interceptor 自動刷新<br>• 401 自動登出 |
| **多設備同步衝突** | 中 | 中 | • 時間戳衝突解決<br>• 特殊規則（刪除優先、完成優先） |
| **離線模式數據丟失** | 高 | 低 | • Hive 持久化<br>• 待同步佇列<br>• 重試機制 |
| **Large List 效能問題** | 中 | 高 | • ListView.builder<br>• 分頁加載<br>• 本地快取 |

---

### 7.2 開發風險

| 風險 | 緩解策略 |
|------|----------|
| **時程延誤** | • MVP 範圍嚴格控制<br>• 每週 Sprint Review<br>• 延後非核心功能 |
| **設計資源不足** | • 使用 Material Design 3<br>• 參考 Things 3 / Todoist 設計<br>• AI 輔助生成圖標 |
| **測試覆蓋不足** | • TDD 開發核心邏輯<br>• CI 強制測試通過<br>• Code Review 檢查 |

---

## 八、成功指標 (Success Metrics)

### 8.1 技術指標
- **App 啟動時間**: < 2 秒（冷啟動）
- **API 響應時間**: P95 < 500ms
- **離線可用率**: 100%（核心功能）
- **測試覆蓋率**: > 70%
- **Crash-Free Rate**: > 99.5%

### 8.2 體驗指標
- **快速捕捉完成時間**: < 10 秒
- **動畫幀率**: > 55 fps (目標 60fps)
- **UI 響應延遲**: < 100ms

### 8.3 業務指標（MVP 後）
- **7 日留存率**: > 40%
- **每日打開頻率**: ≥ 3 次/天
- **Inbox Zero 達成率**: > 60% 用戶/週

---

## 九、未來擴展 (Future Enhancements)

### Phase 5: 進階功能 (Week 9-12)
- [ ] 語音輸入 (Speech-to-Text)
- [ ] OCR 圖片輸入 (Google ML Kit)
- [ ] Push Notifications
- [ ] Widget (iOS 14+ / Android)
- [ ] Apple Watch / Wear OS
- [ ] Siri Shortcuts / Google Assistant

### Phase 6: 完整生態 (長期)
- [ ] 多人協作（共享 Area/Product）
- [ ] 數據匯出（Markdown、CSV）
- [ ] 第三方整合（Google Calendar、Slack）
- [ ] iPad 適配（Split View、鍵盤快捷鍵）
- [ ] macOS / Windows 桌面版（Flutter Desktop）

---

## 附錄 A：開發環境設定

### A.1 Flutter 環境
```bash
# 檢查 Flutter 版本
flutter --version
# Flutter 3.24.0 • Dart 3.5.0

# 檢查醫生
flutter doctor

# 切換 stable channel
flutter channel stable
flutter upgrade
```

### A.2 Firebase 配置
```bash
# 安裝 FlutterFire CLI
dart pub global activate flutterfire_cli

# 配置 Firebase 專案
flutterfire configure --project=zentropy-4f7a5

# 生成配置文件
# - android/app/google-services.json
# - ios/Runner/GoogleService-Info.plist
# - lib/firebase_options.dart
```

### A.3 代碼生成
```bash
# 生成 Freezed/Json Serializable 代碼
flutter pub run build_runner build --delete-conflicting-outputs

# 監聽模式（開發時）
flutter pub run build_runner watch
```

---

## 附錄 B：開發檢查清單

### B.1 每日檢查
- [ ] `flutter analyze` 無警告
- [ ] `flutter test` 全部通過
- [ ] Git Commit 訊息清晰
- [ ] Code Review 完成

### B.2 Sprint 結束檢查
- [ ] 所有計劃任務完成
- [ ] 新功能有測試覆蓋
- [ ] UI 符合設計稿
- [ ] 無已知嚴重 Bug
- [ ] README 文件更新

### B.3 發布前檢查
- [ ] 版本號更新（pubspec.yaml）
- [ ] Changelog 更新
- [ ] App Icon 正確
- [ ] Splash Screen 正確
- [ ] 隱私政策連結正確
- [ ] Beta 測試反饋修復完成

---

**文件版本**: 1.0  
**最後更新**: 2026-01-27  
**負責人**: Development Team  
**狀態**: Ready for Execution - 待開始實現
