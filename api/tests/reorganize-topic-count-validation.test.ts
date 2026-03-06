/**
 * 測試：Reorganize Topics API - 驗證分類數量約束
 *
 * 核心規則：整理後的分類數量 ≤ 現有數量 + 1
 */

import { describe, it, expect } from "vitest";
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

describe("Reorganize Topics - 分類數量約束驗證", () => {
  const TIMEOUT = 60000;

  it("應該遵守規則：新分類數量 ≤ 現有數量 + 1 (模擬用戶的 Zentropy 產品)", async () => {
    // 模擬用戶的真實情況：
    // - 2 個分類："Zentropy 功能開發與修復"、"Zentropy 應用程式錯誤修復"
    // - 3 個任務，分散在不同分類
    const tasks = [
      {
        id: "task-beta",
        content: "Zentropy Beta 版發版",
        narrative: "",
        current_topic: "Zentropy 功能開發與修復",
        status: "ACTIVE",
        current_due_date: null,
        has_sub_items: false,
        completed_sub_items: [],
        pending_sub_items: [],
      },
      {
        id: "task-mvp",
        content: "Zentropy MVP 功能開發：圖片輸入",
        narrative: "",
        current_topic: "Zentropy 功能開發與修復",
        status: "ACTIVE",
        current_due_date: null,
        has_sub_items: false,
        completed_sub_items: [],
        pending_sub_items: [],
      },
      {
        id: "task-bug",
        content: "修復 Zentropy 應用程式錯誤",
        narrative: "Zentropy 應用程式在將任務標記為已完成時出現異常，需要進行修復。",
        current_topic: "Zentropy 應用程式錯誤修復",
        status: "ACTIVE",
        current_due_date: null,
        has_sub_items: false,
        completed_sub_items: [],
        pending_sub_items: [],
      },
    ];

    const current_topics = ["Zentropy 功能開發與修復", "Zentropy 應用程式錯誤修復"];

    const prompt = buildReorganizePrompt({
      product_name: "Zentropy MVP 功能開發",
      area_name: "工作",
      current_topics,
      tasks,
      milestones: [],
      today: new Date().toISOString(),
    });

    console.log("\n📊 測試情況:");
    console.log(`   現有分類數量: ${current_topics.length} 個`);
    console.log(`   現有分類: ${current_topics.join('、')}`);
    console.log(`   任務數量: ${tasks.length} 個\n`);

    // 呼叫 AI
    const { object: result } = await generateObject({
      model: google("gemini-3.1-flash-lite-preview"),
      schema: ReorganizeProposalSchema,
      prompt,
    });

    console.log("🤖 AI 輸出:");
    console.log(`   建議分類數量: ${result.proposed_clusters.length} 個`);
    console.log(`   建議分類:`);
    result.proposed_clusters.forEach((cluster) => {
      console.log(`     - ${cluster.topic_name} (${cluster.task_ids.length} 個任務)`);
    });

    // 核心驗證：新分類數量 ≤ 現有數量 + 1
    const currentCount = current_topics.length;
    const proposedCount = result.proposed_clusters.length;
    const diff = proposedCount - currentCount;

    console.log(`\n📈 變化分析:`);
    console.log(`   ${currentCount} 個 → ${proposedCount} 個 (${diff > 0 ? '+' : ''}${diff})`);

    if (diff <= 1) {
      if (diff === 0) {
        console.log(`   ✅ 分類數量保持不變`);
      } else if (diff === -1) {
        console.log(`   ✅✅ 減少了 1 個分類 - 優秀！`);
      } else if (diff < -1) {
        console.log(`   ✅✅✅ 減少了 ${-diff} 個分類 - 非常好！`);
      } else {
        console.log(`   ✅ 增加了 1 個分類 - 可接受`);
      }
    } else {
      console.log(`   ❌ 增加了 ${diff} 個分類 - 違反規則！`);
      console.log(`   ⚠️  整理應該讓分類變少或維持，而不是變多`);
    }

    // 斷言：新分類數量必須 ≤ 現有數量 + 1
    expect(
      proposedCount,
      `\n❌ 分類數量約束失敗！\n` +
        `   現有分類: ${currentCount} 個\n` +
        `   建議分類: ${proposedCount} 個 (+${diff})\n` +
        `   規則: 新分類數量 ≤ 現有數量 + 1\n` +
        `   \n` +
        `   AI 創建了太多新分類，違反了「整理 = 簡化」的原則。\n` +
        `   Prompt 需要更強的約束。`
    ).toBeLessThanOrEqual(currentCount + 1);

    console.log(`\n✅ 測試通過：分類數量符合約束\n`);
  }, TIMEOUT);

  it("應該優先合併而不是拆分 (多個測試)", async () => {
    // 測試 3 次，確保 AI 行為一致
    const runs = 3;
    const results = [];

    for (let i = 0; i < runs; i++) {
      const tasks = [
        {
          id: "task-1",
          content: "實作登入功能",
          narrative: "",
          current_topic: "功能開發",
          status: "ACTIVE",
          current_due_date: null,
          has_sub_items: false,
          completed_sub_items: [],
          pending_sub_items: [],
        },
        {
          id: "task-2",
          content: "實作註冊功能",
          narrative: "",
          current_topic: "功能開發",
          status: "ACTIVE",
          current_due_date: null,
          has_sub_items: false,
          completed_sub_items: [],
          pending_sub_items: [],
        },
        {
          id: "task-3",
          content: "修復登入 bug",
          narrative: "",
          current_topic: "Bug 修復",
          status: "ACTIVE",
          current_due_date: null,
          has_sub_items: false,
          completed_sub_items: [],
          pending_sub_items: [],
        },
      ];

      const current_topics = ["功能開發", "Bug 修復"];

      const prompt = buildReorganizePrompt({
        product_name: "測試專案",
        area_name: "工作",
        current_topics,
        tasks,
        milestones: [],
        today: new Date().toISOString(),
      });

      const { object: result } = await generateObject({
        model: google("gemini-3.1-flash-lite-preview"),
        schema: ReorganizeProposalSchema,
        prompt,
      });

      const proposedCount = result.proposed_clusters.length;
      const currentCount = current_topics.length;
      const diff = proposedCount - currentCount;

      results.push({
        run: i + 1,
        currentCount,
        proposedCount,
        diff,
        passed: diff <= 1,
      });

      console.log(`\n🔄 Run ${i + 1}/${runs}:`);
      console.log(`   ${currentCount} 個 → ${proposedCount} 個 (${diff > 0 ? '+' : ''}${diff})`);
      console.log(`   ${diff <= 1 ? '✅ 通過' : '❌ 失敗'}`);
    }

    // 統計
    const passedCount = results.filter((r) => r.passed).length;
    console.log(`\n📊 統計結果: ${passedCount}/${runs} 次通過\n`);

    // 至少 2/3 次應該通過（因為 AI 有隨機性）
    expect(
      passedCount,
      `分類數量約束失敗率過高！${runs} 次測試中只有 ${passedCount} 次通過。\n` +
        `AI 經常違反「新分類數量 ≤ 現有數量 + 1」規則，Prompt 需要改進。`
    ).toBeGreaterThanOrEqual(Math.ceil((runs * 2) / 3));
  }, TIMEOUT * 3);
});
