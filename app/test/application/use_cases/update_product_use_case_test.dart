import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:dartz/dartz.dart';

import 'package:app/application/use_cases/update_product_use_case.dart';
import 'package:app/domain/repositories/product_repository.dart';
import 'package:app/domain/entities/product.dart';
import 'package:app/core/errors/failures.dart';

class MockProductRepository extends Mock implements ProductRepository {}

void main() {
  late MockProductRepository mockRepository;
  late UpdateProductUseCase useCase;

  setUp(() {
    mockRepository = MockProductRepository();
    useCase = UpdateProductUseCase(mockRepository);
  });

  final testProduct = Product(
    id: 'product-1',
    areaId: 'area-1',
    name: 'Updated Product',
    description: 'Updated description',
    status: ProductStatus.active,
    lifecycle: ProductLifecycle.finite,
    displayOrder: 0,
    createdAt: DateTime.now(),
    updatedAt: DateTime.now(),
  );

  group('UpdateProductUseCase', () {
    test('should update product name successfully', () async {
      // Arrange
      when(() => mockRepository.updateProduct(
            productId: any(named: 'productId'),
            name: any(named: 'name'),
            description: any(named: 'description'),
            areaId: any(named: 'areaId'),
            status: any(named: 'status'),
            lifecycle: any(named: 'lifecycle'),
          )).thenAnswer((_) async => Right(testProduct));

      // Act
      final result = await useCase(UpdateProductParams(
        productId: 'product-1',
        name: 'Updated Product',
      ));

      // Assert
      expect(result.isRight(), true);
      result.fold(
        (failure) => fail('Should not return failure'),
        (product) {
          expect(product.id, 'product-1');
          expect(product.name, 'Updated Product');
        },
      );
      verify(() => mockRepository.updateProduct(
            productId: 'product-1',
            name: 'Updated Product',
            description: null,
            areaId: null,
            status: null,
            lifecycle: null,
          )).called(1);
    });

    test('should update product status successfully', () async {
      // Arrange
      when(() => mockRepository.updateProduct(
            productId: any(named: 'productId'),
            name: any(named: 'name'),
            description: any(named: 'description'),
            areaId: any(named: 'areaId'),
            status: any(named: 'status'),
            lifecycle: any(named: 'lifecycle'),
          )).thenAnswer((_) async => Right(testProduct));

      // Act
      final result = await useCase(UpdateProductParams(
        productId: 'product-1',
        status: ProductStatus.archive,
      ));

      // Assert
      expect(result.isRight(), true);
      verify(() => mockRepository.updateProduct(
            productId: 'product-1',
            name: null,
            description: null,
            areaId: null,
            status: ProductStatus.archive,
            lifecycle: null,
          )).called(1);
    });

    test('should update product lifecycle successfully', () async {
      // Arrange
      when(() => mockRepository.updateProduct(
            productId: any(named: 'productId'),
            name: any(named: 'name'),
            description: any(named: 'description'),
            areaId: any(named: 'areaId'),
            status: any(named: 'status'),
            lifecycle: any(named: 'lifecycle'),
          )).thenAnswer((_) async => Right(testProduct));

      // Act
      final result = await useCase(UpdateProductParams(
        productId: 'product-1',
        lifecycle: ProductLifecycle.perpetual,
      ));

      // Assert
      expect(result.isRight(), true);
      verify(() => mockRepository.updateProduct(
            productId: 'product-1',
            name: null,
            description: null,
            areaId: null,
            status: null,
            lifecycle: ProductLifecycle.perpetual,
          )).called(1);
    });

    test('should update multiple fields at once', () async {
      // Arrange
      when(() => mockRepository.updateProduct(
            productId: any(named: 'productId'),
            name: any(named: 'name'),
            description: any(named: 'description'),
            areaId: any(named: 'areaId'),
            status: any(named: 'status'),
            lifecycle: any(named: 'lifecycle'),
          )).thenAnswer((_) async => Right(testProduct));

      // Act
      final result = await useCase(UpdateProductParams(
        productId: 'product-1',
        name: 'New Name',
        description: 'New description',
        areaId: 'area-2',
        status: ProductStatus.active,
        lifecycle: ProductLifecycle.finite,
      ));

      // Assert
      expect(result.isRight(), true);
      verify(() => mockRepository.updateProduct(
            productId: 'product-1',
            name: 'New Name',
            description: 'New description',
            areaId: 'area-2',
            status: ProductStatus.active,
            lifecycle: ProductLifecycle.finite,
          )).called(1);
    });

    test('should return failure when repository fails', () async {
      // Arrange
      when(() => mockRepository.updateProduct(
            productId: any(named: 'productId'),
            name: any(named: 'name'),
            description: any(named: 'description'),
            areaId: any(named: 'areaId'),
            status: any(named: 'status'),
            lifecycle: any(named: 'lifecycle'),
          )).thenAnswer((_) async => Left(ServerFailure('Server error')));

      // Act
      final result = await useCase(UpdateProductParams(
        productId: 'product-1',
        name: 'Updated Name',
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

    test('should return failure when product not found', () async {
      // Arrange
      when(() => mockRepository.updateProduct(
            productId: any(named: 'productId'),
            name: any(named: 'name'),
            description: any(named: 'description'),
            areaId: any(named: 'areaId'),
            status: any(named: 'status'),
            lifecycle: any(named: 'lifecycle'),
          )).thenAnswer(
              (_) async => Left(ServerFailure('Product not found')));

      // Act
      final result = await useCase(UpdateProductParams(
        productId: 'non-existent',
        name: 'Updated Name',
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
      when(() => mockRepository.updateProduct(
            productId: any(named: 'productId'),
            name: any(named: 'name'),
            description: any(named: 'description'),
            areaId: any(named: 'areaId'),
            status: any(named: 'status'),
            lifecycle: any(named: 'lifecycle'),
          )).thenAnswer((_) async => Left(NetworkFailure('No connection')));

      // Act
      final result = await useCase(UpdateProductParams(
        productId: 'product-1',
        name: 'Updated Name',
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
