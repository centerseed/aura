/**
 * 測試：apply-reorganization 的 sub_items 保留邏輯
 *
 * 測試目標：
 * 1. 已完成的 sub_items 不會被修改
 * 2. 新整合的 tasks 會被加到 sub_items 後面
 * 3. 語意守恆資訊正確保留
 * 4. order 欄位正確計算
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";

// Mock 資料結構
interface SubItem {
  id: string;
  content: string;
  completed: boolean;
  created_at: string;
  completed_at: string | null;
  order: number;
  // 語意守恆欄位（可選）
  key_intent?: string | null;
  preserved_in?: string | null;
  original_narrative?: string | null;
  original_due_date?: string | null;
}

interface Task {
  id: string;
  content: string;
  sub_items: SubItem[];
  ai_analysis: Record<string, unknown>;
  due_date: Date | null;
}

// 模擬 apply-reorganization 的核心邏輯
function applyConsolidation(
  parentTask: Task,
  subTasks: Task[],
  consolidation: {
    consolidated_title: string;
    consolidated_narrative: string;
    reasoning: string;
    semantic_preservation?: Array<{
      original_task_id: string;
      preserved_in: "title" | "narrative" | "sub_item";
      key_intent: string;
    }>;
  }
): { updatedSubItems: SubItem[]; updatedContent: string } {
  // ✅ 保留 parent task 原有的 sub_items（包含已完成的項目）
  const existingSubItems = parentTask.sub_items || [];

  // 計算新 sub_items 的起始 order（接在原有的後面）
  const startOrder = existingSubItems.length > 0
    ? Math.max(...existingSubItems.map(s => s.order ?? 0)) + 1
    : 0;

  // 構建新的 sub_items 陣列（來自被整合的 tasks）
  const newSubItems: SubItem[] = subTasks.map((subTask, idx) => ({
    id: subTask.id,
    content: subTask.content,
    completed: false,
    created_at: new Date().toISOString(),
    completed_at: null,
    order: startOrder + idx,
  }));

  // 建立語意映射表
  const semanticMap = new Map(
    (consolidation.semantic_preservation || []).map(sp => [sp.original_task_id, sp])
  );

  // ✅ 只對「新加入的 sub_items」增強語意資訊
  const enrichedNewSubItems: SubItem[] = newSubItems.map(item => {
    const semanticInfo = semanticMap.get(item.id);
    const originalTask = subTasks.find(t => t.id === item.id);
    const originalAnalysis = originalTask?.ai_analysis || {};

    return {
      ...item,
      key_intent: semanticInfo?.key_intent || null,
      preserved_in: semanticInfo?.preserved_in || "sub_item",
      original_narrative: (originalAnalysis as any).narrative || null,
      original_due_date: originalTask?.due_date?.toISOString() || null,
    };
  });

  // ✅ 合併：原有的 sub_items（包含已完成狀態）+ 新增強的 sub_items
  const updatedSubItems = [...existingSubItems, ...enrichedNewSubItems];

  return {
    updatedSubItems,
    updatedContent: consolidation.consolidated_title,
  };
}

describe("apply-reorganization sub_items 保留邏輯", () => {
  describe("1. 已完成的 sub_items 不被修改", () => {
    it("should preserve completed sub_items unchanged", () => {
      const parentTask: Task = {
        id: "parent-1",
        content: "原本的任務",
        sub_items: [
          {
            id: "sub-1",
            content: "已完成的項目",
            completed: true,
            created_at: "2024-01-01T00:00:00Z",
            completed_at: "2024-01-02T00:00:00Z",
            order: 0,
          },
          {
            id: "sub-2",
            content: "未完成的項目",
            completed: false,
            created_at: "2024-01-01T00:00:00Z",
            completed_at: null,
            order: 1,
          },
        ],
        ai_analysis: {},
        due_date: null,
      };

      const subTasks: Task[] = [
        {
          id: "task-new-1",
          content: "新整合的任務",
          sub_items: [],
          ai_analysis: { narrative: "這是新任務的敘述" },
          due_date: new Date("2024-01-15"),
        },
      ];

      const result = applyConsolidation(parentTask, subTasks, {
        consolidated_title: "整合後的標題",
        consolidated_narrative: "整合後的敘述",
        reasoning: "測試理由",
      });

      // 驗證已完成的 sub_item 沒有被修改
      const completedItem = result.updatedSubItems.find(s => s.id === "sub-1");
      expect(completedItem).toBeDefined();
      expect(completedItem?.completed).toBe(true);
      expect(completedItem?.completed_at).toBe("2024-01-02T00:00:00Z");
      expect(completedItem?.order).toBe(0);

      // 驗證未完成的 sub_item 也保留
      const pendingItem = result.updatedSubItems.find(s => s.id === "sub-2");
      expect(pendingItem).toBeDefined();
      expect(pendingItem?.completed).toBe(false);
      expect(pendingItem?.order).toBe(1);
    });
  });

  describe("2. 新整合的 tasks 加到後面", () => {
    it("should append new tasks with correct order", () => {
      const parentTask: Task = {
        id: "parent-1",
        content: "原本的任務",
        sub_items: [
          { id: "sub-1", content: "項目1", completed: true, created_at: "", completed_at: null, order: 0 },
          { id: "sub-2", content: "項目2", completed: false, created_at: "", completed_at: null, order: 1 },
        ],
        ai_analysis: {},
        due_date: null,
      };

      const subTasks: Task[] = [
        { id: "new-1", content: "新任務1", sub_items: [], ai_analysis: {}, due_date: null },
        { id: "new-2", content: "新任務2", sub_items: [], ai_analysis: {}, due_date: null },
      ];

      const result = applyConsolidation(parentTask, subTasks, {
        consolidated_title: "整合後標題",
        consolidated_narrative: "整合後敘述",
        reasoning: "測試",
      });

      // 驗證總數
      expect(result.updatedSubItems.length).toBe(4);

      // 驗證新加入的 order 從 2 開始（原有最大是 1）
      const newItem1 = result.updatedSubItems.find(s => s.id === "new-1");
      const newItem2 = result.updatedSubItems.find(s => s.id === "new-2");

      expect(newItem1?.order).toBe(2);
      expect(newItem2?.order).toBe(3);
    });

    it("should handle empty existing sub_items", () => {
      const parentTask: Task = {
        id: "parent-1",
        content: "沒有 sub_items 的任務",
        sub_items: [],
        ai_analysis: {},
        due_date: null,
      };

      const subTasks: Task[] = [
        { id: "new-1", content: "新任務1", sub_items: [], ai_analysis: {}, due_date: null },
      ];

      const result = applyConsolidation(parentTask, subTasks, {
        consolidated_title: "整合後標題",
        consolidated_narrative: "整合後敘述",
        reasoning: "測試",
      });

      expect(result.updatedSubItems.length).toBe(1);
      expect(result.updatedSubItems[0].order).toBe(0);
    });
  });

  describe("3. 語意守恆資訊正確保留", () => {
    it("should preserve semantic preservation info for new items", () => {
      const parentTask: Task = {
        id: "parent-1",
        content: "原本任務",
        sub_items: [],
        ai_analysis: {},
        due_date: null,
      };

      const subTasks: Task[] = [
        {
          id: "new-1",
          content: "購買材料",
          sub_items: [],
          ai_analysis: { narrative: "需要去五金行購買" },
          due_date: new Date("2024-01-20"),
        },
      ];

      const result = applyConsolidation(parentTask, subTasks, {
        consolidated_title: "專案準備：材料採購",
        consolidated_narrative: "需要準備材料以便後續施工",
        reasoning: "材料採購是專案準備的一部分",
        semantic_preservation: [
          {
            original_task_id: "new-1",
            preserved_in: "title",
            key_intent: "採購材料",
          },
        ],
      });

      const newItem = result.updatedSubItems.find(s => s.id === "new-1");
      expect(newItem).toBeDefined();
      expect(newItem?.key_intent).toBe("採購材料");
      expect(newItem?.preserved_in).toBe("title");
      expect(newItem?.original_narrative).toBe("需要去五金行購買");
      expect(newItem?.original_due_date).toBe("2024-01-20T00:00:00.000Z");
    });

    it("should not add semantic fields to existing items", () => {
      const parentTask: Task = {
        id: "parent-1",
        content: "原本任務",
        sub_items: [
          { id: "existing-1", content: "原有項目", completed: false, created_at: "", completed_at: null, order: 0 },
        ],
        ai_analysis: {},
        due_date: null,
      };

      const subTasks: Task[] = [
        { id: "new-1", content: "新任務", sub_items: [], ai_analysis: {}, due_date: null },
      ];

      const result = applyConsolidation(parentTask, subTasks, {
        consolidated_title: "整合標題",
        consolidated_narrative: "整合敘述",
        reasoning: "測試",
      });

      // 原有的項目不應該有語意守恆欄位
      const existingItem = result.updatedSubItems.find(s => s.id === "existing-1");
      expect(existingItem?.key_intent).toBeUndefined();
      expect(existingItem?.preserved_in).toBeUndefined();

      // 新項目應該有（即使是 null）
      const newItem = result.updatedSubItems.find(s => s.id === "new-1");
      expect(newItem?.key_intent).toBeNull(); // 沒有 semantic_preservation 時為 null
      expect(newItem?.preserved_in).toBe("sub_item"); // 預設值
    });
  });

  describe("4. 邊界情況", () => {
    it("should handle tasks with only completed sub_items", () => {
      const parentTask: Task = {
        id: "parent-1",
        content: "全部完成的任務",
        sub_items: [
          { id: "sub-1", content: "已完成1", completed: true, created_at: "", completed_at: "2024-01-01", order: 0 },
          { id: "sub-2", content: "已完成2", completed: true, created_at: "", completed_at: "2024-01-02", order: 1 },
        ],
        ai_analysis: {},
        due_date: null,
      };

      const subTasks: Task[] = [
        { id: "new-1", content: "新任務", sub_items: [], ai_analysis: {}, due_date: null },
      ];

      const result = applyConsolidation(parentTask, subTasks, {
        consolidated_title: "整合標題",
        consolidated_narrative: "整合敘述",
        reasoning: "測試",
      });

      // 全部已完成的項目都保留
      expect(result.updatedSubItems.filter(s => s.completed).length).toBe(2);

      // 新項目在最後
      const newItem = result.updatedSubItems.find(s => s.id === "new-1");
      expect(newItem?.order).toBe(2);
    });

    it("should handle non-sequential orders in existing sub_items", () => {
      const parentTask: Task = {
        id: "parent-1",
        content: "有 gap 的任務",
        sub_items: [
          { id: "sub-1", content: "項目1", completed: false, created_at: "", completed_at: null, order: 0 },
          { id: "sub-2", content: "項目2", completed: false, created_at: "", completed_at: null, order: 5 }, // gap
          { id: "sub-3", content: "項目3", completed: false, created_at: "", completed_at: null, order: 10 }, // gap
        ],
        ai_analysis: {},
        due_date: null,
      };

      const subTasks: Task[] = [
        { id: "new-1", content: "新任務", sub_items: [], ai_analysis: {}, due_date: null },
      ];

      const result = applyConsolidation(parentTask, subTasks, {
        consolidated_title: "整合標題",
        consolidated_narrative: "整合敘述",
        reasoning: "測試",
      });

      // 新項目的 order 應該是 max(0, 5, 10) + 1 = 11
      const newItem = result.updatedSubItems.find(s => s.id === "new-1");
      expect(newItem?.order).toBe(11);
    });
  });
});
