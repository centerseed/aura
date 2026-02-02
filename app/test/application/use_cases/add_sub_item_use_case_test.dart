import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:dartz/dartz.dart';

import 'package:app/application/use_cases/add_sub_item_use_case.dart';
import 'package:app/domain/repositories/task_repository.dart';
import 'package:app/core/errors/failures.dart';

class MockTaskRepository extends Mock implements TaskRepository {}

void main() {
  late MockTaskRepository mockRepository;
  late AddSubItemUseCase useCase;

  setUp(() {
    mockRepository = MockTaskRepository();
    useCase = AddSubItemUseCase(mockRepository);
  });

  group('AddSubItemUseCase', () {
    test('should add new sub-item successfully', () async {
      // Arrange
      when(() => mockRepository.addSubItem(
            any(),
            any(),
          )).thenAnswer((_) async => const Right(null));

      // Act
      final result = await useCase(AddSubItemParams(
        taskId: 'task-1',
        content: 'New sub-item',
      ));

      // Assert
      expect(result.isRight(), true);
      verify(() => mockRepository.addSubItem(
            'task-1',
            'New sub-item',
          )).called(1);
    });

    test('should handle empty content gracefully', () async {
      // Arrange
      when(() => mockRepository.addSubItem(
            any(),
            any(),
          )).thenAnswer((_) async => const Right(null));

      // Act
      final result = await useCase(AddSubItemParams(
        taskId: 'task-1',
        content: '',
      ));

      // Assert
      expect(result.isRight(), true);
      verify(() => mockRepository.addSubItem(
            'task-1',
            '',
          )).called(1);
    });

    test('should return failure when repository fails', () async {
      // Arrange
      when(() => mockRepository.addSubItem(
            any(),
            any(),
          )).thenAnswer((_) async => Left(ServerFailure('Server error')));

      // Act
      final result = await useCase(AddSubItemParams(
        taskId: 'task-1',
        content: 'New sub-item',
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
