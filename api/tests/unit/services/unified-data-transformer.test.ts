import { describe, it, expect } from 'vitest'
import { UnifiedDataTransformer } from '@/infrastructure/services/unified-data-transformer'
import type { UnifiedRawData } from '@/domain/interfaces/data-collector'

// ============================================================================
// Helpers
// ============================================================================

const TODAY = new Date('2026-02-16T00:00:00Z')
const TOMORROW = new Date('2026-02-17T00:00:00Z')
const IN_3_DAYS = new Date('2026-02-19T00:00:00Z')
const IN_7_DAYS = new Date('2026-02-23T00:00:00Z')
const YESTERDAY = new Date('2026-02-15T00:00:00Z')

function makeTask(overrides: Partial<UnifiedRawData['allTasks'][0]> = {}): UnifiedRawData['allTasks'][0] {
  return {
    id: 'task-1',
    content: '測試任務',
    status: 'ACTIVE',
    due_date: null,
    start_date: null,
    updated_at: YESTERDAY,
    completed_at: null,
    area_name: '事業',
    product_id: 'prod-1',
    product_name: 'Zentropy',
    product_description: null,
    inferred_from_milestone: null,
    date_source: null,
    ...overrides,
  }
}

function makeSubTask(overrides: Partial<UnifiedRawData['allSubTasks'][0]> = {}): UnifiedRawData['allSubTasks'][0] {
  return {
    id: 'sub-1',
    task_id: 'task-1',
    content: '子任務',
    completed: false,
    due_date: null,
    start_date: null,
    estimated_minutes: 60,
    order: 1,
    updated_at: YESTERDAY,
    ...overrides,
  }
}

function makeRawData(overrides: Partial<UnifiedRawData> = {}): UnifiedRawData {
  return {
    allTasks: [],
    allSubTasks: [],
    todayCalendar: [],
    tomorrowCalendar: [],
    weeklyCalendar: new Map(),
    completedTasks: [],
    unscheduledTasks: [],
    milestones: [],
    ...overrides,
  }
}

const transformer = new UnifiedDataTransformer()

// ============================================================================
// toPlanCollectedData - 候選篩選邏輯
// ============================================================================

describe('UnifiedDataTransformer', () => {
  describe('toPlanCollectedData', () => {
    describe('候選任務篩選', () => {
      it('逾期任務應成為候選', () => {
        const raw = makeRawData({
          allTasks: [makeTask({ id: 't1', due_date: YESTERDAY })],
        })
        const result = transformer.toPlanCollectedData(raw, TODAY, 'Asia/Taipei')
        expect(result.candidates).toHaveLength(1)
        expect(result.candidates[0].taskId).toBe('t1')
      })

      it('7天內到期且已可開始的任務應成為候選', () => {
        const raw = makeRawData({
          allTasks: [makeTask({ id: 't1', due_date: IN_3_DAYS })],
        })
        const result = transformer.toPlanCollectedData(raw, TODAY, 'Asia/Taipei')
        expect(result.candidates).toHaveLength(1)
      })

      it('7天內到期但 start_date 在未來的任務不應成為候選', () => {
        const raw = makeRawData({
          allTasks: [makeTask({ id: 't1', due_date: IN_3_DAYS, start_date: TOMORROW })],
        })
        const result = transformer.toPlanCollectedData(raw, TODAY, 'Asia/Taipei')
        expect(result.candidates).toHaveLength(0)
      })

      it('已開始的任務應成為候選', () => {
        const raw = makeRawData({
          allTasks: [makeTask({ id: 't1', start_date: YESTERDAY })],
        })
        const result = transformer.toPlanCollectedData(raw, TODAY, 'Asia/Taipei')
        expect(result.candidates).toHaveLength(1)
      })

      it('無日期的任務不應成為候選', () => {
        const raw = makeRawData({
          allTasks: [makeTask({ id: 't1' })],
        })
        const result = transformer.toPlanCollectedData(raw, TODAY, 'Asia/Taipei')
        expect(result.candidates).toHaveLength(0)
      })
    })

    describe('子任務到期拉入父任務', () => {
      it('父任務無日期但子任務今天到期 → 子任務應被排入候選', () => {
        const raw = makeRawData({
          allTasks: [makeTask({ id: 't1', due_date: null, start_date: null })],
          allSubTasks: [makeSubTask({ id: 's1', task_id: 't1', due_date: TODAY })],
        })
        const result = transformer.toPlanCollectedData(raw, TODAY, 'Asia/Taipei')
        expect(result.candidates).toHaveLength(1)
        expect(result.candidates[0].itemType).toBe('subtask')
        expect(result.candidates[0].subTaskId).toBe('s1')
      })

      it('父任務無日期但子任務 3 天內到期 → 子任務應被排入候選', () => {
        const raw = makeRawData({
          allTasks: [makeTask({ id: 't1', due_date: null, start_date: null })],
          allSubTasks: [makeSubTask({ id: 's1', task_id: 't1', due_date: IN_3_DAYS })],
        })
        const result = transformer.toPlanCollectedData(raw, TODAY, 'Asia/Taipei')
        expect(result.candidates).toHaveLength(1)
        expect(result.candidates[0].subTaskId).toBe('s1')
      })

      it('父任務無日期且子任務 7 天後到期 → 不應成為候選', () => {
        const raw = makeRawData({
          allTasks: [makeTask({ id: 't1', due_date: null, start_date: null })],
          allSubTasks: [makeSubTask({ id: 's1', task_id: 't1', due_date: IN_7_DAYS })],
        })
        const result = transformer.toPlanCollectedData(raw, TODAY, 'Asia/Taipei')
        expect(result.candidates).toHaveLength(0)
      })

      it('已完成的子任務不應觸發父任務被拉入', () => {
        const raw = makeRawData({
          allTasks: [makeTask({ id: 't1', due_date: null, start_date: null })],
          allSubTasks: [makeSubTask({ id: 's1', task_id: 't1', due_date: TODAY, completed: true })],
        })
        const result = transformer.toPlanCollectedData(raw, TODAY, 'Asia/Taipei')
        expect(result.candidates).toHaveLength(0)
      })

      it('多個子任務：只有到期的未完成子任務被展開', () => {
        const raw = makeRawData({
          allTasks: [makeTask({ id: 't1', due_date: null, start_date: null })],
          allSubTasks: [
            makeSubTask({ id: 's1', task_id: 't1', due_date: TODAY, completed: false }),
            makeSubTask({ id: 's2', task_id: 't1', due_date: null, completed: false, order: 2 }),
            makeSubTask({ id: 's3', task_id: 't1', due_date: YESTERDAY, completed: true, order: 3 }),
          ],
        })
        const result = transformer.toPlanCollectedData(raw, TODAY, 'Asia/Taipei')
        // 父任務被拉入後，所有未完成子任務都會展開
        const subTaskIds = result.candidates.map(c => c.subTaskId)
        expect(subTaskIds).toContain('s1')
        expect(subTaskIds).toContain('s2')
        expect(subTaskIds).not.toContain('s3') // 已完成不展開
      })
    })

    describe('子任務展開', () => {
      it('有未完成子任務時展開子任務而非父任務', () => {
        const raw = makeRawData({
          allTasks: [makeTask({ id: 't1', due_date: TODAY })],
          allSubTasks: [
            makeSubTask({ id: 's1', task_id: 't1' }),
            makeSubTask({ id: 's2', task_id: 't1', completed: true, order: 2 }),
          ],
        })
        const result = transformer.toPlanCollectedData(raw, TODAY, 'Asia/Taipei')
        expect(result.candidates).toHaveLength(1)
        expect(result.candidates[0].itemType).toBe('subtask')
        expect(result.candidates[0].subTaskId).toBe('s1')
      })

      it('無子任務時用父任務本身', () => {
        const raw = makeRawData({
          allTasks: [makeTask({ id: 't1', due_date: TODAY })],
        })
        const result = transformer.toPlanCollectedData(raw, TODAY, 'Asia/Taipei')
        expect(result.candidates).toHaveLength(1)
        expect(result.candidates[0].itemType).toBe('task')
        expect(result.candidates[0].subTaskId).toBeNull()
      })

      it('子任務繼承父任務的 due_date', () => {
        const raw = makeRawData({
          allTasks: [makeTask({ id: 't1', due_date: TODAY })],
          allSubTasks: [makeSubTask({ id: 's1', task_id: 't1', due_date: null })],
        })
        const result = transformer.toPlanCollectedData(raw, TODAY, 'Asia/Taipei')
        expect(result.candidates[0].dueDate).toEqual(TODAY)
      })

      it('子任務有自己的 due_date 時優先使用', () => {
        const raw = makeRawData({
          allTasks: [makeTask({ id: 't1', due_date: IN_3_DAYS })],
          allSubTasks: [makeSubTask({ id: 's1', task_id: 't1', due_date: TODAY })],
        })
        const result = transformer.toPlanCollectedData(raw, TODAY, 'Asia/Taipei')
        expect(result.candidates[0].dueDate).toEqual(TODAY)
      })
    })

    describe('容量計算', () => {
      it('會議時間應從可用時間中扣除', () => {
        const raw = makeRawData({
          todayCalendar: [{
            id: 'evt-1',
            summary: '站會',
            start_date_time: new Date('2026-02-16T09:00:00Z'),
            end_date_time: new Date('2026-02-16T10:00:00Z'),
            meet_link: null,
            event_link: '',
            attendees: [],
            task_id: null,
          }],
        })
        const result = transformer.toPlanCollectedData(raw, TODAY, 'Asia/Taipei')
        expect(result.meetingMinutes).toBe(60)
        expect(result.availableMinutes).toBeLessThan(8 * 60) // WORK_HOURS_PER_DAY * 60
      })

      it('未估時任務使用 30 分鐘作為保守預設', () => {
        // 這個測試驗證 weeklyOverview 中的 totalEstimatedMinutes 使用 30min 而非 60min
        const raw = makeRawData({
          allTasks: [
            makeTask({ id: 't1', due_date: TODAY, start_date: null }),
            makeTask({ id: 't2', due_date: TODAY, start_date: null }),
          ],
        })
        const result = transformer.toPlanCollectedData(raw, TODAY, 'Asia/Taipei')
        const todayOverview = result.weeklyOverview.find(d => d.date === TODAY.toISOString().substring(0, 10))
        // 2 tasks × 30min = 60min
        expect(todayOverview?.totalEstimatedMinutes).toBe(60)
      })
    })
  })
})
