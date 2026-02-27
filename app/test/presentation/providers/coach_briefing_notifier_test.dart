import 'dart:async';

import 'package:dartz/dartz.dart' hide Task;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:app/core/errors/failures.dart';
import 'package:app/domain/entities/coach_briefing.dart';
import 'package:app/domain/entities/daily_plan.dart';
import 'package:app/domain/repositories/coach_repository.dart';
import 'package:app/presentation/providers/coach_provider.dart';

class MockCoachRepository extends Mock implements CoachRepository {}

CoachBriefing _makeBriefing({BriefingType type = BriefingType.morning}) =>
    CoachBriefing(
      id: 'briefing-${type.name}',
      type: type,
      briefingDate: '2026-02-27',
      calendarEvents: [],
      overdueTasks: [],
      approachingTasks: [],
      conflicts: [],
      stagnations: [],
      completedTasks: type == BriefingType.evening
          ? [const TaskSummary(id: 't1', content: 'done', status: 'ARCHIVE')]
          : [],
      remainingTasks: [],
      tomorrowPreview: [],
      summary: type.name,
      recommendations: [],
      deferSuggestions: [],
      createdAt: DateTime(2026, 2, 27),
      updatedAt: DateTime(2026, 2, 27),
    );

DailyPlan _makePlan() => DailyPlan(
      id: 'p1',
      planDate: '2026-02-27',
      items: [
        const DailyPlanItem(
          id: 'i1',
          itemType: 'task',
          content: 'Do work',
          order: 0,
        ),
      ],
      createdAt: DateTime(2026, 2, 27),
      updatedAt: DateTime(2026, 2, 27),
    );

void main() {
  late MockCoachRepository mockRepo;

  setUp(() {
    mockRepo = MockCoachRepository();
  });

  ProviderContainer _makeContainer() => ProviderContainer(
        overrides: [
          coachRepositoryProvider.overrideWithValue(mockRepo),
        ],
      );

  /// 建立 isAutoGenerating=true 的狀態：
  /// 模擬今日和昨日都無 plan，generatePlan 尚未完成（掛起）的場景
  Future<ProviderContainer> _setupAutoGeneratingState({
    required Completer<Either<Failure, DailyPlan>> generateCompleter,
  }) async {
    when(() => mockRepo.getLatestBriefing(type: any(named: 'type')))
        .thenAnswer((_) async => const Right(null));
    when(
      () => mockRepo.getPlan(
        date: any(named: 'date'),
        timezone: any(named: 'timezone'),
      ),
    ).thenAnswer((_) async => const Right(null));
    when(
      () => mockRepo.generatePlan(
        date: any(named: 'date'),
        timezone: any(named: 'timezone'),
      ),
    ).thenAnswer((_) => generateCompleter.future);

    final container = _makeContainer();
    await container.read(coachBriefingProvider.notifier).loadLatest();
    return container;
  }

  group('CoachBriefingNotifier', () {
    test(
      'T1: isAutoGenerating=true, forceRefresh=false → loadLatest 立刻 return，不呼叫 repo',
      () async {
        final generateCompleter = Completer<Either<Failure, DailyPlan>>();
        final container = await _setupAutoGeneratingState(
          generateCompleter: generateCompleter,
        );
        addTearDown(container.dispose);

        expect(
          container.read(coachBriefingProvider).isAutoGenerating,
          isTrue,
          reason: '初始狀態應為 isAutoGenerating=true',
        );

        // 清除互動記錄，再呼叫不帶 forceRefresh 的 loadLatest
        clearInteractions(mockRepo);
        await container.read(coachBriefingProvider.notifier).loadLatest();

        // 不應有任何額外的 repo 呼叫
        verifyNever(
          () => mockRepo.getLatestBriefing(type: any(named: 'type')),
        );
        verifyNever(
          () => mockRepo.getPlan(
            date: any(named: 'date'),
            timezone: any(named: 'timezone'),
          ),
        );
      },
    );

    test(
      'T2: isAutoGenerating=true, forceRefresh=true → 重置 state 並重新 fetch',
      () async {
        final generateCompleter = Completer<Either<Failure, DailyPlan>>();
        final container = await _setupAutoGeneratingState(
          generateCompleter: generateCompleter,
        );
        addTearDown(container.dispose);

        expect(
          container.read(coachBriefingProvider).isAutoGenerating,
          isTrue,
          reason: '初始狀態應為 isAutoGenerating=true',
        );

        // 準備刷新後的新資料
        final morningBriefing = _makeBriefing(type: BriefingType.morning);
        final todayPlan = _makePlan();

        when(() => mockRepo.getLatestBriefing(type: any(named: 'type')))
            .thenAnswer((_) async => Right(morningBriefing));
        when(
          () => mockRepo.getPlan(
            date: any(named: 'date'),
            timezone: any(named: 'timezone'),
          ),
        ).thenAnswer((_) async => Right(todayPlan));

        clearInteractions(mockRepo);
        await container
            .read(coachBriefingProvider.notifier)
            .loadLatest(forceRefresh: true);

        final stateAfterForceRefresh = container.read(coachBriefingProvider);
        expect(stateAfterForceRefresh.isAutoGenerating, isFalse);
        expect(stateAfterForceRefresh.isLoading, isFalse);
        expect(stateAfterForceRefresh.briefing, morningBriefing);
        expect(stateAfterForceRefresh.plan, todayPlan);

        // forceRefresh 應呼叫 repo 一次
        verify(
          () => mockRepo.getLatestBriefing(type: any(named: 'type')),
        ).called(1);

        // Race condition 驗證：舊的 generatePlan future 完成後不應覆寫新 state
        final staleResult = _makePlan();
        generateCompleter.complete(Right(staleResult));
        await Future<void>.delayed(Duration.zero);
        await Future<void>.delayed(Duration.zero);

        final stateAfterStaleComplete = container.read(coachBriefingProvider);
        expect(
          stateAfterStaleComplete.briefing,
          morningBriefing,
          reason: '舊 generation 的結果不應覆寫 forceRefresh 後的新 state',
        );
        expect(stateAfterStaleComplete.plan, todayPlan);
      },
    );

    test(
      'T3: _autoGeneratePlan 完成後，briefing.type 應反映 currentBriefingType（不保留 type 不符的舊 briefing）',
      () async {
        final morningBriefing = _makeBriefing(type: BriefingType.morning);
        final todayPlan = _makePlan();
        final container = _makeContainer();
        addTearDown(container.dispose);

        // 第一次呼叫 getLatestBriefing：回傳 null（無 briefing）
        // 第二次（_finalizePlanGeneration 內）：回傳 morning briefing
        var briefingCallCount = 0;
        when(() => mockRepo.getLatestBriefing(type: any(named: 'type')))
            .thenAnswer((_) async {
          briefingCallCount++;
          if (briefingCallCount >= 2) return Right(morningBriefing);
          return const Right(null);
        });

        // 今日和昨日均無 plan → 觸發 auto-generate
        when(
          () => mockRepo.getPlan(
            date: any(named: 'date'),
            timezone: any(named: 'timezone'),
          ),
        ).thenAnswer((_) async => const Right(null));

        // generatePlan 立即回傳 → 觸發 _finalizePlanGeneration
        when(
          () => mockRepo.generatePlan(
            date: any(named: 'date'),
            timezone: any(named: 'timezone'),
          ),
        ).thenAnswer((_) async => Right(todayPlan));

        await container.read(coachBriefingProvider.notifier).loadLatest();

        // 讓非同步的 _autoGeneratePlan + _finalizePlanGeneration 完成
        await Future<void>.delayed(Duration.zero);
        await Future<void>.delayed(Duration.zero);

        final finalState = container.read(coachBriefingProvider);
        expect(finalState.isAutoGenerating, isFalse);
        expect(finalState.plan, todayPlan);
        expect(
          finalState.briefing,
          morningBriefing,
          reason: '_finalizePlanGeneration 應在 briefing=null 時重新 fetch',
        );
        // 第一次：loadLatest 初始 fetch；第二次：_finalizePlanGeneration re-fetch
        expect(briefingCallCount, 2);
      },
    );

    test(
      'T4: 跨日端到端 — 晚上被中斷的 auto-generate + 早上 forceRefresh → morning briefing，completedTasks 為空',
      () async {
        final container = _makeContainer();
        addTearDown(container.dispose);

        // 階段一：模擬晚上的 auto-generate 被背景中斷（generatePlan 永不完成）
        final generateCompleter = Completer<Either<Failure, DailyPlan>>();
        when(() => mockRepo.getLatestBriefing(type: any(named: 'type')))
            .thenAnswer((_) async => const Right(null));
        when(
          () => mockRepo.getPlan(
            date: any(named: 'date'),
            timezone: any(named: 'timezone'),
          ),
        ).thenAnswer((_) async => const Right(null));
        when(
          () => mockRepo.generatePlan(
            date: any(named: 'date'),
            timezone: any(named: 'timezone'),
          ),
        ).thenAnswer((_) => generateCompleter.future);

        await container.read(coachBriefingProvider.notifier).loadLatest();
        expect(
          container.read(coachBriefingProvider).isAutoGenerating,
          isTrue,
          reason: '模擬晚上被中斷：isAutoGenerating 應為 true',
        );

        // 階段二：模擬隔天早上恢復 app，forceRefresh=true，今日已有 plan
        final morningBriefing = _makeBriefing(type: BriefingType.morning);
        final todayPlan = _makePlan();
        when(() => mockRepo.getLatestBriefing(type: any(named: 'type')))
            .thenAnswer((_) async => Right(morningBriefing));
        when(
          () => mockRepo.getPlan(
            date: any(named: 'date'),
            timezone: any(named: 'timezone'),
          ),
        ).thenAnswer((_) async => Right(todayPlan));

        await container
            .read(coachBriefingProvider.notifier)
            .loadLatest(forceRefresh: true);

        final finalState = container.read(coachBriefingProvider);
        expect(finalState.isAutoGenerating, isFalse);
        expect(finalState.plan, isNotNull);
        expect(
          finalState.briefing?.type,
          BriefingType.morning,
          reason: '早上恢復後應顯示 morning briefing',
        );
        expect(
          finalState.briefing?.completedTasks,
          isEmpty,
          reason: 'Morning briefing 的 completedTasks 應為空（非昨晚晚報的資料）',
        );
      },
    );
  });
}
