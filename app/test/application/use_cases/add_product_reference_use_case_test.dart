import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:dartz/dartz.dart';

import 'package:app/application/use_cases/add_product_reference_use_case.dart';
import 'package:app/domain/entities/reference.dart';
import 'package:app/domain/repositories/product_repository.dart';
import 'package:app/core/errors/failures.dart';

class MockProductRepository extends Mock implements ProductRepository {}

void main() {
  late MockProductRepository mockRepository;
  late AddProductReferenceUseCase useCase;

  setUpAll(() {
    // Register fallback value for ReferenceType enum
    registerFallbackValue(ReferenceType.url);
  });

  setUp(() {
    mockRepository = MockProductRepository();
    useCase = AddProductReferenceUseCase(mockRepository);
  });

  group('AddProductReferenceUseCase', () {
    final tReference = Reference(
      id: 'ref-1',
      type: ReferenceType.url,
      content: 'https://example.com',
      title: 'Example',
      createdAt: DateTime(2024, 1, 1),
    );

    test('should add URL reference successfully', () async {
      // Arrange
      when(() => mockRepository.addProductReference(
            productId: any(named: 'productId'),
            type: any(named: 'type'),
            content: any(named: 'content'),
            title: any(named: 'title'),
          )).thenAnswer((_) async => Right(tReference));

      // Act
      final result = await useCase(AddProductReferenceParams(
        productId: 'product-1',
        type: ReferenceType.url,
        content: 'https://example.com',
        title: 'Example',
      ));

      // Assert
      expect(result.isRight(), true);
      result.fold(
        (_) => fail('Should return reference'),
        (reference) {
          expect(reference, equals(tReference));
          expect(reference.type, ReferenceType.url);
          expect(reference.content, 'https://example.com');
        },
      );
      verify(() => mockRepository.addProductReference(
            productId: 'product-1',
            type: ReferenceType.url,
            content: 'https://example.com',
            title: 'Example',
          )).called(1);
    });

    test('should add note reference successfully', () async {
      // Arrange
      final tNoteReference = Reference(
        id: 'ref-2',
        type: ReferenceType.note,
        content: 'Important note',
        title: 'Meeting Notes',
        createdAt: DateTime(2024, 1, 1),
      );

      when(() => mockRepository.addProductReference(
            productId: any(named: 'productId'),
            type: any(named: 'type'),
            content: any(named: 'content'),
            title: any(named: 'title'),
          )).thenAnswer((_) async => Right(tNoteReference));

      // Act
      final result = await useCase(AddProductReferenceParams(
        productId: 'product-1',
        type: ReferenceType.note,
        content: 'Important note',
        title: 'Meeting Notes',
      ));

      // Assert
      expect(result.isRight(), true);
      result.fold(
        (_) => fail('Should return reference'),
        (reference) {
          expect(reference, equals(tNoteReference));
          expect(reference.type, ReferenceType.note);
          expect(reference.content, 'Important note');
        },
      );
    });

    test('should add reference without title', () async {
      // Arrange
      final tReferenceNoTitle = Reference(
        id: 'ref-3',
        type: ReferenceType.url,
        content: 'https://example.com',
        createdAt: DateTime(2024, 1, 1),
      );

      when(() => mockRepository.addProductReference(
            productId: any(named: 'productId'),
            type: any(named: 'type'),
            content: any(named: 'content'),
            title: any(named: 'title'),
          )).thenAnswer((_) async => Right(tReferenceNoTitle));

      // Act
      final result = await useCase(AddProductReferenceParams(
        productId: 'product-1',
        type: ReferenceType.url,
        content: 'https://example.com',
      ));

      // Assert
      expect(result.isRight(), true);
      result.fold(
        (_) => fail('Should return reference'),
        (reference) {
          expect(reference.title, isNull);
        },
      );
      verify(() => mockRepository.addProductReference(
            productId: 'product-1',
            type: ReferenceType.url,
            content: 'https://example.com',
            title: null,
          )).called(1);
    });

    test('should return failure when repository fails', () async {
      // Arrange
      when(() => mockRepository.addProductReference(
            productId: any(named: 'productId'),
            type: any(named: 'type'),
            content: any(named: 'content'),
            title: any(named: 'title'),
          )).thenAnswer((_) async => Left(ServerFailure('Server error')));

      // Act
      final result = await useCase(AddProductReferenceParams(
        productId: 'product-1',
        type: ReferenceType.url,
        content: 'https://example.com',
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

    test('should return failure for network error', () async {
      // Arrange
      when(() => mockRepository.addProductReference(
            productId: any(named: 'productId'),
            type: any(named: 'type'),
            content: any(named: 'content'),
            title: any(named: 'title'),
          )).thenAnswer((_) async => Left(NetworkFailure('No connection')));

      // Act
      final result = await useCase(AddProductReferenceParams(
        productId: 'product-1',
        type: ReferenceType.url,
        content: 'https://example.com',
      ));

      // Assert
      expect(result.isLeft(), true);
      result.fold(
        (failure) => expect(failure, isA<NetworkFailure>()),
        (_) => fail('Should return network failure'),
      );
    });
  });
}
