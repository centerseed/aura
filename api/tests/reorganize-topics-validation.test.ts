/**
 * 測試：Reorganize Topics API - 驗證 AI 不會誤用 sub_item IDs
 *
 * 這個測試專門驗證 AI 是否會錯誤地使用 sub_item IDs (格式: [sub:xxx])
 * 作為 task_consolidations 的 sub_task_ids
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { buildReorganizePrompt } from "../src/lib/reorganize-prompt";

// Schema (與 production 一致)
const ReorganizeProposalSchema = z.object({
  proposed_clusters: z.array(
    z.object({
      topic_name: z.string().describe("Topic 名稱，5-10 字"),
      task_ids: z.array(z.string()),
    })
  ),
  task_consolidations: z
    .array(
      z.object({
        parent_task_id: z.string().describe("選一個語意最完整的 task 當 parent"),
        sub_task_ids: z.array(z.string()).describe("要變成 sub-item 的 task IDs"),
        consolidated_title: z.string().describe("整合後的標題，10-20 字"),
        reasoning: z.string().describe("整合理由，最多 10 字"),
      })
    )
    .optional(),
});


describe("Reorganize Topics - Sub-Item ID 驗證", () => {
  const TIMEOUT = 30000;

  it("AI 不應該使用 sub_item IDs 作為 sub_task_ids", async () => {
    // 準備測試資料：一個有 sub_items 的任務 + 4 個獨立任務
    const tasks = [
      {
        id: "task-parent",
        content: "待辦清單",
        narrative: "雜項事務",
        current_topic: "未分類",
        status: "ACTIVE",
        current_due_date: null,
        has_sub_items: true,
        completed_sub_items: [],
        pending_sub_items: [
          { id: "sub-1", content: "買牛奶" },
          { id: "sub-2", content: "繳電費" },
          { id: "sub-3", content: "打電話給媽媽" },
        ],
      },
      {
        id: "task-1",
        content: "整理房間",
        narrative: "",
        current_topic: "未分類",
        status: "ACTIVE",
        current_due_date: null,
        has_sub_items: false,
        completed_sub_items: [],
        pending_sub_items: [],
      },
      {
        id: "task-2",
        content: "寫報告",
        narrative: "",
        current_topic: "未分類",
        status: "ACTIVE",
        current_due_date: null,
        has_sub_items: false,
        completed_sub_items: [],
        pending_sub_items: [],
      },
      {
        id: "task-3",
        content: "運動",
        narrative: "",
        current_topic: "未分類",
        status: "ACTIVE",
        current_due_date: null,
        has_sub_items: false,
        completed_sub_items: [],
        pending_sub_items: [],
      },
      {
        id: "task-4",
        content: "讀書",
        narrative: "",
        current_topic: "未分類",
        status: "ACTIVE",
        current_due_date: null,
        has_sub_items: false,
        completed_sub_items: [],
        pending_sub_items: [],
      },
    ];

    const prompt = buildReorganizePrompt({
      product_name: "個人事務",
      area_name: "生活",
      current_topics: ["未分類"],
      tasks,
      milestones: [],
      today: new Date().toISOString(),
    });

    // 呼叫 AI
    const { object: result } = await generateObject({
      model: google("gemini-3.1-flash-lite-preview"),
      schema: ReorganizeProposalSchema,
      prompt,
    });

    console.log("AI 輸出:", JSON.stringify(result, null, 2));

    // 驗證：收集所有有效的頂層任務 IDs
    const validTaskIds = new Set(tasks.map((t) => t.id));

    // 驗證所有 proposed_clusters 中的 task_ids
    for (const cluster of result.proposed_clusters) {
      for (const taskId of cluster.task_ids) {
        expect(validTaskIds.has(taskId), `proposed_clusters 包含無效的 task ID: ${taskId}`).toBe(true);
        expect(taskId.startsWith("sub:"), `proposed_clusters 不應包含 sub_item ID: ${taskId}`).toBe(false);
      }
    }

    // 驗證所有 task_consolidations 中的 IDs
    if (result.task_consolidations && result.task_consolidations.length > 0) {
      for (const consolidation of result.task_consolidations) {
        console.log(`\n檢查整合: ${consolidation.consolidated_title}`);
        console.log(`  - parent_task_id: ${consolidation.parent_task_id}`);
        console.log(`  - sub_task_ids: ${consolidation.sub_task_ids.join(", ")}`);

        // 驗證 parent_task_id
        expect(
          validTaskIds.has(consolidation.parent_task_id),
          `parent_task_id 必須是有效的頂層任務 ID，但得到: ${consolidation.parent_task_id}`
        ).toBe(true);
        expect(
          consolidation.parent_task_id.startsWith("sub:"),
          `parent_task_id 不應該是 sub_item ID: ${consolidation.parent_task_id}`
        ).toBe(false);

        // 驗證 sub_task_ids
        for (const subTaskId of consolidation.sub_task_ids) {
          expect(
            validTaskIds.has(subTaskId),
            `❌ sub_task_ids 包含無效的 ID: ${subTaskId}\n` +
              `   有效的任務 IDs: ${Array.from(validTaskIds).join(", ")}\n` +
              `   這可能是 AI 誤用了 sub_item ID (格式: [sub:xxx])`
          ).toBe(true);

          expect(
            subTaskId.startsWith("sub:"),
            `❌ sub_task_ids 不應包含 sub_item ID: ${subTaskId}\n` +
              `   Sub_items 已經是某個任務的子項目，不需要再整合`
          ).toBe(false);
        }

        console.log(`  ✅ 所有 IDs 都是有效的頂層任務`);
      }
    }

    console.log("\n✅ 驗證通過：AI 沒有誤用 sub_item IDs");
  }, TIMEOUT);

  it("AI 應該正確計算整合任務數量", async () => {
    // 如果 AI 說「整合前（4 個獨立任務）」，那麼應該有 4 個不同的頂層任務
    const tasks = [
      {
        id: "task-1",
        content: "任務 1",
        narrative: "",
        current_topic: "未分類",
        status: "ACTIVE",
        current_due_date: null,
        has_sub_items: false,
        completed_sub_items: [],
        pending_sub_items: [],
      },
      {
        id: "task-2",
        content: "任務 2",
        narrative: "",
        current_topic: "未分類",
        status: "ACTIVE",
        current_due_date: null,
        has_sub_items: false,
        completed_sub_items: [],
        pending_sub_items: [],
      },
      {
        id: "task-3",
        content: "任務 3",
        narrative: "",
        current_topic: "未分類",
        status: "ACTIVE",
        current_due_date: null,
        has_sub_items: false,
        completed_sub_items: [],
        pending_sub_items: [],
      },
      {
        id: "task-4",
        content: "任務 4",
        narrative: "",
        current_topic: "未分類",
        status: "ACTIVE",
        current_due_date: null,
        has_sub_items: false,
        completed_sub_items: [],
        pending_sub_items: [],
      },
    ];

    const prompt = buildReorganizePrompt({
      product_name: "測試專案",
      area_name: "工作",
      current_topics: ["未分類"],
      tasks,
      milestones: [],
      today: new Date().toISOString(),
    });

    const { object: result } = await generateObject({
      model: google("gemini-3.1-flash-lite-preview"),
      schema: ReorganizeProposalSchema,
      prompt,
    });

    console.log("AI 輸出:", JSON.stringify(result, null, 2));

    // 如果有整合建議，驗證數量
    if (result.task_consolidations && result.task_consolidations.length > 0) {
      for (const consolidation of result.task_consolidations) {
        const actualCount = 1 + consolidation.sub_task_ids.length; // parent + subs

        console.log(`整合: ${consolidation.consolidated_title}`);
        console.log(`  - parent: ${consolidation.parent_task_id}`);
        console.log(`  - subs: ${consolidation.sub_task_ids.join(", ")}`);
        console.log(`  - 實際任務數量: ${actualCount}`);

        // 實際任務數應該等於 1 (parent) + sub_task_ids.length
        expect(actualCount).toBe(consolidation.sub_task_ids.length + 1);
      }
    }
  }, TIMEOUT);
});
