import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:dartz/dartz.dart' hide Task;

import 'package:app/application/use_cases/update_task_details_use_case.dart';
import 'package:app/domain/entities/task.dart';
import 'package:app/domain/repositories/task_repository.dart';
import 'package:app/core/errors/failures.dart';

class MockTaskRepository extends Mock implements TaskRepository {}

void main() {
  late MockTaskRepository mockRepository;
  late UpdateTaskDetailsUseCase useCase;

  setUp(() {
    mockRepository = MockTaskRepository();
    useCase = UpdateTaskDetailsUseCase(mockRepository);
  });

  final testTask = Task(
    id: 'task-1',
    productId: 'product-1',
    content: 'Updated task content',
    status: TaskStatus.active,
    createdAt: DateTime.now(),
    updatedAt: DateTime.now(),
  );

  group('UpdateTaskDetailsUseCase', () {
    test('should update task content successfully', () async {
      // Arrange
      when(() => mockRepository.updateTaskDetails(
            taskId: any(named: 'taskId'),
            content: any(named: 'content'),
            status: any(named: 'status'),
            startDate: any(named: 'startDate'),
            dueDate: any(named: 'dueDate'),
            productId: any(named: 'productId'),
            topicId: any(named: 'topicId'),
            timeConfidence: any(named: 'timeConfidence'),
            tags: any(named: 'tags'),
          )).thenAnswer((_) async => Right(testTask));

      // Act
      final result = await useCase(UpdateTaskDetailsParams(
        taskId: 'task-1',
        content: 'Updated task content',
      ));

      // Assert
      expect(result.isRight(), true);
      result.fold(
        (failure) => fail('Should return task'),
        (task) {
          expect(task.id, 'task-1');
          expect(task.content, 'Updated task content');
        },
      );

      verify(() => mockRepository.updateTaskDetails(
            taskId: 'task-1',
            content: 'Updated task content',
          )).called(1);
    });

    test('should update task status successfully', () async {
      // Arrange
      final archivedTask = testTask.copyWith(status: TaskStatus.archive);
      when(() => mockRepository.updateTaskDetails(
            taskId: any(named: 'taskId'),
            content: any(named: 'content'),
            status: any(named: 'status'),
            startDate: any(named: 'startDate'),
            dueDate: any(named: 'dueDate'),
            productId: any(named: 'productId'),
            topicId: any(named: 'topicId'),
            timeConfidence: any(named: 'timeConfidence'),
            tags: any(named: 'tags'),
          )).thenAnswer((_) async => Right(archivedTask));

      // Act
      final result = await useCase(UpdateTaskDetailsParams(
        taskId: 'task-1',
        status: TaskStatus.archive,
      ));

      // Assert
      expect(result.isRight(), true);
      result.fold(
        (failure) => fail('Should return task'),
        (task) {
          expect(task.status, TaskStatus.archive);
        },
      );

      verify(() => mockRepository.updateTaskDetails(
            taskId: 'task-1',
            status: TaskStatus.archive,
          )).called(1);
    });

    test('should update task dates successfully', () async {
      // Arrange
      final startDate = DateTime(2026, 2, 1);
      final dueDate = DateTime(2026, 2, 15);
      final taskWithDates = testTask.copyWith(
        startDate: startDate,
        dueDate: dueDate,
      );

      when(() => mockRepository.updateTaskDetails(
            taskId: any(named: 'taskId'),
            content: any(named: 'content'),
            status: any(named: 'status'),
            startDate: any(named: 'startDate'),
            dueDate: any(named: 'dueDate'),
            productId: any(named: 'productId'),
            topicId: any(named: 'topicId'),
            timeConfidence: any(named: 'timeConfidence'),
            tags: any(named: 'tags'),
          )).thenAnswer((_) async => Right(taskWithDates));

      // Act
      final result = await useCase(UpdateTaskDetailsParams(
        taskId: 'task-1',
        startDate: startDate,
        dueDate: dueDate,
      ));

      // Assert
      expect(result.isRight(), true);
      result.fold(
        (failure) => fail('Should return task'),
        (task) {
          expect(task.startDate, startDate);
          expect(task.dueDate, dueDate);
        },
      );
    });

    test('should update task product and topic successfully', () async {
      // Arrange
      when(() => mockRepository.updateTaskDetails(
            taskId: any(named: 'taskId'),
            content: any(named: 'content'),
            status: any(named: 'status'),
            startDate: any(named: 'startDate'),
            dueDate: any(named: 'dueDate'),
            productId: any(named: 'productId'),
            topicId: any(named: 'topicId'),
            timeConfidence: any(named: 'timeConfidence'),
            tags: any(named: 'tags'),
          )).thenAnswer((_) async => Right(testTask));

      // Act
      final result = await useCase(UpdateTaskDetailsParams(
        taskId: 'task-1',
        productId: 'product-2',
        topicId: 'topic-1',
      ));

      // Assert
      expect(result.isRight(), true);
      verify(() => mockRepository.updateTaskDetails(
            taskId: 'task-1',
            productId: 'product-2',
            topicId: 'topic-1',
          )).called(1);
    });

    test('should return failure when repository fails', () async {
      // Arrange
      when(() => mockRepository.updateTaskDetails(
            taskId: any(named: 'taskId'),
            content: any(named: 'content'),
            status: any(named: 'status'),
            startDate: any(named: 'startDate'),
            dueDate: any(named: 'dueDate'),
            productId: any(named: 'productId'),
            topicId: any(named: 'topicId'),
            timeConfidence: any(named: 'timeConfidence'),
            tags: any(named: 'tags'),
          )).thenAnswer((_) async => Left(ServerFailure('Server error')));

      // Act
      final result = await useCase(UpdateTaskDetailsParams(
        taskId: 'task-1',
        content: 'Updated content',
      ));

      // Assert
      expect(result.isLeft(), true);
      result.fold(
        (failure) => expect(failure, isA<ServerFailure>()),
        (_) => fail('Should return failure'),
      );
    });
  });
}
