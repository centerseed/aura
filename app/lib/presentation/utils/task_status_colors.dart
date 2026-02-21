import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../domain/entities/task.dart';

/// TaskStatus 顏色擴展（Presentation 層）
///
/// 將顏色邏輯從 Domain 層移出，保持 Domain 純粹性。
/// 元件使用 `taskStatus.color` 時，import 此檔案即可。
extension TaskStatusColor on TaskStatus {
  Color get color => switch (this) {
    TaskStatus.inbox     => AppColors.statusInbox,
    TaskStatus.active    => AppColors.statusActive,
    TaskStatus.maintain  => AppColors.statusMaintain,
    TaskStatus.reference => AppColors.statusReference,
    TaskStatus.archive   => AppColors.statusArchive,
  };
}
