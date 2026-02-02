import 'package:flutter_test/flutter_test.dart';
import 'package:app/data/models/brain_dump_models.dart';

void main() {
  group('BrainDumpResponse', () {
    test('應該正確解析 create_new_tasks 回應', () {
      final json = {
        'success': true,
        'action': 'create_new_tasks',
        'items': [
          {
            'id': 'task-1',
            'title': '測試任務',
            'narrative': '這是一個測試任務',
            'drawer': 'ACTIVE',
            'tag': {
              'area': '工作',
              'product': '專案 A',
              'topic': '開發'
            },
            'strategy_used': 'explicit',
            'reasoning': 'AI 判斷這是一個工作相關的任務'
          }
        ]
      };

      final response = BrainDumpResponse.fromJson(json);

      expect(response, isA<BrainDumpCreateNewTasksResponse>());

      response.when(
        createNewTasks: (success, items) {
          expect(success, true);
          expect(items, hasLength(1));
          expect(items.first.title, '測試任務');
          expect(items.first.reasoning, 'AI 判斷這是一個工作相關的任務');
        },
        appendSubItem: (_, __, ___, ____) {
          fail('應該是 createNewTasks');
        },
      );
    });

    test('應該正確解析 append_sub_item 回應', () {
      final json = {
        'success': true,
        'action': 'append_sub_item',
        'target_task': {
          'id': 'task-123',
          'content': '準備週報',
          'product': '專案 A'
        },
        'appended_sub_items': [
          {
            'id': 'sub-1',
            'content': '整理本週完成的功能',
            'completed': false,
            'created_at': '2026-02-01T10:00:00Z',
            'completed_at': null,
            'order': 0
          },
          {
            'id': 'sub-2',
            'content': '列出下週計畫',
            'completed': false,
            'created_at': '2026-02-01T10:00:01Z',
            'completed_at': null,
            'order': 1
          }
        ],
        'reasoning': '用戶輸入是簡短的執行步驟，明確是既有任務「準備週報」的子項目'
      };

      final response = BrainDumpResponse.fromJson(json);

      expect(response, isA<BrainDumpAppendSubItemResponse>());

      response.when(
        createNewTasks: (_, __) {
          fail('應該是 appendSubItem');
        },
        appendSubItem: (success, targetTask, appendedSubItems, reasoning) {
          expect(success, true);
          expect(targetTask.id, 'task-123');
          expect(targetTask.content, '準備週報');
          expect(appendedSubItems, hasLength(2));
          expect(appendedSubItems.first.content, '整理本週完成的功能');
          expect(reasoning, contains('簡短的執行步驟'));
        },
      );
    });

    test('當缺少 action 字段時應該默認為 create_new_tasks', () {
      final json = {
        'success': true,
        'items': [
          {
            'id': 'task-1',
            'title': '測試',
            'narrative': '測試',
            'drawer': 'ACTIVE',
            'tag': {
              'area': 'A',
              'product': 'B',
              'topic': 'C'
            }
          }
        ]
      };

      final response = BrainDumpResponse.fromJson(json);

      expect(response, isA<BrainDumpCreateNewTasksResponse>());
    });
  });

  group('BrainDumpTargetTask', () {
    test('應該正確序列化和反序列化', () {
      final json = {
        'id': 'task-123',
        'content': '準備週報',
        'product': '專案 A'
      };

      final targetTask = BrainDumpTargetTask.fromJson(json);

      expect(targetTask.id, 'task-123');
      expect(targetTask.content, '準備週報');
      expect(targetTask.product, '專案 A');
    });
  });

  group('BrainDumpAppendedSubItem', () {
    test('應該正確處理 created_at 和 completed_at', () {
      final json = {
        'id': 'sub-1',
        'content': '測試子項',
        'completed': false,
        'created_at': '2026-02-01T10:00:00Z',
        'completed_at': null,
        'order': 0
      };

      final subItem = BrainDumpAppendedSubItem.fromJson(json);

      expect(subItem.id, 'sub-1');
      expect(subItem.content, '測試子項');
      expect(subItem.completed, false);
      expect(subItem.createdAt, '2026-02-01T10:00:00Z');
      expect(subItem.completedAt, null);
      expect(subItem.order, 0);
    });
  });
}
