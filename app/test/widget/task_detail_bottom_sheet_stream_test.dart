/// Widget Test: TaskDetailBottomSheet stream 同步行為
///
/// 驗證場景：App 冷啟動後，Hive 快取先顯示舊 sub_items，
/// 幾秒後 API 回應更完整的資料時，modal sheet 應自動更新。
///
/// 根本原因：showModalBottomSheet 是獨立 Overlay，父層 widget tree 重建
/// 不會觸發 didUpdateWidget，必須靠 ref.listenManual 主動監聽。
library;

import 'dart:async';

import 'package:dartz/dartz.dart' hide Task;
import 'package:flutter/material.dart';
import 'package:flutter_dual_cache/flutter_dual_cache.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:app/core/di/providers.dart' as di;
import 'package:app/domain/entities/area.dart';
import 'package:app/domain/entities/product.dart';
import 'package:app/domain/entities/task.dart';
import 'package:app/presentation/providers/area_provider.dart';
import 'package:app/presentation/providers/product_provider.dart';
import 'package:app/presentation/providers/task_provider.dart';
import 'package:app/presentation/screens/home/widgets/task_detail_bottom_sheet.dart';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

SubItem _makeSubItem(String id, String content) => SubItem(
      id: id,
      content: content,
      completed: false,
    );

Task _makeTask(List<SubItem> subItems) => Task(
      id: 'task-1',
      content: '採買開學用品',
      status: TaskStatus.active,
      subItems: subItems,
      // productId 故意留 null，避免觸發 _fetchTopics → 不需要 mock ApiClient
    );

// ---------------------------------------------------------------------------
// Helper: 建立最小化 ProviderScope + MaterialApp
// ---------------------------------------------------------------------------

Widget _buildTestWidget({
  required Task task,
  required StreamController<CacheState<List<Task>>> streamController,
}) {
  return ProviderScope(
    overrides: [
      // 核心：用可控 StreamController 替換 cachedTasksStreamProvider
      di.cachedTasksStreamProvider.overrideWith(
        (ref) => streamController.stream,
      ),

      // 分類 chips 需要 areas / products，回傳空 list 避免真實 API 呼叫
      areasProvider.overrideWith(
        (ref) async => const Right(<Area>[]),
      ),
      productsProvider.overrideWith(
        (ref) async => const Right(<Product>[]),
      ),

      // 今日完成任務 provider（_handleComplete 會 invalidate 此 provider）
      completedTodayTasksProvider.overrideWith(
        (ref) async => TaskDataState(tasks: const []),
      ),
    ],
    child: MaterialApp(
      home: Scaffold(
        body: TaskDetailBottomSheet(task: task),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void main() {
  late StreamController<CacheState<List<Task>>> streamController;

  setUp(() {
    // broadcast 讓多個 listener（ref.listenManual）可以同時訂閱
    streamController =
        StreamController<CacheState<List<Task>>>.broadcast();
  });

  tearDown(() {
    streamController.close();
  });

  testWidgets(
    '[主測試] stream 更新 sub_items 時，底部表自動同步顯示最新數量',
    (tester) async {
      // ── Arrange ──────────────────────────────────────────────────────────
      // 模擬 Hive 快取：只有 1 個 sub_item
      final initialTask = _makeTask([_makeSubItem('sub-1', '購買筆記本')]);

      await tester.pumpWidget(
        _buildTestWidget(task: initialTask, streamController: streamController),
      );
      // addPostFrameCallback 在第一個 frame 結束後才執行，
      // pumpWidget 已觸發第一個 frame，但 callback 在下一個 pump 時才保證完成
      await tester.pump();

      // ── 確認初始狀態：1 項（來自 widget.task.subItems，不需要 stream）──
      expect(
        find.text('待辦 0/1'),
        findsOneWidget,
        reason: '初始化應顯示 Hive 快取的 1 個 sub_item',
      );

      // ── Act：模擬幾秒後 API 回應，帶來 8 個 sub_items ──────────────────
      final fullSubItems = List.generate(
        8,
        (i) => _makeSubItem('sub-${i + 1}', '採購項目 ${i + 1}'),
      );
      final updatedTask = _makeTask(fullSubItems);

      streamController.add(
        CacheState<List<Task>>(
          data: [updatedTask],
          source: CacheSource.network,
          isLoading: false,
        ),
      );

      // stream event → listener 觸發 setState → 重建 widget
      await tester.pump();

      // ── Assert ────────────────────────────────────────────────────────────
      expect(
        find.text('待辦 0/8'),
        findsOneWidget,
        reason: 'stream 更新後應自動顯示 8 個 sub_items，不需要關閉重開',
      );
      expect(
        find.text('待辦 0/1'),
        findsNothing,
        reason: '舊的 1 項計數應消失',
      );
    },
  );

  testWidgets(
    '[保護測試] 編輯模式（排序中）時，stream 更新不應覆蓋用戶操作',
    (tester) async {
      // ── Arrange ──────────────────────────────────────────────────────────
      final initialTask = _makeTask([_makeSubItem('sub-1', '購買筆記本')]);

      await tester.pumpWidget(
        _buildTestWidget(task: initialTask, streamController: streamController),
      );
      await tester.pump();

      expect(find.text('待辦 0/1'), findsOneWidget);

      // 用戶點擊「排序」進入編輯模式（_isSubItemEditMode = true）
      await tester.tap(find.text('排序'));
      await tester.pump();

      // ── Act：stream 帶來 8 項（但用戶正在操作，不應被打斷）────────────
      final fullSubItems = List.generate(
        8,
        (i) => _makeSubItem('sub-${i + 1}', '採購項目 ${i + 1}'),
      );
      streamController.add(
        CacheState<List<Task>>(
          data: [_makeTask(fullSubItems)],
          source: CacheSource.network,
          isLoading: false,
        ),
      );
      await tester.pump();

      // ── Assert：編輯模式保護，仍顯示原來的 1 項 ────────────────────────
      expect(
        find.text('待辦 0/1'),
        findsOneWidget,
        reason: '_isSubItemEditMode = true 時，stream 更新應被跳過',
      );
    },
  );

  testWidgets(
    '[邊界測試] stream 帶來不同 task 的更新時，不應影響當前底部表',
    (tester) async {
      // ── Arrange ──────────────────────────────────────────────────────────
      final initialTask = _makeTask([_makeSubItem('sub-1', '購買筆記本')]);

      await tester.pumpWidget(
        _buildTestWidget(task: initialTask, streamController: streamController),
      );
      await tester.pump();

      expect(find.text('待辦 0/1'), findsOneWidget);

      // ── Act：stream 更新的是另一個 task-999，與當前 task-1 無關 ─────────
      final otherTask = Task(
        id: 'task-999', // 不同 id
        content: '其他任務',
        status: TaskStatus.active,
        subItems: List.generate(5, (i) => _makeSubItem('other-$i', '其他 $i')),
      );

      streamController.add(
        CacheState<List<Task>>(
          data: [otherTask],
          source: CacheSource.network,
          isLoading: false,
        ),
      );
      await tester.pump();

      // ── Assert：當前底部表不應受影響，仍顯示 1 項 ───────────────────────
      expect(
        find.text('待辦 0/1'),
        findsOneWidget,
        reason: '不同 task 的 stream 更新，不應影響當前底部表的 sub_items',
      );
    },
  );
}
