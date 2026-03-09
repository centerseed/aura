/**
 * PlannerSkill — 拆解大目標為任務清單
 *
 * 流程：
 *   1. classify_goal_type()   → product_dev | learning | marketing | admin
 *   2. generate_task_breakdown() → PlannerOutput（LLM generateObject）
 *   3. execute_plan_creation()   → createTask × N + addSubItem × M
 */

import { tool, skill, makeSkillResult } from "naru-agent-js"
import { z } from "zod"
import { google } from "@ai-sdk/google"
import { generateObject } from "ai"
import { prisma } from "@/lib/db"
import { Status } from "@prisma/client"

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const GoalTypeSchema = z.object({
  type: z
    .enum(["product_dev", "learning", "marketing", "admin"])
    .describe("目標類型：product_dev=產品開發, learning=學習研究, marketing=行銷內容, admin=行政事務"),
  rationale: z.string().describe("判斷理由（繁體中文，一句話）"),
})

const TaskItemSchema = z.object({
  title: z.string().describe("任務標題（繁體中文，簡潔明確，≤ 100 字）"),
  rationale: z.string().describe("為何需要此任務（AI 解釋，≤ 200 字）"),
  sub_items: z.array(z.string()).optional().describe("子任務清單（每項 ≤ 80 字）"),
  estimated_days: z.number().optional().describe("預計天數（從今天起算）"),
  priority: z.enum(["P0", "P1", "P2", "P3"]).optional().describe("優先級，預設 P1"),
})

const PlannerOutputSchema = z.object({
  tasks: z.array(TaskItemSchema).min(1).max(10),
  summary: z.string().describe("整體規劃摘要（繁體中文，2-3 句話）"),
})

// ─── Types ────────────────────────────────────────────────────────────────────

type GoalType = "product_dev" | "learning" | "marketing" | "admin"

const STRATEGY_PROMPTS: Record<GoalType, string> = {
  product_dev:
    "拆解策略：user story → technical task → milestone。每個任務代表一個可交付的功能或里程碑。",
  learning:
    "拆解策略：知識點 → 資料源 → 輸出物。包含研究、閱讀、整理筆記、產出成果等步驟。",
  marketing:
    "拆解策略：平台 → 頻率 → 素材準備。包含內容規劃、素材製作、發布排程等步驟。",
  admin:
    "拆解策略：直接列出步驟清單作為 sub_items。每個任務代表一個行政事項，子任務為具體步驟。",
}

// ─── Core Functions ────────────────────────────────────────────────────────────

async function classifyGoalType(goal: string): Promise<GoalType> {
  const { object } = await generateObject({
    model: google("gemini-3.1-flash-lite-preview"),
    schema: GoalTypeSchema,
    prompt: `請判斷以下目標屬於哪種類型：

目標：${goal}

類型定義：
- product_dev：開發產品功能、實作技術、上線、MVP、整合
- learning：研究、學習、閱讀、了解、探索、調查
- marketing：發文、曝光、品牌、社群、內容、行銷
- admin：申辦、繳費、聯絡、安排、會議、行政事務`,
  })
  return object.type
}

async function generateTaskBreakdown(
  goal: string,
  goalType: GoalType,
  productHint?: string,
  dueDate?: string,
  depth: "shallow" | "deep" = "shallow",
): Promise<z.infer<typeof PlannerOutputSchema>> {
  const depthGuide =
    depth === "deep"
      ? "每個任務盡量包含 3-5 個子任務（sub_items），拆解到可直接執行的粒度。"
      : "只拆第一層任務（shallow 模式），sub_items 可選，保持簡潔。"

  const productHintText = productHint ? `\n所屬產品/專案：${productHint}` : ""
  const dueDateText = dueDate ? `\n目標完成日：${dueDate}` : ""

  const { object } = await generateObject({
    model: google("gemini-3.1-flash-lite-preview"),
    schema: PlannerOutputSchema,
    prompt: `你是一個專業的任務規劃師。請將以下大目標拆解為可執行的任務清單。

大目標：${goal}
目標類型：${goalType}${productHintText}${dueDateText}

拆解策略：${STRATEGY_PROMPTS[goalType]}
${depthGuide}

規則：
- 任務數量：3-7 個（不超過 10 個）
- 每個任務標題簡潔明確（繁體中文）
- rationale 說明為何需要此任務
- 如有 estimated_days，從今天起算天數
- priority 預設 P1，P0 只用於最緊急的 1-2 個任務
- summary 用繁體中文說明整體規劃邏輯`,
  })
  return object
}

async function executePlanCreation(
  userId: string,
  output: z.infer<typeof PlannerOutputSchema>,
  productId?: string,
  dueDate?: string,
  productName?: string,
): Promise<Array<{ task_id: string; title: string; product: string; sub_items?: string[] }>> {
  const today = new Date()
  const createdItems: Array<{ task_id: string; title: string; product: string; sub_items?: string[] }> = []

  // 確保任務永遠有有效 Product（避免 schema 要求 product relation 時失敗）
  let resolvedProductId = productId
  let displayProductName = productName

  if (!resolvedProductId) {
    let defaultArea = await prisma.area.findFirst({
      where: { user_id: userId, name: "一般", deleted_at: null },
      select: { id: true },
    })

    if (!defaultArea) {
      defaultArea = await prisma.area.create({
        data: {
          user_id: userId,
          name: "一般",
          scope: "預設任務區",
          is_custom: false,
        },
        select: { id: true },
      })
    }

    let defaultProduct = await prisma.product.findFirst({
      where: { user_id: userId, area_id: defaultArea.id, name: "未分類", deleted_at: null },
      select: { id: true, name: true },
    })

    if (!defaultProduct) {
      defaultProduct = await prisma.product.create({
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
    const resolvedProduct = await prisma.product.findUnique({
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
    const task = await prisma.task.create({
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
        await prisma.subTask.create({
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
}

// ─── Skill Tool ────────────────────────────────────────────────────────────────

const createRunPlannerTool = (userId: string) =>
  tool({
    name: "run_planner",
    description: "將大目標拆解為具體任務並寫入 Zentropy",
    parameters: z.object({
      goal: z.string().describe("大目標描述（自然語言）"),
      product_id: z.string().optional().describe("指定放入哪個 Product（可選）"),
      due_date: z.string().optional().describe("目標完成日（YYYY-MM-DD，可選）"),
      depth: z.enum(["shallow", "deep"]).optional().describe("shallow=只拆第一層（預設）, deep=拆子任務"),
    }),
    execute: async ({ goal, product_id, due_date, depth = "shallow" }) => {
      try {
        // Step 1: 分類目標類型
        const goalType = await classifyGoalType(goal)

        // Step 2: 取得 product hint
        let productHint: string | undefined
        if (product_id) {
          const product = await prisma.product.findUnique({
            where: { id: product_id },
            select: { name: true },
          })
          productHint = product?.name
        }

        // Step 3: 生成任務清單
        const planOutput = await generateTaskBreakdown(goal, goalType, productHint, due_date, depth)

        // Step 4: 建立任務
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
          "提取用戶描述的目標傳入 goal 參數。" +
          "如果用戶有提到特定專案，嘗試從上下文推斷 product_id。" +
          "工具會自動分類、拆解並建立任務，完成後用繁體中文回報結果。",
        extraTools: [createRunPlannerTool(userId)],
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

  if (!params.goal || typeof params.goal !== "string" || params.goal.trim().length === 0) {
    throw new Error("goal is required")
  }

  const goalType = await classifyGoalType(params.goal)

  let productHint: string | undefined
  if (params.product_id) {
    const product = await prisma.product.findUnique({
      where: { id: params.product_id },
      select: { name: true },
    })
    productHint = product?.name
  }

  const planOutput = await generateTaskBreakdown(
    params.goal,
    goalType,
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
