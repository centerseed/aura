import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:dartz/dartz.dart';

import 'package:app/application/use_cases/delete_product_reference_use_case.dart';
import 'package:app/domain/repositories/product_repository.dart';
import 'package:app/core/errors/failures.dart';

class MockProductRepository extends Mock implements ProductRepository {}

void main() {
  late MockProductRepository mockRepository;
  late DeleteProductReferenceUseCase useCase;

  setUp(() {
    mockRepository = MockProductRepository();
    useCase = DeleteProductReferenceUseCase(mockRepository);
  });

  group('DeleteProductReferenceUseCase', () {
    test('should delete product-level reference successfully', () async {
      // Arrange
      when(() => mockRepository.deleteProductReference(
            productId: any(named: 'productId'),
            referenceId: any(named: 'referenceId'),
            taskId: any(named: 'taskId'),
          )).thenAnswer((_) async => const Right(null));

      // Act
      final result = await useCase(DeleteProductReferenceParams(
        productId: 'product-1',
        referenceId: 'ref-1',
      ));

      // Assert
      expect(result.isRight(), true);
      verify(() => mockRepository.deleteProductReference(
            productId: 'product-1',
            referenceId: 'ref-1',
            taskId: null,
          )).called(1);
    });

    test('should delete task-level reference successfully', () async {
      // Arrange
      when(() => mockRepository.deleteProductReference(
            productId: any(named: 'productId'),
            referenceId: any(named: 'referenceId'),
            taskId: any(named: 'taskId'),
          )).thenAnswer((_) async => const Right(null));

      // Act
      final result = await useCase(DeleteProductReferenceParams(
        productId: 'product-1',
        referenceId: 'ref-1',
        taskId: 'task-1',
      ));

      // Assert
      expect(result.isRight(), true);
      verify(() => mockRepository.deleteProductReference(
            productId: 'product-1',
            referenceId: 'ref-1',
            taskId: 'task-1',
          )).called(1);
    });

    test('should return failure when repository fails', () async {
      // Arrange
      when(() => mockRepository.deleteProductReference(
            productId: any(named: 'productId'),
            referenceId: any(named: 'referenceId'),
            taskId: any(named: 'taskId'),
          )).thenAnswer((_) async => Left(ServerFailure('Server error')));

      // Act
      final result = await useCase(DeleteProductReferenceParams(
        productId: 'product-1',
        referenceId: 'ref-1',
      ));

      // Assert
      expect(result.isLeft(), true);
      result.fold(
        (failure) {
          expect(failure, isA<ServerFailure>());
          expect(failure.message, 'Server error');
        },
        (_) => fail('Should return failure'),
      );
    });

    test('should return failure when reference not found', () async {
      // Arrange
      when(() => mockRepository.deleteProductReference(
            productId: any(named: 'productId'),
            referenceId: any(named: 'referenceId'),
            taskId: any(named: 'taskId'),
          )).thenAnswer(
              (_) async => Left(ServerFailure('Reference not found')));

      // Act
      final result = await useCase(DeleteProductReferenceParams(
        productId: 'product-1',
        referenceId: 'non-existent-ref',
      ));

      // Assert
      expect(result.isLeft(), true);
      result.fold(
        (failure) {
          expect(failure, isA<ServerFailure>());
          expect(failure.message, contains('not found'));
        },
        (_) => fail('Should return failure'),
      );
    });

    test('should return failure for network error', () async {
      // Arrange
      when(() => mockRepository.deleteProductReference(
            productId: any(named: 'productId'),
            referenceId: any(named: 'referenceId'),
            taskId: any(named: 'taskId'),
          )).thenAnswer((_) async => Left(NetworkFailure('No connection')));

      // Act
      final result = await useCase(DeleteProductReferenceParams(
        productId: 'product-1',
        referenceId: 'ref-1',
      ));

      // Assert
      expect(result.isLeft(), true);
      result.fold(
        (failure) => expect(failure, isA<NetworkFailure>()),
        (_) => fail('Should return network failure'),
      );
    });

    test('should handle invalid product ID', () async {
      // Arrange
      when(() => mockRepository.deleteProductReference(
            productId: any(named: 'productId'),
            referenceId: any(named: 'referenceId'),
            taskId: any(named: 'taskId'),
          )).thenAnswer(
              (_) async => Left(ValidationFailure('Invalid product ID')));

      // Act
      final result = await useCase(DeleteProductReferenceParams(
        productId: '',
        referenceId: 'ref-1',
      ));

      // Assert
      expect(result.isLeft(), true);
      result.fold(
        (failure) => expect(failure, isA<ValidationFailure>()),
        (_) => fail('Should return validation failure'),
      );
    });
  });
}
