/**
 * Brain Dump API Route
 *
 * TODO [技術債]: 此文件包含大量業務邏輯 (439 行),應重構至 Use Case
 * 目前為快速統一 API 格式,保留業務邏輯在此處
 * 未來應創建 BrainDumpUseCase 並遵循 Clean Architecture
 */

import { NextRequest } from "next/server";
import { authenticateRequest } from "@/lib/auth-middleware";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { isValidUUID } from "@/domain/constants/validation";
import { ApiResponseBuilder, catchDomainException, ValidationException } from "@/lib/api-response";
import { getEmbedding } from "@/lib/embedding";

// Sub-item 結構
const SubItemSchema = z.object({
  content: z.string().max(100).describe("Sub-item 內容（最多 100 字元）"),
});

// 來源歸因結構 (Source Attribution)
const SourceAttributionSchema = z.object({
  source_type: z.enum(["explicit", "inferred_from_context", "inferred_from_system"])
    .describe("explicit=用戶明說, inferred_from_context=從輸入推斷, inferred_from_system=從系統資料推斷"),
  confidence: z.number().min(0).max(1).describe("信心度 0-1"),
  reasoning: z.string().max(80).describe("簡要說明推斷理由（最多 80 字元）"),
});

// 任務類型（用於時間推斷）
const TaskTypeSchema = z.enum(["waiting", "booking", "preparation", "execution"])
  .describe("waiting=需等待處理(7-14天), booking=需預約(5-7天), preparation=資料準備(3-5天), execution=簡單執行(1-2天)");

// AI 輸出結構
const StructuredItemSchema = z.object({
  title: z.string().max(50).describe("簡潔的任務標題（最多 50 字元）"),
  narrative: z.string().max(100).describe("任務的簡要背景描述（最多 100 字元）"),
  drawer: z.enum(["INBOX", "ACTIVE", "MAINTAIN", "REFERENCE", "ARCHIVE"])
    .describe("Status drawer based on urgency"),
  lifecycle: z.enum(["FINITE", "PERPETUAL"])
    .describe("finite = project with deadline, perpetual = ongoing maintenance"),
  tag: z.object({
    area: z.string().max(30).describe("領域名稱（最多 30 字元）- 必須從既有 Areas 選擇"),
    product: z.string().max(50).describe("專案名稱（最多 50 字元）- 優先使用既有 Product"),
    topic: z.string().max(50).describe("主題名稱（最多 50 字元）- 必須盡量填寫，優先使用既有 Topic 或創建合適的新名稱，只有真正無法歸類時才填空字串"),
  }),
  strategy_used: z.string().max(50).describe("Classification strategy: boundary_match, semantic_anchor, new_structure"),
  reasoning: z.string().max(100).describe("簡短說明分類理由（1 句話，最多 100 字元）"),
  // 時間推斷欄位 - 加入來源歸因
  due_date: z.string().datetime({ offset: true }).optional().describe("推斷的截止日期（ISO 8601 格式）- 只要能推斷出時間就必須填寫"),
  due_date_source: SourceAttributionSchema.optional().describe("時間來源歸因 - 區分 explicit/inferred"),
  inferred_from_milestone: z.string().optional().describe("關聯的 Milestone ID（僅當任務與某里程碑相關時填寫）"),
  task_type: TaskTypeSchema.optional().describe("任務類型 - 用於計算需要提前多少天完成"),
  estimated_days_needed: z.number().min(1).max(30).optional().describe("AI 估算完成此任務需要的天數（包含等待時間）"),
  depends_on_task: z.string().max(50).optional().describe("如果此任務依賴同批次的其他任務，填入該任務的 title"),
  time_confidence: z.number().min(0).max(1).optional().describe("Confidence score for time inference (0-1)"),
  // Sub-items (待辦事項清單)
  sub_items: z.array(SubItemSchema).optional().describe("如果任務包含多個可獨立勾選的步驟/項目，拆成 sub-items - 不可遺漏用戶提到的任何事項"),
});

// 追加 sub-item 的 action
const AppendSubItemActionSchema = z.object({
  action: z.literal("append_sub_item"),
  target_task_id: z.string().describe("要追加到的任務 ID"),
  sub_items: z.array(SubItemSchema).describe("要追加的待辦事項清單"),
  reasoning: z.string().max(100).describe("簡要說明為什麼判斷這是追加而非新任務（1 句話，最多 100 字元）"),
});

// 創建新任務的 action
const CreateNewTasksActionSchema = z.object({
  action: z.literal("create_new_tasks"),
  items: z.array(StructuredItemSchema),
});

// 最終的結果 schema（二選一）
const StructureResultSchema = z.discriminatedUnion("action", [
  AppendSubItemActionSchema,
  CreateNewTasksActionSchema,
]);

// 類型定義
type StructuredItem = z.infer<typeof StructuredItemSchema>;
type Milestone = {
  id: string;
  name: string;
  target_date: Date;
  [key: string]: any;
};

/**
 * 計算任務的截止日期
 *
 * 邏輯優先級：
 * 1. 用戶明確指定的日期 (due_date)
 * 2. 從里程碑推斷（根據 task_type 和 estimated_days_needed 計算）
 * 3. 無法推斷則返回 null
 */
function calculateDueDate(
  item: StructuredItem,
  milestones: Milestone[],
  siblingItems: StructuredItem[]
): { dueDate: Date | null; inferredFromMilestone: string | null; timeConfidence: number | null } {

  // 層級 1: 用戶明確指定的日期
  if (item.due_date) {
    return {
      dueDate: new Date(item.due_date),
      inferredFromMilestone: null,
      timeConfidence: item.time_confidence ?? 1.0,
    };
  }

  // 層級 2: 從里程碑推斷
  if (item.inferred_from_milestone && isValidUUID(item.inferred_from_milestone)) {
    const milestone = milestones.find(m => m.id === item.inferred_from_milestone);

    if (milestone?.target_date) {
      // 基礎天數：使用 AI 估算的天數，或根據 task_type 提供預設值
      let daysBeforeMilestone = item.estimated_days_needed ?? getDefaultDays(item.task_type);

      // 考慮依賴關係：如果依賴其他任務，需要額外加上那個任務的天數
      if (item.depends_on_task) {
        const dependentItem = siblingItems.find(
          si => si.title === item.depends_on_task
        );
        if (dependentItem) {
          const dependentDays = dependentItem.estimated_days_needed ??
            getDefaultDays(dependentItem.task_type);
          daysBeforeMilestone += dependentDays;
        }
      }

      // 複雜度加成：每個 sub_item +0.5 天
      if (item.sub_items && item.sub_items.length > 0) {
        daysBeforeMilestone += Math.ceil(item.sub_items.length * 0.5);
      }

      // 確保不會排到過去（至少留 1 天）
      const now = new Date();
      const daysUntilMilestone = Math.ceil(
        (new Date(milestone.target_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // 如果里程碑已經很近，最多只能提前到明天
      if (daysBeforeMilestone >= daysUntilMilestone) {
        daysBeforeMilestone = Math.max(1, daysUntilMilestone - 1);
      }

      // 計算最終日期
      const dueDate = new Date(milestone.target_date);
      dueDate.setDate(dueDate.getDate() - daysBeforeMilestone);

      // 確保日期至少是明天
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      if (dueDate < tomorrow) {
        dueDate.setTime(tomorrow.getTime());
      }

      console.log(`📅 [calculateDueDate] Task: "${item.title}" -> ${daysBeforeMilestone} days before milestone "${milestone.name}" = ${dueDate.toISOString().split('T')[0]}`);

      return {
        dueDate,
        inferredFromMilestone: milestone.id,
        timeConfidence: item.time_confidence ?? 0.5,
      };
    }
  }

  // 無法推斷
  return {
    dueDate: null,
    inferredFromMilestone: item.inferred_from_milestone && isValidUUID(item.inferred_from_milestone)
      ? item.inferred_from_milestone
      : null,
    timeConfidence: null,
  };
}

/**
 * 根據任務類型返回預設天數
 */
function getDefaultDays(taskType: string | undefined): number {
  switch (taskType) {
    case 'waiting':
      return 10; // 需等待處理：7-14 天，取中間值
    case 'booking':
      return 6;  // 需預約：5-7 天
    case 'preparation':
      return 4;  // 資料準備：3-5 天
    case 'execution':
      return 2;  // 簡單執行：1-2 天
    default:
      return 3;  // 預設 3 天
  }
}

// POST /api/brain-dump
export async function POST(request: NextRequest) {
  return catchDomainException<any>(async () => {
    const timings: Record<string, number> = {};
    const startTotal = Date.now();

    const userId = await authenticateRequest(request, prisma);
    const body = await request.json() as any;
    const { text } = body;

    if (!text) {
      throw new ValidationException("text is required", "text");
    }

    // ============================================================================
    // 階段 0: 解析用戶是否明確指定了 Product (@Product 標記)
    // ============================================================================
    const productMentionRegex = /@(\S+)/g;
    const matches = Array.from(text.matchAll(productMentionRegex));
    const mentionedProductNames = matches.map(m => m[1]);

    let explicitProductId: string | null = null;
    let cleanedText = text;

    if (mentionedProductNames.length > 0) {
      // 用戶明確提到了 Product，嘗試匹配
      const matchedProduct = await prisma.product.findFirst({
        where: {
          user_id: userId,
          deleted_at: null,
          name: { in: mentionedProductNames, mode: 'insensitive' }
        }
      });

      if (matchedProduct) {
        explicitProductId = matchedProduct.id;
        // 移除 @Product 標記，保留實際內容
        cleanedText = text.replace(productMentionRegex, '').trim();
        console.log(`🎯 [brain-dump] User explicitly mentioned Product: ${matchedProduct.name}`);
      }
    }

    // ============================================================================
    // 🚀 極致優化：只有 2 個 DB round-trips（1 讀 + 1 寫）
    // ============================================================================
    const startDbParallel = Date.now();
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 90);

    // Step 1: 計算 embedding（CPU 操作，不占用 DB 連線）
    let userEmbedding: number[] | null = null;
    let embeddingTime = 0;

    if (!explicitProductId) {
      const t1 = Date.now();
      userEmbedding = await getEmbedding(cleanedText);
      embeddingTime = Date.now() - t1;
    }
    timings["embedding_search"] = embeddingTime;

    // Step 2: 🚀 單一 SQL 查詢：pgvector + Areas + Products + Topics + Tasks + Milestones
    // 這個巨型 SQL 把所有讀取操作合併成 1 個 round-trip
    const vectorStr = userEmbedding ? `[${userEmbedding.join(",")}]` : null;

    type CombinedResult = {
      data_type: string;
      // Area/Product/Task 欄位
      area_id: string | null;
      area_name: string | null;
      area_scope: string | null;
      product_id: string | null;
      product_name: string | null;
      product_similarity: number | null;
      topic_id: string | null;
      topic_name: string | null;
      task_id: string | null;
      task_content: string | null;
      task_status: string | null;
      task_sub_items: any;
      task_updated_at: Date | null;
      // Milestone 欄位
      milestone_id: string | null;
      milestone_name: string | null;
      milestone_description: string | null;
      milestone_target_date: Date | null;
      milestone_status: string | null;
    };

    const combinedResults = await prisma.$queryRaw<CombinedResult[]>`
      WITH
      -- 1. 用 pgvector 找相關 Products（如果有 embedding）
      relevant_products AS (
        SELECT
          id,
          name,
          ${vectorStr ? Prisma.sql`1 - (embedding <=> ${vectorStr}::vector)` : Prisma.sql`1.0`} as similarity
        FROM products
        WHERE user_id = ${userId}::uuid
          AND deleted_at IS NULL
          ${explicitProductId
            ? Prisma.sql`AND id = ${explicitProductId}::uuid`
            : vectorStr
              ? Prisma.sql`AND embedding IS NOT NULL ORDER BY embedding <=> ${vectorStr}::vector LIMIT 5`
              : Prisma.sql`LIMIT 10`
          }
      ),
      -- 2. 排名任務
      ranked_tasks AS (
        SELECT
          t.*,
          ROW_NUMBER() OVER (PARTITION BY t.product_id ORDER BY t.updated_at DESC) as row_num
        FROM tasks t
        WHERE t.deleted_at IS NULL
          AND t.status != 'ARCHIVE'
          AND t.user_id = ${userId}::uuid
      ),
      -- 3. 主數據查詢
      main_data AS (
        SELECT
          'main'::text as data_type,
          a.id::text as area_id,
          a.name as area_name,
          a.scope as area_scope,
          p.id::text as product_id,
          p.name as product_name,
          rp.similarity as product_similarity,
          top.id::text as topic_id,
          top.name as topic_name,
          rt.id::text as task_id,
          rt.content as task_content,
          rt.status::text as task_status,
          rt.sub_items as task_sub_items,
          rt.updated_at as task_updated_at,
          NULL::text as milestone_id,
          NULL::text as milestone_name,
          NULL::text as milestone_description,
          NULL::timestamp as milestone_target_date,
          NULL::text as milestone_status
        FROM areas a
        LEFT JOIN products p ON p.area_id = a.id AND p.deleted_at IS NULL
        LEFT JOIN relevant_products rp ON rp.id = p.id
        LEFT JOIN topics top ON top.product_id = p.id AND top.deleted_at IS NULL
        LEFT JOIN ranked_tasks rt ON rt.product_id = p.id AND rt.row_num <= 5
        WHERE a.user_id = ${userId}::uuid
          AND a.deleted_at IS NULL
          AND (rp.id IS NOT NULL OR p.id IS NULL)
      ),
      -- 4. Milestones 查詢
      milestone_data AS (
        SELECT
          'milestone'::text as data_type,
          NULL::text as area_id,
          NULL::text as area_name,
          NULL::text as area_scope,
          NULL::text as product_id,
          NULL::text as product_name,
          NULL::float8 as product_similarity,
          NULL::text as topic_id,
          NULL::text as topic_name,
          NULL::text as task_id,
          NULL::text as task_content,
          NULL::text as task_status,
          NULL::json as task_sub_items,
          NULL::timestamp as task_updated_at,
          id::text as milestone_id,
          name as milestone_name,
          description as milestone_description,
          target_date as milestone_target_date,
          status::text as milestone_status
        FROM milestones
        WHERE user_id = ${userId}::uuid
          AND deleted_at IS NULL
          AND target_date >= ${now}
          AND target_date <= ${futureDate}
          AND status IN ('planned', 'in_progress')
      )
      SELECT * FROM main_data
      UNION ALL
      SELECT * FROM milestone_data
      ORDER BY data_type DESC, product_similarity DESC NULLS LAST, area_name, product_name
    `;

    // 解析合併結果
    const rawStructure: Array<{
      area_id: string;
      area_name: string;
      area_scope: string | null;
      product_id: string | null;
      product_name: string | null;
      topic_id: string | null;
      topic_name: string | null;
      task_id: string | null;
      task_content: string | null;
      task_status: string | null;
      task_sub_items: any;
      task_updated_at: Date | null;
      task_row_num: number | null;
    }> = [];

    const milestones: Milestone[] = [];
    const relevantProducts: Array<{ id: string; name: string; similarity: number }> = [];
    const seenProducts = new Set<string>();

    for (const row of combinedResults) {
      if (row.data_type === 'main' && row.area_id) {
        rawStructure.push({
          area_id: row.area_id,
          area_name: row.area_name!,
          area_scope: row.area_scope,
          product_id: row.product_id,
          product_name: row.product_name,
          topic_id: row.topic_id,
          topic_name: row.topic_name,
          task_id: row.task_id,
          task_content: row.task_content,
          task_status: row.task_status,
          task_sub_items: row.task_sub_items,
          task_updated_at: row.task_updated_at,
          task_row_num: null,
        });
        // 收集相關 Products（去重）
        if (row.product_id && row.product_similarity && !seenProducts.has(row.product_id)) {
          seenProducts.add(row.product_id);
          relevantProducts.push({
            id: row.product_id,
            name: row.product_name!,
            similarity: row.product_similarity,
          });
        }
      } else if (row.data_type === 'milestone' && row.milestone_id) {
        milestones.push({
          id: row.milestone_id,
          name: row.milestone_name!,
          description: row.milestone_description,
          target_date: row.milestone_target_date!,
        } as Milestone);
      }
    }

    // Log 相關 Products
    if (relevantProducts.length > 0 && !explicitProductId) {
      console.log(
        `🔍 [brain-dump] Found ${relevantProducts.length} relevant Products (${embeddingTime}ms embedding):`,
        relevantProducts.map(r => `${r.name} (${(r.similarity * 100).toFixed(0)}%)`).join(", ")
      );
    }

    // 重建嵌套結構（從扁平 SQL 結果轉換）
    const areaMap = new Map<string, {
      id: string;
      name: string;
      scope: string | null;
      products: Map<string, {
        id: string;
        name: string;
        topics: Array<{ id: string; name: string }>;
        tasks: Array<{ id: string; content: string; status: string; sub_items: any; updated_at: Date }>;
      }>;
    }>();

    for (const row of rawStructure) {
      // 確保 Area 存在
      if (!areaMap.has(row.area_id)) {
        areaMap.set(row.area_id, {
          id: row.area_id,
          name: row.area_name,
          scope: row.area_scope,
          products: new Map(),
        });
      }
      const area = areaMap.get(row.area_id)!;

      // 如果有 Product
      if (row.product_id && row.product_name) {
        if (!area.products.has(row.product_id)) {
          area.products.set(row.product_id, {
            id: row.product_id,
            name: row.product_name,
            topics: [],
            tasks: [],
          });
        }
        const product = area.products.get(row.product_id)!;

        // 添加 Topic（去重）
        if (row.topic_id && row.topic_name) {
          if (!product.topics.some(t => t.id === row.topic_id)) {
            product.topics.push({ id: row.topic_id, name: row.topic_name });
          }
        }

        // 添加 Task（去重，只保留前 2 個 sub_items）
        if (row.task_id && row.task_content) {
          if (!product.tasks.some(t => t.id === row.task_id)) {
            const rawSubItems = (row.task_sub_items || []) as Array<any>;
            product.tasks.push({
              id: row.task_id,
              content: row.task_content,
              status: row.task_status || 'INBOX',
              sub_items: rawSubItems.slice(0, 2), // 只取前 2 個 sub_items
              updated_at: row.task_updated_at || new Date(),
            });
          }
        }
      }
    }

    // 轉換為原本的格式
    const existingAreas = Array.from(areaMap.values()).map(area => ({
      ...area,
      products: Array.from(area.products.values()),
    }));

    timings["db_parallel"] = Date.now() - startDbParallel;

    // ============================================================================
    // 階段 3: 動態預算分配（最多 100 個項目 = tasks + sub_items）
    // ============================================================================
    const MAX_CONTEXT_ITEMS = 100; // tasks + sub_items 總數上限

    // 統計 Products 總數
    const totalProducts = existingAreas.reduce((sum, area) => sum + area.products.length, 0);

    // 動態計算每個 Product 的配額
    // 優先級：Product > Task > SubItem
    let tasksPerProduct = 1;
    let subItemsPerTask = 1;

    if (totalProducts > 0) {
      // 先分配 tasks（每個 Product 至少 1 個，最多 5 個）
      tasksPerProduct = Math.max(1, Math.min(5, Math.floor(MAX_CONTEXT_ITEMS / totalProducts)));
      const totalTaskBudget = totalProducts * tasksPerProduct;

      // 剩餘預算分配給 sub_items（每個 task 最多 2 個）
      const remainingBudget = MAX_CONTEXT_ITEMS - totalTaskBudget;
      subItemsPerTask = Math.max(0, Math.min(2, Math.floor(remainingBudget / totalTaskBudget)));
    }

    console.log(`📊 [brain-dump] Dynamic budget: ${totalProducts} Products × ${tasksPerProduct} tasks × ${subItemsPerTask} sub_items = ~${totalProducts * tasksPerProduct * (1 + subItemsPerTask)} items`);

    // 構建上下文摘要（所有 Products 及其任務）
    let contextSummary = "";
    if (existingAreas.length > 0) {
      const hasProducts = existingAreas.some(a => a.products.length > 0);

      if (hasProducts) {
        contextSummary = "\n### 用戶的 Products 與任務:\n\n";
      } else {
        contextSummary = "\n### 用戶尚無任何專案\n";
      }

      for (const area of existingAreas) {
        if (area.products.length === 0) continue;

        contextSummary += `\n**Area: ${area.name}** (範圍: ${area.scope || "未定義"})\n`;

        for (const product of area.products) {
          contextSummary += `  📦 Product: ${product.name}\n`;

          // 顯示 Topics
          if (product.topics.length > 0) {
            contextSummary += `     Topics: ${product.topics.map(t => t.name).join(", ")}\n`;
          }

          // 顯示未完成任務（動態限制數量）
          const limitedTasks = (product.tasks || []).slice(0, tasksPerProduct);
          if (limitedTasks.length > 0) {
            contextSummary += `     未完成任務 (可追加 sub-item 的候選):\n`;
            for (const task of limitedTasks) {
              const updatedAgo = Math.floor((Date.now() - new Date(task.updated_at).getTime()) / 60000);
              const timeDisplay = updatedAgo < 60
                ? `${updatedAgo} 分鐘前更新`
                : updatedAgo < 1440
                  ? `${Math.floor(updatedAgo / 60)} 小時前更新`
                  : `${Math.floor(updatedAgo / 1440)} 天前更新`;

              contextSummary += `       - [${task.id}] ${task.content}\n`;
              contextSummary += `         ⏰ ${timeDisplay} | 狀態: ${task.status}\n`;

              // 顯示 sub-items（動態限制數量）
              if (task.sub_items && subItemsPerTask > 0) {
                const subItems = task.sub_items as Array<{
                  id: string;
                  content: string;
                  completed: boolean;
                }>;
                const limitedSubItems = subItems.slice(0, subItemsPerTask);
                if (limitedSubItems.length > 0) {
                  contextSummary += `         已有的待辦項目:\n`;
                  for (const subItem of limitedSubItems) {
                    const checkbox = subItem.completed ? '✅' : '☐';
                    contextSummary += `           ${checkbox} ${subItem.content}\n`;
                  }
                }
              }
            }
          } else {
            contextSummary += `     未完成任務: (無，這是新專案)\n`;
          }
        }
      }
      contextSummary += "\n";
    }

    // 添加 Milestone 資訊到上下文
    if (milestones.length > 0) {
      contextSummary += "\n### 用戶設定的里程碑（未來 90 天）:\n";
      contextSummary += `今天日期：${now.toLocaleDateString("zh-TW")} (星期${['日', '一', '二', '三', '四', '五', '六'][now.getDay()]})\n\n`;

      for (const milestone of milestones) {
        const targetDate = new Date(milestone.target_date);
        const daysUntil = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        contextSummary += `🎯 **${milestone.name}** [ID: ${milestone.id}]\n`;
        contextSummary += `   - 目標日期：${targetDate.toLocaleDateString("zh-TW")} (${daysUntil} 天後)\n`;
        if (milestone.description) {
          contextSummary += `   - 描述：${milestone.description}\n`;
        }
        contextSummary += "\n";
      }
    }

    // 調用 AI 進行結構化
    const startAI = Date.now();
    const { object: result } = await generateObject({
      model: google("gemini-2.5-flash-lite"),
      schema: StructureResultSchema,
      prompt: `你是任務記錄專家。將用戶輸入轉成結構化的 Task。

# 🔥 最優先判斷：是追加還是新任務？

## 核心判斷原則：因果關係測試

**唯一判斷標準**：問自己這個問題——

> 「完成【用戶輸入】是否是達成【既有任務】的必要手段？」

- 如果答案是「是」→ 追加
- 如果答案是「否」或「不確定」→ 新任務

### 因果關係測試範例

| 用戶輸入 | 既有任務 | 測試問題 | 答案 | 結果 |
|---------|---------|---------|------|------|
| 買菜 | 準備晚餐 | 「買菜」是達成「準備晚餐」的手段嗎？ | ✅ 是 | 追加 |
| 發郵件 | 週報：整理資料、發郵件 | 「發郵件」是達成「週報」的手段嗎？ | ✅ 是 | 追加 |
| 封存專案 | 封版與測試 | 「封存專案」是達成「封版與測試」的手段嗎？ | ❌ 否 | 新任務 |
| 修 bug | 開發新功能 | 「修 bug」是達成「開發新功能」的手段嗎？ | ❌ 否 | 新任務 |
| 優化效能 | 修復登入問題 | 「優化效能」是達成「修復登入問題」的手段嗎？ | ❌ 否 | 新任務 |

### 追加的必要條件（全部滿足才追加）

1. **因果關係成立**：輸入是既有任務的「達成手段」
2. **粒度更細**：輸入的範圍比既有任務更小、更具體
3. **同一目標**：輸入和既有任務服務於同一個最終目標

### 常見誤判情況（這些都是新任務）

- 「語意相關」≠「是子步驟」（封存 vs 封版，都有「封」字但無因果關係）
- 「同一專案」≠「是子步驟」（同一個 Product 下的兩件不同的事）
- 「時間相近」≠「是子步驟」（今天要做的兩件獨立的事）

### 判斷流程

\`\`\`
1. 找出最相關的既有任務
2. 執行因果關係測試：「完成 X 是達成 Y 的手段嗎？」
3. 如果測試失敗 → 創建新任務
4. 如果測試通過 → 再確認粒度是否更細
5. 兩個都通過 → 追加
\`\`\`

**預設行為**：有任何疑慮，創建新任務。追加是例外，不是常態。

**如果符合追加條件**：
→ 回傳 \`action: "append_sub_item"\`，指定 \`target_task_id\` 和新的 \`sub_items\`

**如果是新任務**：
→ 繼續往下，按照原有規則創建新任務

---

${explicitProductId ? `# 🚨 用戶明確指定了 Product

用戶在輸入中使用了 @Product 標記，系統已識別並**強制鎖定**到該專案。

**絕對規則**：
- 只能追加到該 Product 下的任務
- 創建新任務時，必須使用該 Product
- 不可將任務歸類到其他 Product，即使語意上更相似
- 這是用戶的明確指令，優先級最高

系統已自動篩選，你看到的任務列表**只包含該 Product 的任務**。

---

` : ''}
# 核心原則（創建新任務時使用）

## 1. 完整記錄
問自己：**「把輸出念給用戶聽，用戶會說『你漏了 X』嗎？」**
- 會 → 你漏了東西，補上
- 不會 → OK

所有細節都要保留：
- 用戶提到的每個事項 → 放入 sub_items 或 narrative
- 用戶提到的條件/前提 → 放入 narrative
- 用戶提到的人名/專案名 → 保留原文

## 2. Sub-items 拆分
問自己：**「用戶說的這些事，可以分別勾掉嗎？」**
- 可以分別勾掉 → 拆成 sub_items
- 不能分別勾掉 → 放在 narrative

**🚨 禁止只有 1 個 sub-item**
- 如果只有一件事，那就是任務本身，不需要 sub-item
- sub_items 至少要有 2 個，否則留空不要拆

## 3. Area 選擇（🚨 絕對禁止創建新 Area）
**規則：只能從既有 Areas 中選擇，絕對不能創建新的 Area**

問自己：**「這個任務屬於哪個既有的 Area？」**
- 查看上下文中列出的所有 Areas
- 選擇最相關的既有 Area
- 如果不確定，選擇最通用的那個 Area
- **絕對禁止**填入不存在的 Area 名稱

## 4. Product 選擇
問自己：**「這個新任務和哪個 Product 的現有任務最像？」**
- 看每個 Product 下的「最近任務」
- 選擇任務類型最相似的 Product
- 可以在既有 Area 下創建新 Product（如果沒有匹配的）

## 5. Topic 選擇（🔥 必須盡量填寫）

**規則：Topic 是任務分類的重要維度，必須積極分配**

問自己三個問題：

1. **這個任務和哪個既有 Topic 最相關？**
   - 查看該 Product 下所有既有的 Topics
   - 如果任務內容與某個 Topic 語意相關 → 使用該 Topic
   - 例：任務「修復登入頁面 bug」，Product 下有 Topic「技術維護」→ 使用「技術維護」

2. **如果沒有相關的既有 Topic，應該創建什麼？**
   - 根據任務性質創建合理的 Topic 名稱
   - 好的 Topic 命名：「技術開發」「客戶溝通」「財務處理」「行銷活動」「產品規劃」
   - 避免太籠統的命名：「其他」「雜項」「一般」

3. **什麼情況可以留空？**
   - **只有當任務真的無法歸類時**才填 ""
   - 這應該是極少數情況（< 10%）

**Topic 命名原則：**
- 使用 2-4 字的中文名詞短語
- 描述任務的「類型」或「面向」，不是具體內容
- 範例：「內部協調」「外部溝通」「系統維護」「資料分析」「流程優化」

## 4. 時間推斷

**規則：只要你能推斷出時間，就必須填 due_date**

- 用戶說「今天」「明天」「週五」「1/30」→ 填 due_date
- 從上下文推斷出時間（如「週報通常週五發」）→ 填 due_date
- 任務與里程碑相關 → 填 due_date + inferred_from_milestone + task_type + estimated_days_needed

due_date 格式：ISO 8601，如 2026-02-07T00:00:00+08:00

**task_type**（當任務與里程碑相關時填寫）：
- waiting：需等待結果
- booking：需預約
- preparation：需準備
- execution：可立即執行

## 5. Drawer 狀態（與 due_date 連動）
- **有填 due_date → 必須是 ACTIVE**（有明確期限，需要追蹤進度）
- **沒有 due_date → 必須是 INBOX**（還沒決定什麼時候做）
- **例行性/週期性任務 → MAINTAIN**（穩定運作中，異常時才需關注）

---

# 背景資訊

今天：${now.toLocaleDateString("zh-TW")} (星期${['日', '一', '二', '三', '四', '五', '六'][now.getDay()]})

${contextSummary}

---

# 用戶輸入

${text}

---

# 輸出格式與長度限制（嚴格遵守）

**字元數限制：**
- title：≤ 50 字元（動詞 + 目標，去掉冗詞）
- narrative：≤ 100 字元（任務背景描述，精簡重點）
- reasoning：≤ 100 字元（1 句話說明分類依據）
- due_date_source.reasoning：≤ 80 字元（1 句話說明時間推斷，使用 due_date_source 結構）
- sub_item.content：≤ 100 字元（簡短的待辦事項）
- tag.area/product/topic：≤ 30/50/50 字元

**格式要求：**
- 使用繁體中文
- due_date：ISO 8601 格式（例：2026-01-30T00:00:00+08:00）
- tag.topic：字串，**必須盡量填寫**（優先使用既有 Topic，或創建合適的新名稱）

**寫作原則：**
- 精簡優先：每個字都要有意義
- reasoning 範例：「提到專案名稱，判斷為工作相關」
- narrative 範例：「整理本週功能，準備週報給主管」（≤ 100 字）
- 如果用戶提供了大量細節，提煉最重要的資訊`,
    });
    timings["ai_generateObject"] = Date.now() - startAI;

    // ============================================================================
    // 根據 AI 判斷的 action 執行不同邏輯
    // ============================================================================

    const startDbPersist = Date.now();

    // 情況 1: 追加 sub-item 到既有任務
    if (result.action === "append_sub_item") {
      // 驗證 target_task_id
      const targetTask = await prisma.task.findFirst({
        where: {
          id: result.target_task_id,
          deleted_at: null,
          product: { user_id: userId },
        },
        include: {
          product: true,
        },
      });

      if (!targetTask) {
        throw new ValidationException(
          `Target task ${result.target_task_id} not found`,
          "target_task_id"
        );
      }

      // 獲取現有的 sub-items
      const existingSubItems = (targetTask.sub_items as Array<{
        id: string;
        content: string;
        completed: boolean;
        created_at: string;
        completed_at: string | null;
        order: number;
      }>) || [];

      // 創建新的 sub-items
      const now = new Date().toISOString();
      const newSubItems = result.sub_items.map((sub, idx) => ({
        id: crypto.randomUUID(),
        content: sub.content,
        completed: false,
        created_at: now,
        completed_at: null,
        order: existingSubItems.length + idx,
      }));

      // 更新任務
      const updatedSubItems = [...existingSubItems, ...newSubItems];
      await prisma.task.update({
        where: { id: result.target_task_id },
        data: {
          sub_items: updatedSubItems as any,
          updated_at: new Date(),
        },
      });

      // 記錄評估 Log
      await prisma.systemEvaluationLog.create({
        data: {
          user_id: userId,
          type: "BRAIN_DUMP",
          input_content: { text },
          output_content: {
            action: "append_sub_item",
            target_task_id: result.target_task_id,
            sub_items: result.sub_items,
            reasoning: result.reasoning,
          },
          user_action: "APPLIED",
          metadata: {
            appended_sub_items_count: newSubItems.length,
          },
        },
      });

      timings["db_persist"] = Date.now() - startDbPersist;
      timings["total"] = Date.now() - startTotal;
      console.log("⏱️ [brain-dump] Timings:", JSON.stringify(timings, null, 2));

      return ApiResponseBuilder.success({
        action: "append_sub_item",
        target_task: {
          id: targetTask.id,
          content: targetTask.content,
          product: targetTask.product.name,
        },
        appended_sub_items: newSubItems,
        reasoning: result.reasoning,
      }, {});
    }

    // 情況 2: 創建新任務（原有邏輯）
    // 建立快取 Map，避免重複查詢同樣的 Area/Product/Topic
    const areaCache = new Map<string, { id: string }>();
    const productCache = new Map<string, { id: string }>();
    const topicCache = new Map<string, { id: string }>();

    // 預先填充快取（使用已載入的 existingAreas）
    for (const area of existingAreas) {
      areaCache.set(area.name, { id: area.id });
      for (const product of area.products) {
        productCache.set(`${area.name}::${product.name}`, { id: product.id });
        for (const topic of product.topics) {
          topicCache.set(`${product.id}::${topic.name}`, { id: topic.id });
        }
      }
    }

    // 🚀 優化：批次檢查重複任務（1 個查詢取代 N 個）
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const allTitles = result.items.map(item => item.title);
    const existingTasks = await prisma.task.findMany({
      where: {
        user_id: userId,
        content: { in: allTitles },
        deleted_at: null,
        created_at: { gte: twentyFourHoursAgo },
      },
      select: { content: true },
    });
    const existingTitleSet = new Set(existingTasks.map(t => t.content));

    // 🚀 使用 Transaction 批次處理，減少 DB round-trips
    const createdTasks = await prisma.$transaction(async (tx) => {
      const tasks: Array<{
        id: string;
        title: string;
        narrative: string;
        drawer: string;
        lifecycle: string;
        tag: { area: string; product: string; topic: string };
        strategy_used: string;
        reasoning: string;
        due_date: string | null;
        time_confidence: number | null;
        due_date_source: any;
        inferred_from_milestone: string | null;
        task_type: string | null;
        estimated_days_needed: number | null;
      }> = [];

      for (const item of result.items) {
        // 0. 防重複檢查（使用預載入的 Set）
        if (existingTitleSet.has(item.title)) {
          console.warn(`⚠️ [brain-dump] Duplicate task detected, skipping: "${item.title}"`);
          continue; // 跳過重複任務
        }

        // 1. 確保 Area 存在（🚨 絕對禁止自動創建 Area）
        let areaId: string;
        const cachedArea = areaCache.get(item.tag.area);
        if (cachedArea) {
          areaId = cachedArea.id;
        } else {
          // Area 不存在 - 嘗試模糊匹配（忽略大小寫）
          const existingAreaNames = Array.from(areaCache.keys());
          const fuzzyMatch = existingAreaNames.find(
            name => name.toLowerCase() === item.tag.area.toLowerCase()
          );

          if (fuzzyMatch) {
            areaId = areaCache.get(fuzzyMatch)!.id;
            console.log(`🔄 [brain-dump] Area fuzzy match: "${item.tag.area}" → "${fuzzyMatch}"`);
          } else {
            // 完全沒有匹配 - 拋出錯誤，禁止創建新 Area
            const availableAreas = existingAreaNames.join(", ") || "(無)";
            console.error(`🚨 [brain-dump] AI attempted to create non-existent Area: "${item.tag.area}". Available: ${availableAreas}`);
            throw new ValidationException(
              `Area "${item.tag.area}" 不存在。Brain Dump 不允許自動創建 Area，請先手動創建或選擇既有的 Area: [${availableAreas}]`,
              "tag.area"
            );
          }
        }

        // 2. 確保 Product 存在（優先使用快取，避免重複查詢）
        let productId: string;
        const productKey = `${item.tag.area}::${item.tag.product}`;
        const cachedProduct = productCache.get(productKey);
        if (cachedProduct) {
          productId = cachedProduct.id;
        } else {
          const product = await tx.product.create({
            data: {
              user_id: userId,
              area_id: areaId,
              name: item.tag.product,
              status: item.drawer as any,
              lifecycle: item.lifecycle as any,
            },
          });
          productId = product.id;
          productCache.set(productKey, { id: product.id });
        }

        // 3. 確保 Topic 存在（優先使用快取，只在有名稱時創建）
        let topicId: string | null = null;
        if (item.tag.topic && item.tag.topic.trim() !== "") {
          const topicKey = `${productId}::${item.tag.topic}`;
          const cachedTopic = topicCache.get(topicKey);
          if (cachedTopic) {
            topicId = cachedTopic.id;
          } else {
            const topic = await tx.topic.create({
              data: {
                user_id: userId,
                product_id: productId,
                name: item.tag.topic,
              },
            });
            topicId = topic.id;
            topicCache.set(topicKey, { id: topic.id });
          }
        }

        // 4. 創建 Task
        const aiAnalysis: any = {
          raw_input: text, // 保留原始輸入用於審計
          narrative: item.narrative,
          lifecycle: item.lifecycle,
          strategy_used: item.strategy_used,
          reasoning: item.reasoning,
        };

        // 時間推斷相關欄位（含來源歸因）
        if (item.due_date_source) {
          aiAnalysis.due_date_source = item.due_date_source;
        }

        // 處理 sub_items (待辦事項清單) - 準備寫入 task.sub_items
        let taskSubItems: Array<{
          id: string;
          content: string;
          completed: boolean;
          created_at: string;
          completed_at: string | null;
          order: number;
        }> = [];
        if (item.sub_items && item.sub_items.length > 0) {
          const now = new Date().toISOString();
          taskSubItems = item.sub_items.map((sub, idx) => ({
            id: crypto.randomUUID(),
            content: sub.content,
            completed: false,
            created_at: now,
            completed_at: null,
            order: idx,
          }));
        }

        // 計算截止日期（使用智能推斷邏輯）
        const { dueDate, inferredFromMilestone, timeConfidence } = calculateDueDate(
          item,
          milestones,
          result.items // 同批次的其他任務，用於處理依賴關係
        );

        const task = await tx.task.create({
          data: {
            user_id: userId,
            product_id: productId,
            topic_id: topicId,
            content: item.title,
            status: item.drawer as any,
            due_date: dueDate,
            inferred_from_milestone: inferredFromMilestone,
            time_confidence: timeConfidence,
            sub_items: taskSubItems as any, // Json 類型需要 type assertion
            ai_analysis: aiAnalysis,
          },
        });

        // 格式化日期用於回傳
        const formattedDueDate = dueDate ? dueDate.toISOString() : null;

        tasks.push({
          id: task.id,
          title: item.title,
          narrative: item.narrative,
          drawer: item.drawer,
          lifecycle: item.lifecycle,
          tag: {
            area: item.tag.area,
            product: item.tag.product,
            topic: item.tag.topic,
          },
          strategy_used: item.strategy_used,
          reasoning: item.reasoning,
          // 時間推斷資訊
          due_date: formattedDueDate,
          time_confidence: timeConfidence,
          due_date_source: item.due_date_source || null,
          inferred_from_milestone: inferredFromMilestone,
          // 新增：AI 推斷的原始數據（用於 debug）
          task_type: item.task_type || null,
          estimated_days_needed: item.estimated_days_needed || null,
        });
      }

      // 記錄評估 Log（在同一 transaction 內）
      await tx.systemEvaluationLog.create({
        data: {
          user_id: userId,
          type: "BRAIN_DUMP",
          input_content: { text },
          output_content: { action: "create_new_tasks", items: result.items },
          user_action: "APPLIED",
          metadata: {
            created_tasks_count: tasks.length,
          },
        },
      });

      return tasks;
    });
    timings["db_persist"] = Date.now() - startDbPersist;
    timings["total"] = Date.now() - startTotal;
    console.log("⏱️ [brain-dump] Timings:", JSON.stringify(timings, null, 2));

    return ApiResponseBuilder.success({
      action: "create_new_tasks",
      items: createdTasks,
    }, {});
  });
}
