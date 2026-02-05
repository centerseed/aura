import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:dartz/dartz.dart';

import 'package:app/application/use_cases/delete_product_use_case.dart';
import 'package:app/domain/repositories/product_repository.dart';
import 'package:app/core/errors/failures.dart';

class MockProductRepository extends Mock implements ProductRepository {}

void main() {
  late MockProductRepository mockRepository;
  late DeleteProductUseCase useCase;

  setUp(() {
    mockRepository = MockProductRepository();
    useCase = DeleteProductUseCase(mockRepository);
  });

  group('DeleteProductUseCase', () {
    test('should delete product successfully', () async {
      // Arrange
      when(() => mockRepository.deleteProduct(any()))
          .thenAnswer((_) async => const Right(null));

      // Act
      final result = await useCase(DeleteProductParams(productId: 'product-1'));

      // Assert
      expect(result.isRight(), true);
      verify(() => mockRepository.deleteProduct('product-1')).called(1);
    });

    test('should return failure when repository fails', () async {
      // Arrange
      when(() => mockRepository.deleteProduct(any()))
          .thenAnswer((_) async => Left(ServerFailure('Server error')));

      // Act
      final result = await useCase(DeleteProductParams(productId: 'product-1'));

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

    test('should return failure when product not found', () async {
      // Arrange
      when(() => mockRepository.deleteProduct(any()))
          .thenAnswer((_) async => Left(ServerFailure('Product not found')));

      // Act
      final result = await useCase(DeleteProductParams(productId: 'non-existent'));

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
      when(() => mockRepository.deleteProduct(any()))
          .thenAnswer((_) async => Left(NetworkFailure('No connection')));

      // Act
      final result = await useCase(DeleteProductParams(productId: 'product-1'));

      // Assert
      expect(result.isLeft(), true);
      result.fold(
        (failure) => expect(failure, isA<NetworkFailure>()),
        (_) => fail('Should return network failure'),
      );
    });

    test('should return failure when user has no permission', () async {
      // Arrange
      when(() => mockRepository.deleteProduct(any()))
          .thenAnswer((_) async => Left(AuthFailure('Unauthorized')));

      // Act
      final result = await useCase(DeleteProductParams(productId: 'product-1'));

      // Assert
      expect(result.isLeft(), true);
      result.fold(
        (failure) => expect(failure, isA<AuthFailure>()),
        (_) => fail('Should return auth failure'),
      );
    });

    test('should handle empty product ID', () async {
      // Arrange
      when(() => mockRepository.deleteProduct(any()))
          .thenAnswer((_) async => Left(ValidationFailure('Invalid product ID')));

      // Act
      final result = await useCase(DeleteProductParams(productId: ''));

      // Assert
      expect(result.isLeft(), true);
      result.fold(
        (failure) => expect(failure, isA<ValidationFailure>()),
        (_) => fail('Should return validation failure'),
      );
    });

    test('should pass correct product ID to repository', () async {
      // Arrange
      const testProductId = 'test-product-123';
      when(() => mockRepository.deleteProduct(testProductId))
          .thenAnswer((_) async => const Right(null));

      // Act
      await useCase(DeleteProductParams(productId: testProductId));

      // Assert
      verify(() => mockRepository.deleteProduct(testProductId)).called(1);
      verifyNever(() => mockRepository.deleteProduct(any(that: isNot(testProductId))));
    });
  });
}
