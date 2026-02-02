import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:dartz/dartz.dart';

import 'package:app/application/use_cases/delete_sub_item_use_case.dart';
import 'package:app/domain/repositories/task_repository.dart';
import 'package:app/core/errors/failures.dart';

class MockTaskRepository extends Mock implements TaskRepository {}

void main() {
  late MockTaskRepository mockRepository;
  late DeleteSubItemUseCase useCase;

  setUp(() {
    mockRepository = MockTaskRepository();
    useCase = DeleteSubItemUseCase(mockRepository);
  });

  group('DeleteSubItemUseCase', () {
    test('should delete sub-item successfully', () async {
      // Arrange
      when(() => mockRepository.deleteSubItem(
            any(),
            any(),
          )).thenAnswer((_) async => const Right(null));

      // Act
      final result = await useCase(DeleteSubItemParams(
        taskId: 'task-1',
        subItemId: 'sub-1',
      ));

      // Assert
      expect(result.isRight(), true);
      verify(() => mockRepository.deleteSubItem(
            'task-1',
            'sub-1',
          )).called(1);
    });

    test('should return failure when repository fails', () async {
      // Arrange
      when(() => mockRepository.deleteSubItem(
            any(),
            any(),
          )).thenAnswer((_) async => Left(ServerFailure('Server error')));

      // Act
      final result = await useCase(DeleteSubItemParams(
        taskId: 'task-1',
        subItemId: 'sub-1',
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
