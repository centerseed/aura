import 'package:flutter_dual_cache/flutter_dual_cache.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:mocktail/mocktail.dart';

import 'package:app/data/datasources/remote/api_client.dart';
import 'package:app/data/models/task_model.dart';
import 'package:app/data/repositories/cached/task_cached_repository.dart';
import 'package:app/domain/entities/task.dart';

class MockApiClient extends Mock implements ApiClient {}

void main() {
  late MockApiClient mockApiClient;
  TaskCachedRepository? repository;

  setUpAll(() async {
    Hive.init('./test_hive_task');
  });

  setUp(() {
    mockApiClient = MockApiClient();
  });

  tearDown(() async {
    // Only dispose if repository was set in this test
    await repository?.dispose();
    repository = null;
  });

  TaskModel createTaskModel({
    required String id,
    required String content,
    String status = 'ACTIVE',
    String? productId = 'product-1',
  }) {
    return TaskModel(
      id: id,
      userId: 'user-1',
      productId: productId,
      content: content,
      status: status,
    );
  }

  group('TaskCachedRepository', () {
    group('API Processing', () {
      test('should fetch tasks from API and convert to entities', () async {
        // Arrange
        final taskModels = [
          createTaskModel(id: '1', content: 'Task 1'),
          createTaskModel(id: '2', content: 'Task 2'),
        ];

        when(() => mockApiClient.getTasks(
              status: any(named: 'status'),
              dueDateFrom: any(named: 'dueDateFrom'),
              dueDateTo: any(named: 'dueDateTo'),
              completedToday: any(named: 'completedToday'),
            )).thenAnswer((_) async => taskModels);

        repository = TaskCachedRepository(mockApiClient);
        await repository!.initialize();

        // Wait for async operations
        await Future.delayed(const Duration(milliseconds: 200));

        // Assert
        expect(repository!.currentState.hasData, isTrue);
        expect(repository!.currentState.data?.length, 2);
        expect(repository!.currentState.data?[0].content, 'Task 1');
        expect(repository!.currentState.data?[1].content, 'Task 2');
        verify(() => mockApiClient.getTasks()).called(1);
      });

      test('should filter out archived tasks in transformForDisplay', () async {
        // Arrange
        final taskModels = [
          createTaskModel(id: '1', content: 'Active Task', status: 'ACTIVE'),
          createTaskModel(id: '2', content: 'Archived Task', status: 'ARCHIVE'),
          createTaskModel(id: '3', content: 'Inbox Task', status: 'INBOX'),
        ];

        when(() => mockApiClient.getTasks(
              status: any(named: 'status'),
              dueDateFrom: any(named: 'dueDateFrom'),
              dueDateTo: any(named: 'dueDateTo'),
              completedToday: any(named: 'completedToday'),
            )).thenAnswer((_) async => taskModels);

        repository = TaskCachedRepository(mockApiClient);
        await repository!.initialize();
        await Future.delayed(const Duration(milliseconds: 200));

        // Assert - archived task should be filtered out
        expect(repository!.currentState.data?.length, 2);
        expect(
          repository!.currentState.data?.any((t) => t.status == TaskStatus.archive),
          isFalse,
        );
      });

      test('should handle API error gracefully', () async {
        // Arrange
        when(() => mockApiClient.getTasks(
              status: any(named: 'status'),
              dueDateFrom: any(named: 'dueDateFrom'),
              dueDateTo: any(named: 'dueDateTo'),
              completedToday: any(named: 'completedToday'),
            )).thenThrow(Exception('Network error'));

        repository = TaskCachedRepository(mockApiClient);
        await repository!.initialize();
        await Future.delayed(const Duration(milliseconds: 200));

        // Assert
        expect(repository!.currentState.hasError, isTrue);
        expect(repository!.currentState.isLoading, isFalse);
      });
    });

    group('Dual-Track Caching', () {
      test('should emit loading state initially', () async {
        // Arrange
        when(() => mockApiClient.getTasks(
              status: any(named: 'status'),
              dueDateFrom: any(named: 'dueDateFrom'),
              dueDateTo: any(named: 'dueDateTo'),
              completedToday: any(named: 'completedToday'),
            )).thenAnswer((_) async => [createTaskModel(id: '1', content: 'Task')]);

        repository = TaskCachedRepository(mockApiClient);

        // Assert - initial state should be loading
        expect(repository!.currentState.isLoading, isTrue);
      });

      test('should emit network data after fetch completes', () async {
        // Arrange
        when(() => mockApiClient.getTasks(
              status: any(named: 'status'),
              dueDateFrom: any(named: 'dueDateFrom'),
              dueDateTo: any(named: 'dueDateTo'),
              completedToday: any(named: 'completedToday'),
            )).thenAnswer((_) async => [createTaskModel(id: '1', content: 'Task')]);

        repository = TaskCachedRepository(mockApiClient);
        await repository!.initialize();
        await Future.delayed(const Duration(milliseconds: 200));

        // Assert
        expect(repository!.currentState.source, CacheSource.network);
        expect(repository!.currentState.isLoading, isFalse);
      });

      test('stream should emit state changes', () async {
        // Arrange
        when(() => mockApiClient.getTasks(
              status: any(named: 'status'),
              dueDateFrom: any(named: 'dueDateFrom'),
              dueDateTo: any(named: 'dueDateTo'),
              completedToday: any(named: 'completedToday'),
            )).thenAnswer((_) async => [createTaskModel(id: '1', content: 'Task')]);

        repository = TaskCachedRepository(mockApiClient);

        final states = <CacheState<List<Task>>>[];
        repository!.stream.listen(states.add);

        await repository!.initialize();
        await Future.delayed(const Duration(milliseconds: 200));

        // Assert - should have emitted multiple states
        expect(states.length, greaterThanOrEqualTo(2));
        expect(states.first.isLoading, isTrue);
        expect(states.last.hasData, isTrue);
      });

      test('refresh should fetch new data from API', () async {
        // Arrange
        when(() => mockApiClient.getTasks(
              status: any(named: 'status'),
              dueDateFrom: any(named: 'dueDateFrom'),
              dueDateTo: any(named: 'dueDateTo'),
              completedToday: any(named: 'completedToday'),
            )).thenAnswer((_) async => [createTaskModel(id: '1', content: 'Initial')]);

        repository = TaskCachedRepository(mockApiClient);
        await repository!.initialize();
        await Future.delayed(const Duration(milliseconds: 200));

        // Update mock for refresh
        when(() => mockApiClient.getTasks(
              status: any(named: 'status'),
              dueDateFrom: any(named: 'dueDateFrom'),
              dueDateTo: any(named: 'dueDateTo'),
              completedToday: any(named: 'completedToday'),
            )).thenAnswer((_) async => [createTaskModel(id: '1', content: 'Refreshed')]);

        await repository!.refresh();

        // Assert
        expect(repository!.currentState.data?.first.content, 'Refreshed');
        verify(() => mockApiClient.getTasks()).called(2);
      });

      test('invalidate should clear cache and reload', () async {
        // Arrange
        when(() => mockApiClient.getTasks(
              status: any(named: 'status'),
              dueDateFrom: any(named: 'dueDateFrom'),
              dueDateTo: any(named: 'dueDateTo'),
              completedToday: any(named: 'completedToday'),
            )).thenAnswer((_) async => [createTaskModel(id: '1', content: 'Task')]);

        repository = TaskCachedRepository(mockApiClient);
        await repository!.initialize();
        await Future.delayed(const Duration(milliseconds: 200));

        await repository!.invalidate();
        await Future.delayed(const Duration(milliseconds: 200));

        // Assert - should have fetched twice (init + invalidate)
        verify(() => mockApiClient.getTasks()).called(2);
      });
    });

    group('Serialization', () {
      late TaskCachedRepository serializationRepo;

      setUp(() {
        when(() => mockApiClient.getTasks(
              status: any(named: 'status'),
              dueDateFrom: any(named: 'dueDateFrom'),
              dueDateTo: any(named: 'dueDateTo'),
              completedToday: any(named: 'completedToday'),
            )).thenAnswer((_) async => []);
      });

      tearDown(() async {
        await serializationRepo.dispose();
      });

      test('toJson should correctly serialize Task entity', () async {
        // Arrange
        serializationRepo = TaskCachedRepository(mockApiClient);

        final task = Task(
          id: 'task-1',
          content: 'Test Task',
          status: TaskStatus.active,
          productId: 'product-1',
          dueDate: DateTime(2024, 1, 15),
          tags: ['tag1', 'tag2'],
        );

        // Act
        final json = serializationRepo.toJson(task);

        // Assert
        expect(json['id'], 'task-1');
        expect(json['content'], 'Test Task');
        expect(json['status'], 'ACTIVE');
        expect(json['product_id'], 'product-1');
        expect(json['tags'], ['tag1', 'tag2']);
      });

      test('fromJson should correctly deserialize to Task entity', () async {
        // Arrange
        serializationRepo = TaskCachedRepository(mockApiClient);

        final json = {
          'id': 'task-1',
          'user_id': 'user-1',
          'product_id': 'product-1',
          'content': 'Test Task',
          'status': 'ACTIVE',
          'due_date': '2024-01-15T00:00:00.000Z',
          'tags': ['tag1', 'tag2'],
        };

        // Act
        final task = serializationRepo.fromJson(json);

        // Assert
        expect(task.id, 'task-1');
        expect(task.content, 'Test Task');
        expect(task.status, TaskStatus.active);
        expect(task.productId, 'product-1');
      });
    });
  });
}
