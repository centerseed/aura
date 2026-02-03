import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:dartz/dartz.dart';

import 'package:app/application/use_cases/get_product_references_use_case.dart';
import 'package:app/domain/entities/reference.dart';
import 'package:app/domain/repositories/product_repository.dart';
import 'package:app/core/errors/failures.dart';

class MockProductRepository extends Mock implements ProductRepository {}

void main() {
  late MockProductRepository mockRepository;
  late GetProductReferencesUseCase useCase;

  setUp(() {
    mockRepository = MockProductRepository();
    useCase = GetProductReferencesUseCase(mockRepository);
  });

  group('GetProductReferencesUseCase', () {
    const tProductId = 'product-1';
    final tReferences = [
      Reference(
        id: 'ref-1',
        type: ReferenceType.url,
        content: 'https://example.com',
        title: 'Example Website',
        createdAt: DateTime(2024, 1, 1),
      ),
      Reference(
        id: 'ref-2',
        type: ReferenceType.note,
        content: 'Important note about the project',
        title: 'Project Notes',
        createdAt: DateTime(2024, 1, 2),
      ),
      Reference(
        id: 'ref-3',
        type: ReferenceType.url,
        content: 'https://docs.example.com',
        createdAt: DateTime(2024, 1, 3),
      ),
    ];

    test('should get product references successfully', () async {
      // Arrange
      when(() => mockRepository.getProductReferences(any()))
          .thenAnswer((_) async => Right(tReferences));

      // Act
      final result = await useCase(
        GetProductReferencesParams(productId: tProductId),
      );

      // Assert
      expect(result.isRight(), true);
      result.fold(
        (_) => fail('Should return references'),
        (references) {
          expect(references, equals(tReferences));
          expect(references.length, 3);
          expect(references[0].type, ReferenceType.url);
          expect(references[1].type, ReferenceType.note);
          expect(references[2].title, isNull);
        },
      );
      verify(() => mockRepository.getProductReferences(tProductId)).called(1);
    });

    test('should return empty list when product has no references', () async {
      // Arrange
      when(() => mockRepository.getProductReferences(any()))
          .thenAnswer((_) async => const Right([]));

      // Act
      final result = await useCase(
        GetProductReferencesParams(productId: tProductId),
      );

      // Assert
      expect(result.isRight(), true);
      result.fold(
        (_) => fail('Should return empty list'),
        (references) {
          expect(references, isEmpty);
        },
      );
    });

    test('should return failure when repository fails', () async {
      // Arrange
      when(() => mockRepository.getProductReferences(any()))
          .thenAnswer((_) async => Left(ServerFailure('Server error')));

      // Act
      final result = await useCase(
        GetProductReferencesParams(productId: tProductId),
      );

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

    test('should return failure for network error', () async {
      // Arrange
      when(() => mockRepository.getProductReferences(any()))
          .thenAnswer((_) async => Left(NetworkFailure('No connection')));

      // Act
      final result = await useCase(
        GetProductReferencesParams(productId: tProductId),
      );

      // Assert
      expect(result.isLeft(), true);
      result.fold(
        (failure) {
          expect(failure, isA<NetworkFailure>());
          expect(failure.message, 'No connection');
        },
        (_) => fail('Should return network failure'),
      );
    });

    test('should return failure when product not found', () async {
      // Arrange
      when(() => mockRepository.getProductReferences(any()))
          .thenAnswer((_) async => Left(ServerFailure('Product not found')));

      // Act
      final result = await useCase(
        GetProductReferencesParams(productId: 'non-existent'),
      );

      // Assert
      expect(result.isLeft(), true);
      result.fold(
        (failure) {
          expect(failure, isA<ServerFailure>());
          expect(failure.message, 'Product not found');
        },
        (_) => fail('Should return server failure'),
      );
    });

    test('should handle only URL references', () async {
      // Arrange
      final tUrlReferences = [
        Reference(
          id: 'ref-1',
          type: ReferenceType.url,
          content: 'https://example.com',
          title: 'Example',
          createdAt: DateTime(2024, 1, 1),
        ),
        Reference(
          id: 'ref-2',
          type: ReferenceType.url,
          content: 'https://docs.example.com',
          createdAt: DateTime(2024, 1, 2),
        ),
      ];

      when(() => mockRepository.getProductReferences(any()))
          .thenAnswer((_) async => Right(tUrlReferences));

      // Act
      final result = await useCase(
        GetProductReferencesParams(productId: tProductId),
      );

      // Assert
      expect(result.isRight(), true);
      result.fold(
        (_) => fail('Should return references'),
        (references) {
          expect(references.length, 2);
          expect(references.every((ref) => ref.type == ReferenceType.url), true);
        },
      );
    });

    test('should handle only note references', () async {
      // Arrange
      final tNoteReferences = [
        Reference(
          id: 'ref-1',
          type: ReferenceType.note,
          content: 'First note',
          title: 'Note 1',
          createdAt: DateTime(2024, 1, 1),
        ),
        Reference(
          id: 'ref-2',
          type: ReferenceType.note,
          content: 'Second note',
          createdAt: DateTime(2024, 1, 2),
        ),
      ];

      when(() => mockRepository.getProductReferences(any()))
          .thenAnswer((_) async => Right(tNoteReferences));

      // Act
      final result = await useCase(
        GetProductReferencesParams(productId: tProductId),
      );

      // Assert
      expect(result.isRight(), true);
      result.fold(
        (_) => fail('Should return references'),
        (references) {
          expect(references.length, 2);
          expect(
            references.every((ref) => ref.type == ReferenceType.note),
            true,
          );
        },
      );
    });
  });
}
