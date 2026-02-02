import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:dartz/dartz.dart';

import 'package:app/application/use_cases/update_sub_item_use_case.dart';
import 'package:app/domain/repositories/task_repository.dart';
import 'package:app/core/errors/failures.dart';

class MockTaskRepository extends Mock implements TaskRepository {}

void main() {
  late MockTaskRepository mockRepository;
  late UpdateSubItemUseCase useCase;

  setUp(() {
    mockRepository = MockTaskRepository();
    useCase = UpdateSubItemUseCase(mockRepository);
  });

  group('UpdateSubItemUseCase', () {
    test('should toggle sub-item completion status', () async {
      // Arrange
      when(() => mockRepository.updateSubItem(
            any(),
            any(),
            completed: any(named: 'completed'),
            content: any(named: 'content'),
          )).thenAnswer((_) async => const Right(null));

      // Act
      final result = await useCase(UpdateSubItemParams(
        taskId: 'task-1',
        subItemId: 'sub-1',
        completed: true,
      ));

      // Assert
      expect(result.isRight(), true);
      verify(() => mockRepository.updateSubItem(
            'task-1',
            'sub-1',
            completed: true,
          )).called(1);
    });

    test('should update sub-item content', () async {
      // Arrange
      when(() => mockRepository.updateSubItem(
            any(),
            any(),
            completed: any(named: 'completed'),
            content: any(named: 'content'),
          )).thenAnswer((_) async => const Right(null));

      // Act
      final result = await useCase(UpdateSubItemParams(
        taskId: 'task-1',
        subItemId: 'sub-1',
        content: 'Updated sub-item content',
      ));

      // Assert
      expect(result.isRight(), true);
      verify(() => mockRepository.updateSubItem(
            'task-1',
            'sub-1',
            content: 'Updated sub-item content',
          )).called(1);
    });

    test('should update both content and completion status', () async {
      // Arrange
      when(() => mockRepository.updateSubItem(
            any(),
            any(),
            completed: any(named: 'completed'),
            content: any(named: 'content'),
          )).thenAnswer((_) async => const Right(null));

      // Act
      final result = await useCase(UpdateSubItemParams(
        taskId: 'task-1',
        subItemId: 'sub-1',
        completed: true,
        content: 'Updated and completed',
      ));

      // Assert
      expect(result.isRight(), true);
      verify(() => mockRepository.updateSubItem(
            'task-1',
            'sub-1',
            completed: true,
            content: 'Updated and completed',
          )).called(1);
    });

    test('should return failure when repository fails', () async {
      // Arrange
      when(() => mockRepository.updateSubItem(
            any(),
            any(),
            completed: any(named: 'completed'),
            content: any(named: 'content'),
          )).thenAnswer((_) async => Left(ServerFailure('Server error')));

      // Act
      final result = await useCase(UpdateSubItemParams(
        taskId: 'task-1',
        subItemId: 'sub-1',
        completed: true,
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
