import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:dartz/dartz.dart';

import 'package:app/application/use_cases/reorder_sub_items_use_case.dart';
import 'package:app/domain/repositories/task_repository.dart';
import 'package:app/core/errors/failures.dart';

class MockTaskRepository extends Mock implements TaskRepository {}

void main() {
  late MockTaskRepository mockRepository;
  late ReorderSubItemsUseCase useCase;

  setUp(() {
    mockRepository = MockTaskRepository();
    useCase = ReorderSubItemsUseCase(mockRepository);
  });

  group('ReorderSubItemsUseCase', () {
    test('should reorder sub-items successfully', () async {
      // Arrange
      final subItemIds = ['sub-3', 'sub-1', 'sub-2'];
      when(() => mockRepository.reorderSubItems(
            any(),
            any(),
          )).thenAnswer((_) async => const Right(null));

      // Act
      final result = await useCase(ReorderSubItemsParams(
        taskId: 'task-1',
        subItemIds: subItemIds,
      ));

      // Assert
      expect(result.isRight(), true);
      verify(() => mockRepository.reorderSubItems(
            'task-1',
            subItemIds,
          )).called(1);
    });

    test('should handle empty list of sub-items', () async {
      // Arrange
      when(() => mockRepository.reorderSubItems(
            any(),
            any(),
          )).thenAnswer((_) async => const Right(null));

      // Act
      final result = await useCase(ReorderSubItemsParams(
        taskId: 'task-1',
        subItemIds: [],
      ));

      // Assert
      expect(result.isRight(), true);
      verify(() => mockRepository.reorderSubItems(
            'task-1',
            [],
          )).called(1);
    });

    test('should handle single sub-item', () async {
      // Arrange
      when(() => mockRepository.reorderSubItems(
            any(),
            any(),
          )).thenAnswer((_) async => const Right(null));

      // Act
      final result = await useCase(ReorderSubItemsParams(
        taskId: 'task-1',
        subItemIds: ['sub-1'],
      ));

      // Assert
      expect(result.isRight(), true);
      verify(() => mockRepository.reorderSubItems(
            'task-1',
            ['sub-1'],
          )).called(1);
    });

    test('should return failure when repository fails', () async {
      // Arrange
      when(() => mockRepository.reorderSubItems(
            any(),
            any(),
          )).thenAnswer((_) async => Left(ServerFailure('Server error')));

      // Act
      final result = await useCase(ReorderSubItemsParams(
        taskId: 'task-1',
        subItemIds: ['sub-1', 'sub-2'],
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
