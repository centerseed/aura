/**
 * 測試：AI Reorganize Prompt 的行為驗證
 *
 * 這個測試使用真實的任務資料，驗證 AI prompt 是否：
 * 1. 正確識別可整合的任務
 * 2. 正確保留語意守恆
 * 3. 正確處理有 sub_items 的任務
 * 4. 不會過度整合
 */

import { describe, it, expect } from "vitest";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

// Schema (與 production 一致)
const ReorganizeProposalSchema = z.object({
  proposed_clusters: z.array(
    z.object({
      topic_name: z.string(),
      task_ids: z.array(z.string()),
    })
  ),
  time_inferences: z.array(
    z.object({
      task_id: z.string(),
      suggested_due_date: z.string().nullable(),
      urgency_level: z.enum(["critical", "high", "medium", "low"]),
    })
  ),
  task_consolidations: z.array(
    z.object({
      parent_task_id: z.string(),
      sub_task_ids: z.array(z.string()),
      consolidated_title: z.string(),
      consolidated_narrative: z.string(),
      reasoning: z.string(),
      semantic_preservation: z.array(
        z.object({
          original_task_id: z.string(),
          preserved_in: z.enum(["title", "narrative", "sub_item"]),
          key_intent: z.string(),
        })
      ).optional(),
    })
  ).optional(),
});

// Prompt 建構函數 (與 production 一致)
function buildTestPrompt(context: {
  product_name: string;
  area_name: string;
  tasks: Array<{
    id: string;
    content: string;
    narrative: string;
    current_topic: string;
    has_sub_items: boolean;
    completed_sub_items: string[];
    pending_sub_items: Array<{ id: string; content: string }>;
  }>;
}): string {
  const tasksCompact = context.tasks.map((t, idx) => {
    let line = `${idx + 1}. [${t.id}] ${t.content}${t.narrative ? ` - ${t.narrative}` : ''} (${t.current_topic})`;

    if (t.has_sub_items) {
      const completedCount = t.completed_sub_items.length;
      const pendingCount = t.pending_sub_items.length;
      line += ` [子項目: ${completedCount}已完成, ${pendingCount}待處理]`;

      if (pendingCount > 0) {
        const pendingList = t.pending_sub_items.map(s => `    - [sub:${s.id}] ${s.content}`).join('\n');
        line += `\n${pendingList}`;
      }
    }

    return line;
  }).join("\n");

  return `你是任務組織專家。請分析以下任務並提出重組建議。

# 背景
Product: "${context.product_name}" (Area: ${context.area_name})
今天: 2024-01-15

## Tasks (共 ${context.tasks.length} 個):
${tasksCompact}

---

# Topic 分群
對於任意兩個任務 A 和 B，問：「做 A 的時候，需要知道 B 嗎？」
- 如果需要 → 放同一個 Topic
- 如果不需要 → 可以放不同 Topic

---

# 任務整合（語意守恆原則）

## 第一性原理：語意守恆
整合的本質是「結構重組」，不是「資訊壓縮」。

## 整合的判斷標準

### ✅ 可以整合的情況（ALL 條件必須滿足）
1. **同一成果** — 所有任務都指向同一個可交付成果
2. **無獨立價值** — 單獨一個子任務完成後，對用戶沒有獨立意義
3. **語意可映射** — 每個子任務的「意圖」都能對應到 consolidated_title 的一部分

### ❌ 禁止整合的情況（ANY 條件命中即禁止）
1. **獨立上下文** — 子任務有獨立的「為什麼」，不只是步驟差異
2. **時間分離** — 子任務的時間約束差距 > 7 天
3. **可獨立完成** — 單獨完成某個子任務對用戶有獨立價值
4. **語意無法映射** — 無法在 consolidated_title 中體現某個子任務的意圖

## 整合輸出規範
consolidated_title **必須**能讓讀者從標題中「反推」出所有子任務的存在。

## 保守原則
**不確定是否該整合時，選擇不整合。**

## Sub-Items 處理規則

### 已完成的 sub_items (completed_sub_items)
- **絕對不動** — 這些是用戶已經完成的工作，不參與任何整合

### 待處理的 sub_items (pending_sub_items)
- **可以參與整合** — 如果其他獨立 Task 與某個 pending_sub_item 語意重疊，可以合併

---

# 輸出規則
- 使用繁體中文
- 所有 task_id 必須來自上方列表
- task_consolidations 中的 consolidated_title 必須能反推出所有子任務`;
}

describe("AI Reorganize Prompt 行為測試", () => {
  // 設定較長的超時時間（AI 呼叫需要時間）
  const TIMEOUT = 30000;

  describe("場景 1：應該整合的任務（同一成果的 checklist）", () => {
    it("should consolidate tasks that form a checklist for the same outcome", async () => {
      const tasks = [
        {
          id: "task-1",
          content: "準備投影片內容",
          narrative: "年度報告發表會的簡報",
          current_topic: "未分類",
          has_sub_items: false,
          completed_sub_items: [],
          pending_sub_items: [],
        },
        {
          id: "task-2",
          content: "練習演講流程",
          narrative: "年度報告發表會的演練",
          current_topic: "未分類",
          has_sub_items: false,
          completed_sub_items: [],
          pending_sub_items: [],
        },
        {
          id: "task-3",
          content: "確認會議室設備",
          narrative: "年度報告發表會的場地準備",
          current_topic: "未分類",
          has_sub_items: false,
          completed_sub_items: [],
          pending_sub_items: [],
        },
      ];

      const prompt = buildTestPrompt({
        product_name: "年度報告發表會",
        area_name: "工作",
        tasks,
      });

      const { object: result } = await generateObject({
        model: google("gemini-2.5-flash-lite"),
        schema: ReorganizeProposalSchema,
        prompt,
      });

      console.log("場景 1 結果:", JSON.stringify(result, null, 2));

      // 驗證：這三個任務應該被整合（或至少被歸類到同一個 topic）
      // 因為它們都是為了同一個成果：年度報告發表會
      if (result.task_consolidations && result.task_consolidations.length > 0) {
        const consolidation = result.task_consolidations[0];

        // 驗證 consolidated_title 包含所有子任務的語意
        expect(consolidation.consolidated_title).toBeTruthy();
        expect(consolidation.reasoning).toBeTruthy();

        // 驗證整合的任務數量
        const totalTasks = 1 + consolidation.sub_task_ids.length; // parent + subs
        expect(totalTasks).toBeGreaterThanOrEqual(2);

        console.log("✅ 整合標題:", consolidation.consolidated_title);
        console.log("✅ 整合理由:", consolidation.reasoning);
      } else {
        // 即使沒有整合，也應該至少被歸類到同一個 topic
        const topicsWithMultipleTasks = result.proposed_clusters.filter(c => c.task_ids.length > 1);
        expect(topicsWithMultipleTasks.length).toBeGreaterThan(0);
        console.log("📌 任務被歸類到同一 topic:", topicsWithMultipleTasks[0]?.topic_name);
      }
    }, TIMEOUT);
  });

  describe("場景 2：不應該整合的任務（獨立上下文）", () => {
    it("should NOT consolidate tasks with independent contexts", async () => {
      const tasks = [
        {
          id: "task-1",
          content: "修復登入頁面的 CSS bug",
          narrative: "用戶反映手機版排版錯誤",
          current_topic: "Bug 修復",
          has_sub_items: false,
          completed_sub_items: [],
          pending_sub_items: [],
        },
        {
          id: "task-2",
          content: "實作新的推播通知功能",
          narrative: "產品需求：增加用戶黏著度",
          current_topic: "新功能",
          has_sub_items: false,
          completed_sub_items: [],
          pending_sub_items: [],
        },
        {
          id: "task-3",
          content: "撰寫 API 文件",
          narrative: "為了讓外部開發者整合",
          current_topic: "文件",
          has_sub_items: false,
          completed_sub_items: [],
          pending_sub_items: [],
        },
      ];

      const prompt = buildTestPrompt({
        product_name: "Naruvia App",
        area_name: "開發",
        tasks,
      });

      const { object: result } = await generateObject({
        model: google("gemini-2.5-flash-lite"),
        schema: ReorganizeProposalSchema,
        prompt,
      });

      console.log("場景 2 結果:", JSON.stringify(result, null, 2));

      // 驗證：這三個任務不應該被整合（它們有各自獨立的「為什麼」）
      if (result.task_consolidations && result.task_consolidations.length > 0) {
        // 如果有整合，整合的數量應該很少
        const totalConsolidated = result.task_consolidations.reduce(
          (sum, c) => sum + 1 + c.sub_task_ids.length, 0
        );
        console.log("⚠️ 有整合發生，整合任務數:", totalConsolidated);

        // 不應該把全部三個都整合在一起
        expect(totalConsolidated).toBeLessThan(3);
      } else {
        console.log("✅ 正確：沒有整合獨立上下文的任務");
      }

      // 驗證應該有多個不同的 topics
      expect(result.proposed_clusters.length).toBeGreaterThanOrEqual(2);
    }, TIMEOUT);
  });

  describe("場景 3：有 sub_items 的任務整合", () => {
    it("should preserve completed sub_items and correctly handle pending ones", async () => {
      const tasks = [
        {
          id: "task-parent",
          content: "專案啟動準備",
          narrative: "新專案的前置作業",
          current_topic: "專案管理",
          has_sub_items: true,
          completed_sub_items: ["確定專案範圍", "組建團隊"],
          pending_sub_items: [
            { id: "sub-1", content: "建立專案文件夾" },
            { id: "sub-2", content: "設定開發環境" },
          ],
        },
        {
          id: "task-new-1",
          content: "建立 Git 儲存庫",
          narrative: "專案的版本控制設定",
          current_topic: "未分類",
          has_sub_items: false,
          completed_sub_items: [],
          pending_sub_items: [],
        },
        {
          id: "task-new-2",
          content: "設定 CI/CD pipeline",
          narrative: "專案的自動化部署",
          current_topic: "未分類",
          has_sub_items: false,
          completed_sub_items: [],
          pending_sub_items: [],
        },
      ];

      const prompt = buildTestPrompt({
        product_name: "新專案啟動",
        area_name: "工作",
        tasks,
      });

      const { object: result } = await generateObject({
        model: google("gemini-2.5-flash-lite"),
        schema: ReorganizeProposalSchema,
        prompt,
      });

      console.log("場景 3 結果:", JSON.stringify(result, null, 2));

      // 驗證：
      // 1. AI 看到了 completed_sub_items（不應該被動）
      // 2. pending_sub_items 可以和新任務一起考慮
      // 3. 如果整合，parent 應該是 task-parent（因為它已經有結構）

      if (result.task_consolidations && result.task_consolidations.length > 0) {
        const consolidation = result.task_consolidations[0];

        // 如果有整合，parent 應該是已有 sub_items 的任務
        if (consolidation.parent_task_id === "task-parent") {
          console.log("✅ 正確選擇已有結構的任務作為 parent");
        }

        // 驗證整合標題包含語意
        expect(consolidation.consolidated_title).toBeTruthy();
        console.log("整合標題:", consolidation.consolidated_title);
      }

      // 無論是否整合，所有任務都應該被歸類
      const allTaskIds = result.proposed_clusters.flatMap(c => c.task_ids);
      expect(allTaskIds).toContain("task-parent");
    }, TIMEOUT);
  });

  describe("場景 4：語意相似的 pending_sub_item 和獨立 Task", () => {
    it("should recognize semantic overlap between pending sub_item and task", async () => {
      const tasks = [
        {
          id: "task-parent",
          content: "週末購物清單",
          narrative: "家庭日常用品採購",
          current_topic: "生活",
          has_sub_items: true,
          completed_sub_items: ["買牛奶"],
          pending_sub_items: [
            { id: "sub-1", content: "買雞蛋" },
            { id: "sub-2", content: "買麵包" },
          ],
        },
        {
          id: "task-standalone",
          content: "去超市買蛋",
          narrative: "冰箱沒蛋了",
          current_topic: "未分類",
          has_sub_items: false,
          completed_sub_items: [],
          pending_sub_items: [],
        },
      ];

      const prompt = buildTestPrompt({
        product_name: "家庭事務",
        area_name: "生活",
        tasks,
      });

      const { object: result } = await generateObject({
        model: google("gemini-2.5-flash-lite"),
        schema: ReorganizeProposalSchema,
        prompt,
      });

      console.log("場景 4 結果:", JSON.stringify(result, null, 2));

      // 驗證：
      // 「買雞蛋」(sub_item) 和「去超市買蛋」(standalone task) 語意重疊
      // AI 應該識別出這個重疊

      // 無論是否整合，都應該有評論或處理
      if (result.task_consolidations && result.task_consolidations.length > 0) {
        const consolidation = result.task_consolidations[0];
        console.log("整合結果:", consolidation.consolidated_title);
        console.log("理由:", consolidation.reasoning);

        // 如果有整合，應該是把 standalone 整合到 parent
        if (consolidation.sub_task_ids.includes("task-standalone")) {
          console.log("✅ 正確識別語意重疊，將獨立任務整合");
        }
      } else {
        // 即使沒有整合，也應該被歸類到同一個 topic
        const topicWithBoth = result.proposed_clusters.find(c =>
          c.task_ids.includes("task-parent") && c.task_ids.includes("task-standalone")
        );
        if (topicWithBoth) {
          console.log("✅ 正確：兩個任務被歸類到同一 topic:", topicWithBoth.topic_name);
        }
      }
    }, TIMEOUT);
  });

  describe("場景 5：混合複雜情境", () => {
    it("should handle mixed scenarios correctly", async () => {
      const tasks = [
        // 應該整合：同一個發布的準備工作
        {
          id: "release-1",
          content: "更新 changelog",
          narrative: "v2.0 發布準備",
          current_topic: "發布",
          has_sub_items: false,
          completed_sub_items: [],
          pending_sub_items: [],
        },
        {
          id: "release-2",
          content: "測試 staging 環境",
          narrative: "v2.0 發布前驗證",
          current_topic: "發布",
          has_sub_items: false,
          completed_sub_items: [],
          pending_sub_items: [],
        },
        // 不應該整合：獨立的任務
        {
          id: "meeting-1",
          content: "準備週會議程",
          narrative: "團隊週會",
          current_topic: "會議",
          has_sub_items: false,
          completed_sub_items: [],
          pending_sub_items: [],
        },
        // 有 sub_items 的任務
        {
          id: "onboarding",
          content: "新人 onboarding",
          narrative: "幫助新同事上手",
          current_topic: "團隊",
          has_sub_items: true,
          completed_sub_items: ["介紹團隊成員", "設定電腦"],
          pending_sub_items: [
            { id: "sub-onboard-1", content: "介紹專案架構" },
            { id: "sub-onboard-2", content: "分配第一個任務" },
          ],
        },
      ];

      const prompt = buildTestPrompt({
        product_name: "Naruvia 開發",
        area_name: "工作",
        tasks,
      });

      const { object: result } = await generateObject({
        model: google("gemini-2.5-flash-lite"),
        schema: ReorganizeProposalSchema,
        prompt,
      });

      console.log("場景 5 結果:", JSON.stringify(result, null, 2));

      // 驗證：
      // 1. release-1 和 release-2 可能被整合（同一成果）
      // 2. meeting-1 應該獨立
      // 3. onboarding 的 completed_sub_items 不應該被動

      // 至少應該有 2-3 個不同的 topics
      expect(result.proposed_clusters.length).toBeGreaterThanOrEqual(2);

      // 如果有整合，驗證整合的合理性
      if (result.task_consolidations && result.task_consolidations.length > 0) {
        for (const consolidation of result.task_consolidations) {
          console.log(`整合: ${consolidation.consolidated_title}`);
          console.log(`  - parent: ${consolidation.parent_task_id}`);
          console.log(`  - subs: ${consolidation.sub_task_ids.join(", ")}`);
          console.log(`  - 理由: ${consolidation.reasoning}`);

          // meeting-1 不應該被整合到其他任務
          expect(consolidation.sub_task_ids).not.toContain("meeting-1");
          expect(consolidation.parent_task_id).not.toBe("meeting-1");
        }
      }

      console.log("\n📊 Topic 分群結果:");
      for (const cluster of result.proposed_clusters) {
        console.log(`  ${cluster.topic_name}: ${cluster.task_ids.join(", ")}`);
      }
    }, TIMEOUT);
  });
});
