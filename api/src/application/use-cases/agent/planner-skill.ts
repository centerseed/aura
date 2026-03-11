/**
 * PlannerSkill — 拆解大目標為任務清單
 *
 * 流程：
 *   1. generate_task_breakdown() → PlannerOutput（LLM generateObject）
 *   2. execute_plan_creation()   → createTask × N + addSubItem × M
 */

import { tool, skill, makeSkillResult } from "naru-agent-js"
import { z } from "zod"
import { google } from "@ai-sdk/google"
import { resilientGenerateObject } from "@/lib/ai-resilient"
import { prisma } from "@/lib/db"
import { Status } from "@prisma/client"

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const PlannerTaskModelSchema = z.object({
  title: z.string().describe("任務標題（繁體中文，簡潔明確，≤ 100 字）"),
  rationale: z.string().optional().describe("為何需要此任務（AI 解釋，≤ 200 字）"),
  sub_items: z.array(z.string()).optional().describe("子任務清單（每項 ≤ 80 字）"),
  estimated_days: z.number().optional().describe("預計天數（從今天起算）"),
  priority: z.enum(["P0", "P1", "P2", "P3"]).optional().describe("優先級，預設 P1"),
})

const PlannerModelOutputSchema = z.object({
  tasks: z.array(PlannerTaskModelSchema).min(1).max(10),
  summary: z.string().optional().describe("整體規劃摘要（繁體中文，2-3 句話）"),
})

const PlannerTaskSchema = z.object({
  title: z.string(),
  rationale: z.string(),
  sub_items: z.array(z.string()).optional(),
  estimated_days: z.number().optional(),
  priority: z.enum(["P0", "P1", "P2", "P3"]).optional(),
})

const PlannerOutputSchema = z.object({
  tasks: z.array(PlannerTaskSchema).min(1).max(10),
  summary: z.string(),
})

type PlannerOutput = z.infer<typeof PlannerOutputSchema>

function sanitizeGoalText(goal: string): string {
  return goal.trim().replace(/\s+/g, " ")
}

export function normalizePlanningGoalFromMessage(message: string): string {
  const text = sanitizeGoalText(message)
  if (!text) return ""

  const stripped = text
    .replace(/^(?:請|可以|能不能|麻煩)?\s*(?:幫我|替我)?\s*(?:規劃|拆解|展開)\s*/u, "")
    .replace(/^(?:規劃|拆解|展開)\s*/u, "")
    .trim()

  const normalized = stripped || text
  if (normalized === "undefined") return ""
  return normalized
}

function normalizePlannerOutput(
  goal: string,
  raw: z.infer<typeof PlannerModelOutputSchema>,
): PlannerOutput {
  const tasks = raw.tasks
    .map((task) => ({
      title: task.title.trim().slice(0, 100),
      rationale: task.rationale?.trim() || `此任務直接支援「${goal}」的達成。`,
      sub_items: task.sub_items
        ?.map((item) => item.trim().slice(0, 80))
        .filter((item) => item.length > 0)
        .slice(0, 8),
      estimated_days: task.estimated_days,
      priority: task.priority ?? "P1",
    }))
    .filter((task) => task.title.length > 0)
    .slice(0, 10)

  if (tasks.length === 0) {
    throw new Error("planner returned no usable tasks")
  }

  return {
    tasks,
    summary: raw.summary?.trim() || `這份規劃聚焦於「${goal}」的主要執行步驟。`,
  }
}

// ─── Core Functions ────────────────────────────────────────────────────────────

async function generateTaskBreakdown(
  goal: string,
  productHint?: string,
  dueDate?: string,
  depth: "shallow" | "deep" = "shallow",
): Promise<z.infer<typeof PlannerOutputSchema>> {
  const normalizedGoal = sanitizeGoalText(goal)
  if (!normalizedGoal || normalizedGoal === "undefined") {
    throw new Error("目標描述不能為空。請告訴我你想規劃什麼？")
  }

  const depthGuide =
    depth === "deep"
      ? "每個任務盡量包含 3-5 個子任務（sub_items），拆解到可直接執行的粒度。"
      : "只拆第一層任務（shallow 模式），sub_items 可選，保持簡潔。"

  const productHintText = productHint ? `\n所屬產品/專案：${productHint}` : ""
  const dueDateText = dueDate ? `\n目標完成日：${dueDate}` : ""

  const plannerPrompt = `你是一個專業的任務規劃師。請將以下大目標拆解為可執行的任務清單。

大目標：${normalizedGoal}${productHintText}${dueDateText}

${depthGuide}

🚨 最重要規則 — 忠於用戶目標：
- 每個任務都必須直接服務於用戶描述的「大目標」
- 禁止產生與目標無關的通用項目管理任務（例如：用戶說「準備轉職」，不能產生「建立 KPI 追蹤表」「設定每週回顧」等無關任務）
- 禁止幻覺：不要假設用戶沒說的需求

拆解原則：
- 從用戶的目標出發，思考「要達成這個目標，實際上需要做哪些事？」
- 任務應該是具體可執行的行動，不是抽象的管理流程
- 任務數量：3-7 個（不超過 10 個）
- 每個任務標題簡潔明確（繁體中文）
- rationale 說明為何需要此任務
- 如有 estimated_days，從今天起算天數
- priority 預設 P1，P0 只用於最緊急的 1-2 個任務
- summary 用繁體中文說明整體規劃邏輯`

  const { object } = await resilientGenerateObject({
    model: google("gemini-2.5-flash-lite"),
    schema: PlannerModelOutputSchema,
    prompt: plannerPrompt,
  })
  return normalizePlannerOutput(normalizedGoal, object)
}

async function executePlanCreation(
  userId: string,
  output: z.infer<typeof PlannerOutputSchema>,
  productId?: string,
  dueDate?: string,
  productName?: string,
): Promise<Array<{ task_id: string; title: string; product: string; sub_items?: string[] }>> {
  // P1 safety: 整個建立流程包在 $transaction 中，失敗時整體 rollback，不留半套資料
  return prisma.$transaction(async (tx) => {
    const today = new Date()
    const createdItems: Array<{ task_id: string; title: string; product: string; sub_items?: string[] }> = []

    // 確保任務永遠有有效 Product（避免 schema 要求 product relation 時失敗）
    let resolvedProductId = productId
    let displayProductName = productName

    if (!resolvedProductId) {
      let defaultArea = await tx.area.findFirst({
        where: { user_id: userId, name: "一般", deleted_at: null },
        select: { id: true },
      })

      if (!defaultArea) {
        defaultArea = await tx.area.create({
          data: {
            user_id: userId,
            name: "一般",
            scope: "預設任務區",
            is_custom: false,
          },
          select: { id: true },
        })
      }

      let defaultProduct = await tx.product.findFirst({
        where: { user_id: userId, area_id: defaultArea.id, name: "未分類", deleted_at: null },
        select: { id: true, name: true },
      })

      if (!defaultProduct) {
        defaultProduct = await tx.product.create({
          data: {
            user_id: userId,
            area_id: defaultArea.id,
            name: "未分類",
            status: Status.ACTIVE,
            lifecycle: "FINITE",
          },
          select: { id: true, name: true },
        })
      }

      resolvedProductId = defaultProduct.id
      displayProductName = defaultProduct.name
    }

    if (!displayProductName) {
      const resolvedProduct = await tx.product.findUnique({
        where: { id: resolvedProductId },
        select: { name: true },
      })
      displayProductName = resolvedProduct?.name ?? "未分類"
    }

    for (const taskItem of output.tasks) {
      // 計算 due_date
      let taskDueDate: string | undefined = dueDate
      if (!taskDueDate && taskItem.estimated_days) {
        const d = new Date(today)
        d.setDate(d.getDate() + taskItem.estimated_days)
        taskDueDate = d.toISOString().split("T")[0]
      }

      // 建立 narrative（包含 rationale + priority）
      const narrative = `${taskItem.rationale}${taskItem.priority ? ` [${taskItem.priority}]` : ""}`

      // 建立任務
      const task = await tx.task.create({
        data: {
          content: taskItem.title,
          user_id: userId,
          status: Status.ACTIVE,
          product_id: resolvedProductId,
          due_date: taskDueDate ? new Date(taskDueDate) : null,
          ai_analysis: { narrative: narrative.slice(0, 500) },
        },
      })

      const createdSubItems: string[] = []

      // 建立子任務
      if (taskItem.sub_items && taskItem.sub_items.length > 0) {
        for (const subContent of taskItem.sub_items) {
          await tx.subTask.create({
            data: {
              content: subContent.slice(0, 200),
              task_id: task.id,
              user_id: userId,
              completed: false,
            },
          })
          createdSubItems.push(subContent)
        }
      }

      createdItems.push({
        task_id: task.id,
        title: task.content,
        product: displayProductName,
        sub_items: createdSubItems.length > 0 ? createdSubItems : undefined,
      })
    }

    return createdItems
  })
}

// ─── Skill Tool ────────────────────────────────────────────────────────────────

export const createRunPlannerTool = (userId: string, originalMessage?: string) =>
  tool({
    name: "run_planner",
    description: "將大目標拆解為具體任務並寫入 Zentropy",
    parameters: originalMessage
      ? z.object({
          product_id: z.string().optional().describe("指定放入哪個 Product（可選）"),
          due_date: z.string().optional().describe("目標完成日（YYYY-MM-DD，可選）"),
          depth: z.enum(["shallow", "deep"]).optional().describe("shallow=只拆第一層（預設）, deep=拆子任務"),
        })
      : z.object({
          goal: z.string().describe("大目標描述（自然語言）"),
          product_id: z.string().optional().describe("指定放入哪個 Product（可選）"),
          due_date: z.string().optional().describe("目標完成日（YYYY-MM-DD，可選）"),
          depth: z.enum(["shallow", "deep"]).optional().describe("shallow=只拆第一層（預設）, deep=拆子任務"),
        }),
    execute: async (rawParams) => {
      try {
        const params = rawParams as {
          goal?: string
          product_id?: string
          due_date?: string
          depth?: "shallow" | "deep"
        }
        const goal = originalMessage
          ? normalizePlanningGoalFromMessage(originalMessage)
          : sanitizeGoalText(params.goal ?? "")
        const product_id = params.product_id
        const due_date = params.due_date
        const depth = params.depth ?? "shallow"

        // Step 1: 取得 product hint
        let productHint: string | undefined
        if (product_id) {
          const product = await prisma.product.findUnique({
            where: { id: product_id },
            select: { name: true },
          })
          productHint = product?.name
        }

        // Step 2: 生成任務清單
        const planOutput = await generateTaskBreakdown(goal, productHint, due_date, depth)

        // Step 3: 建立任務
        const createdItems = await executePlanCreation(userId, planOutput, product_id, due_date, productHint)

        const lines = createdItems.map((item, i) => {
          const subLine =
            item.sub_items && item.sub_items.length > 0
              ? `\n   子任務：${item.sub_items.map((s) => `・${s}`).join("、")}`
              : ""
          return `${i + 1}. ${item.title} [${item.product}]${subLine}`
        })

        return (
          `✅ 規劃完成！共建立 ${createdItems.length} 個任務：\n\n${lines.join("\n")}\n\n` +
          `📝 規劃說明：${planOutput.summary}`
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return `❌ 規劃失敗：${msg}`
      }
    },
  })

// ─── Export: Skill（LINE Bot 用）──────────────────────────────────────────────

export const createPlannerSkill = (userId: string) =>
  skill({
    name: "planner",
    description: "拆解大目標為任務清單",
    triggers: ["規劃", "拆解", "計畫", "planner", "幫我規劃", "展開", "怎麼做", "怎麼拆", "任務計畫"],
    priority: 6,
    run: async (_message, _context) =>
      makeSkillResult({
        promptInjection:
          "用戶想要規劃一個大目標並拆解為任務。請使用 run_planner 工具，" +
          "直接使用用戶原句作為規劃輸入，不要自行改寫或省略目標。" +
          "工具會自動分類、拆解並建立任務，完成後用繁體中文回報結果。",
        extraTools: [createRunPlannerTool(userId, _message)],
        skillName: "planner",
      }),
  })

// ─── Export: MCP Handler（server.ts 用）───────────────────────────────────────

export interface RunPlannerInput {
  goal: string
  product_id?: string
  due_date?: string
  depth?: "shallow" | "deep"
}

export async function handleRunPlanner(
  _apiClient: unknown,
  authContext: { userId: string },
  input: Record<string, unknown>,
  _sanitized: boolean,
): Promise<{
  tasks_created: number
  items: Array<{ task_id: string; title: string; product: string; sub_items?: string[] }>
  summary: string
}> {
  const params = input as unknown as RunPlannerInput
  const goal = sanitizeGoalText(params.goal ?? "")

  if (!goal || goal === "undefined") {
    throw new Error("goal is required")
  }

  let productHint: string | undefined
  if (params.product_id) {
    const product = await prisma.product.findUnique({
      where: { id: params.product_id },
      select: { name: true },
    })
    productHint = product?.name
  }

  const planOutput = await generateTaskBreakdown(
    goal,
    productHint,
    params.due_date,
    params.depth ?? "shallow",
  )

  const items = await executePlanCreation(
    authContext.userId,
    planOutput,
    params.product_id,
    params.due_date,
    productHint,
  )

  return {
    tasks_created: items.length,
    items,
    summary: planOutput.summary,
  }
}

// ─── Backwards-compat export（zentropy-agent.ts import plannerSkill）──────────
// zentropy-agent.ts 目前 import 的是 plannerSkill（舊 stub），
// 保留一個相容匯出以避免修改 agent 時影響太多
export const plannerSkill = createPlannerSkill
