/**
 * calculateDueDate 函數單元測試
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function getDefaultDays(taskType: string | undefined): number {
  switch (taskType) {
    case 'waiting': return 10;
    case 'booking': return 6;
    case 'preparation': return 4;
    case 'execution': return 2;
    default: return 3;
  }
}

type StructuredItem = {
  title: string;
  due_date?: string;
  inferred_from_milestone?: string;
  task_type?: 'waiting' | 'booking' | 'preparation' | 'execution';
  estimated_days_needed?: number;
  depends_on_task?: string;
  sub_items?: { content: string }[];
  time_confidence?: number;
};

type Milestone = { id: string; name: string; target_date: Date };

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function calculateDueDate(
  item: StructuredItem,
  milestones: Milestone[],
  siblingItems: StructuredItem[],
  now: Date = new Date()
): { dueDate: Date | null; inferredFromMilestone: string | null; timeConfidence: number | null } {

  if (item.due_date) {
    return {
      dueDate: new Date(item.due_date),
      inferredFromMilestone: null,
      timeConfidence: item.time_confidence ?? 1.0,
    };
  }

  if (item.inferred_from_milestone && isValidUUID(item.inferred_from_milestone)) {
    const milestone = milestones.find(m => m.id === item.inferred_from_milestone);

    if (milestone?.target_date) {
      let daysBeforeMilestone = item.estimated_days_needed ?? getDefaultDays(item.task_type);

      if (item.depends_on_task) {
        const dependentItem = siblingItems.find(si => si.title === item.depends_on_task);
        if (dependentItem) {
          const dependentDays = dependentItem.estimated_days_needed ?? getDefaultDays(dependentItem.task_type);
          daysBeforeMilestone += dependentDays;
        }
      }

      if (item.sub_items && item.sub_items.length > 0) {
        daysBeforeMilestone += Math.ceil(item.sub_items.length * 0.5);
      }

      const daysUntilMilestone = Math.ceil(
        (milestone.target_date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysBeforeMilestone >= daysUntilMilestone) {
        daysBeforeMilestone = Math.max(1, daysUntilMilestone - 1);
      }

      const dueDate = new Date(milestone.target_date);
      dueDate.setDate(dueDate.getDate() - daysBeforeMilestone);

      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      if (dueDate < tomorrow) {
        dueDate.setTime(tomorrow.getTime());
      }

      return {
        dueDate,
        inferredFromMilestone: milestone.id,
        timeConfidence: item.time_confidence ?? 0.5,
      };
    }
  }

  return {
    dueDate: null,
    inferredFromMilestone: item.inferred_from_milestone && isValidUUID(item.inferred_from_milestone)
      ? item.inferred_from_milestone
      : null,
    timeConfidence: null,
  };
}

// 輔助：計算兩個日期相差幾天
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

describe('calculateDueDate', () => {
  const mockMilestoneId = '12345678-1234-1234-1234-123456789abc';
  const mockToday = new Date(2026, 1, 3); // 2026-02-03
  const mockMilestoneDate = new Date(2026, 1, 7); // 2026-02-07（4 天後）

  const mockMilestone: Milestone = {
    id: mockMilestoneId,
    name: '測試里程碑',
    target_date: mockMilestoneDate,
  };

  describe('用戶明確指定日期', () => {
    it('應該直接使用用戶指定的日期', () => {
      const userDate = new Date(2026, 1, 5); // 2026-02-05
      const item: StructuredItem = {
        title: '測試任務',
        due_date: userDate.toISOString(),
      };

      const result = calculateDueDate(item, [mockMilestone], [], mockToday);

      expect(result.dueDate?.getDate()).toBe(5);
      expect(result.inferredFromMilestone).toBeNull();
      expect(result.timeConfidence).toBe(1.0);
    });
  });

  describe('從里程碑推斷', () => {
    it('waiting 類型：里程碑前 10 天，但受限於剩餘天數', () => {
      const item: StructuredItem = {
        title: '需等待的任務',
        inferred_from_milestone: mockMilestoneId,
        task_type: 'waiting', // 預設 10 天
      };

      const result = calculateDueDate(item, [mockMilestone], [], mockToday);

      // 里程碑 2/7，今天 2/3，剩餘 4 天
      // waiting 要 10 天，但只剩 4 天，所以 daysBeforeMilestone = 4-1 = 3 天
      // due_date = 2/7 - 3 = 2/4
      const daysBeforeMilestone = daysBetween(result.dueDate!, mockMilestoneDate);
      expect(daysBeforeMilestone).toBe(3); // 里程碑前 3 天
      expect(result.inferredFromMilestone).toBe(mockMilestoneId);
    });

    it('execution 類型：里程碑前 2 天', () => {
      const item: StructuredItem = {
        title: '簡單任務',
        inferred_from_milestone: mockMilestoneId,
        task_type: 'execution', // 預設 2 天
      };

      const result = calculateDueDate(item, [mockMilestone], [], mockToday);

      // 里程碑 2/7 - 2 天 = 2/5
      const daysBeforeMilestone = daysBetween(result.dueDate!, mockMilestoneDate);
      expect(daysBeforeMilestone).toBe(2);
    });

    it('應該使用 AI 估算的 estimated_days_needed', () => {
      const item: StructuredItem = {
        title: '自訂天數任務',
        inferred_from_milestone: mockMilestoneId,
        estimated_days_needed: 3,
      };

      const result = calculateDueDate(item, [mockMilestone], [], mockToday);

      const daysBeforeMilestone = daysBetween(result.dueDate!, mockMilestoneDate);
      expect(daysBeforeMilestone).toBe(3);
    });

    it('有 sub_items 應該增加天數', () => {
      const item: StructuredItem = {
        title: '有子項目的任務',
        inferred_from_milestone: mockMilestoneId,
        task_type: 'execution', // 預設 2 天
        sub_items: [{ content: '1' }, { content: '2' }], // +1 天
      };

      const result = calculateDueDate(item, [mockMilestone], [], mockToday);

      // 2 + 1 = 3 天
      const daysBeforeMilestone = daysBetween(result.dueDate!, mockMilestoneDate);
      expect(daysBeforeMilestone).toBe(3);
    });
  });

  describe('依賴關係', () => {
    it('依賴其他任務時應該加上前置任務的天數', () => {
      const taskA: StructuredItem = {
        title: '前置任務',
        inferred_from_milestone: mockMilestoneId,
        estimated_days_needed: 2,
      };

      const taskB: StructuredItem = {
        title: '後置任務',
        inferred_from_milestone: mockMilestoneId,
        estimated_days_needed: 1,
        depends_on_task: '前置任務',
      };

      const resultB = calculateDueDate(taskB, [mockMilestone], [taskA, taskB], mockToday);

      // taskB: 1 + taskA: 2 = 3 天
      const daysBeforeMilestone = daysBetween(resultB.dueDate!, mockMilestoneDate);
      expect(daysBeforeMilestone).toBe(3);
    });
  });

  describe('邊界情況', () => {
    it('無效的 milestone ID 應該返回 null', () => {
      const item: StructuredItem = {
        title: '測試任務',
        inferred_from_milestone: 'invalid-id',
      };

      const result = calculateDueDate(item, [mockMilestone], [], mockToday);
      expect(result.dueDate).toBeNull();
    });

    it('找不到里程碑應該返回 null', () => {
      const item: StructuredItem = {
        title: '測試任務',
        inferred_from_milestone: '99999999-9999-9999-9999-999999999999',
      };

      const result = calculateDueDate(item, [mockMilestone], [], mockToday);
      expect(result.dueDate).toBeNull();
    });

    it('沒有任何時間資訊應該返回 null', () => {
      const item: StructuredItem = { title: '測試任務' };
      const result = calculateDueDate(item, [mockMilestone], [], mockToday);
      expect(result.dueDate).toBeNull();
    });
  });
});

describe('getDefaultDays', () => {
  it('各類型應該返回正確天數', () => {
    expect(getDefaultDays('waiting')).toBe(10);
    expect(getDefaultDays('booking')).toBe(6);
    expect(getDefaultDays('preparation')).toBe(4);
    expect(getDefaultDays('execution')).toBe(2);
    expect(getDefaultDays(undefined)).toBe(3);
  });
});
