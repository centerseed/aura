import 'dart:io';
import 'package:dartz/dartz.dart';
import '../../core/errors/failures.dart';

import '../entities/brain_dump_result.dart';

abstract class BrainDumpRepository {
  Future<Either<Failure, BrainDumpResult>> submit(String text);
  Future<Either<Failure, BrainDumpResult>> submitWithImage({
    required File imageFile,
    String text = '',
  });
}
