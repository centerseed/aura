/**
 * PlannerSkill — 拆解大目標為任務清單
 *
 * 流程：
 *   1. generate_task_breakdown() → PlannerOutput（LLM generateObject）
 *   2. execute_plan_creation()   → createTask × N + addSubItem × M
 */

import { tool, skill, makeSkillResult } from "@centerseedwu/naru-agent"
import { z } from "zod"
import { google } from "@ai-sdk/google"
import { resilientGenerateObject } from "@/lib/ai-resilient"
import { prisma } from "@/lib/db"
import { Status } from "@prisma/client"
import { logAgentLlmCall, normalizeAiSdkUsage } from "./llm-logging"

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const PlannerTaskModelSchema = z.object({
  title: z.string().describe("任務標題（繁體中文，簡潔明確，≤ 100 字）"),
  rationale: z.string().optional().describe("為何需要此任務（AI 解釋，≤ 200 字）"),
  sub_items: z.array(z.string()).optional().describe("子任務清單（每項 ≤ 80 字）"),
  estimated_days: z.number().optional().describe("預估工期天數（此任務自身所需時間）"),
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
const DEFAULT_PLANNER_DURATION_DAYS = 1
const GENERIC_PLANNER_PRODUCT_NAMES = new Set(["待整理", "未分類", "一般"])
const GENERIC_PLANNER_AREA_NAMES = new Set(["收件匣", "一般"])

const PlannerPlacementDecisionSchema = z.object({
  area_id: z.string().describe("從既有結構中選出的 area id"),
  product_id: z.string().describe("從既有結構中選出的 product id"),
  reasoning: z.string().describe("為何選擇這個既有 project（繁體中文）"),
})

type ExistingPlannerArea = {
  id: string
  name: string
  scope: string | null
  products: Array<{
    id: string
    name: string
  }>
}

function formatDateOnly(date: Date): string {
  return date.toLocaleDateString("en-CA")
}

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

export function buildPlannerDueDates(
  tasks: Array<Pick<z.infer<typeof PlannerTaskSchema>, "estimated_days">>,
  dueDate?: string,
  baseDate: Date = new Date(),
): Array<string | undefined> {
  if (dueDate) {
    return tasks.map(() => dueDate)
  }

  const cursor = new Date(baseDate)
  cursor.setHours(0, 0, 0, 0)

  return tasks.map((task) => {
    const durationDays = Math.max(
      DEFAULT_PLANNER_DURATION_DAYS,
      Math.floor(task.estimated_days ?? DEFAULT_PLANNER_DURATION_DAYS),
    )
    cursor.setDate(cursor.getDate() + durationDays)
    return formatDateOnly(cursor)
  })
}

type PlannerPlacement = {
  areaId: string
  areaName: string
  productId: string
  productName: string
  displayProductName: string
}

type PlannerCreationResult = {
  placement: PlannerPlacement
  items: Array<{ task_id: string; title: string; product: string; sub_items?: string[] }>
}

function normalizePlannerProductNameForDisplay(productName: string): string {
  return GENERIC_PLANNER_PRODUCT_NAMES.has(productName) ? "待整理" : productName
}

export function formatPlannerPlacementPath(placement: Pick<PlannerPlacement, "areaName" | "displayProductName" | "productName" | "productId">): string {
  const productLabel = placement.displayProductName || placement.productName || placement.productId
  return placement.areaName ? `${placement.areaName} / ${productLabel}` : productLabel
}

export function buildPlannerPlacementNotice(placement: Pick<PlannerPlacement, "areaName" | "displayProductName" | "productName" | "productId">): string {
  const path = formatPlannerPlacementPath(placement)
  return `📍選到的 Area / Project：${path}\n🧠 Brain dump 落點：${path}`
}

export function pickPlannerFallbackProduct(areas: ExistingPlannerArea[]): PlannerPlacement {
  for (const area of areas) {
    const genericProduct = area.products.find((product) => GENERIC_PLANNER_PRODUCT_NAMES.has(product.name))
    if (genericProduct) {
      return {
        areaId: area.id,
        areaName: area.name,
        productId: genericProduct.id,
        productName: genericProduct.name,
        displayProductName: normalizePlannerProductNameForDisplay(genericProduct.name),
      }
    }
  }

  for (const area of areas) {
    if (GENERIC_PLANNER_AREA_NAMES.has(area.name) && area.products[0]) {
      return {
        areaId: area.id,
        areaName: area.name,
        productId: area.products[0].id,
        productName: area.products[0].name,
        displayProductName: normalizePlannerProductNameForDisplay(area.products[0].name),
      }
    }
  }

  const firstProduct = areas.flatMap((area) =>
    area.products.map((product) => ({ area, product })),
  )[0]

  if (!firstProduct) {
    throw new Error("目前沒有可用的 Project 可承接這份規劃，請先建立至少一個 Project。")
  }

  return {
    areaId: firstProduct.area.id,
    areaName: firstProduct.area.name,
    productId: firstProduct.product.id,
    productName: firstProduct.product.name,
    displayProductName: normalizePlannerProductNameForDisplay(firstProduct.product.name),
  }
}

async function classifyPlannerPlacement(
  goal: string,
  areas: ExistingPlannerArea[],
): Promise<PlannerPlacement> {
  if (areas.length === 0 || areas.every((area) => area.products.length === 0)) {
    throw new Error("目前沒有可用的 Project 可承接這份規劃，請先建立至少一個 Project。")
  }

  const context = areas
    .map((area) => {
      const scopeLine = area.scope ? `（範圍：${area.scope}）` : ""
      const products = area.products.map((product) => `  - ${product.name} [${product.id}]`).join("\n")
      return `Area: ${area.name} [${area.id}] ${scopeLine}\n${products}`
    })
    .join("\n\n")

  const startedAt = Date.now()
  const { object, usage } = await resilientGenerateObject({
    model: google("gemini-2.5-flash-lite"),
    schema: PlannerPlacementDecisionSchema,
    prompt: `你是 Zentropy 的規劃分類助手。你的工作只有一件事：根據用戶目標，從既有的 Area / Project 結構中選出**最適合承接這份規劃**的既有 Project。

目標：
${goal}

現有結構：
${context}

規則：
- 只能選擇上面已存在的 area_id / product_id
- 禁止建議新建 Area
- 禁止建議新建 Product
- 優先選擇語意最接近、未來也能持續承接相關任務的 Project
- 若多個都可接受，選最不令人意外的一個

請回傳最適合的 area_id、product_id 與 reasoning。`,
  })

  logAgentLlmCall({
    event: "agent_llm_call",
    feature: "planner_select_placement",
    latencyMs: Date.now() - startedAt,
    usage: normalizeAiSdkUsage(usage),
    model: "gemini-2.5-flash-lite",
    metadata: {
      goalLen: goal.length,
      areaCount: areas.length,
      productCount: areas.reduce((sum, area) => sum + area.products.length, 0),
    },
  })

  const matchedArea = areas.find((area) => area.id === object.area_id)
  const matchedProduct = matchedArea?.products.find((product) => product.id === object.product_id)

  if (!matchedArea || !matchedProduct) {
    return pickPlannerFallbackProduct(areas)
  }

  return {
    areaId: matchedArea.id,
    areaName: matchedArea.name,
    productId: matchedProduct.id,
    productName: matchedProduct.name,
    displayProductName: normalizePlannerProductNameForDisplay(matchedProduct.name),
  }
}

export async function resolvePlannerPlacement(
  tx: {
    area: {
      findMany: typeof prisma.area.findMany
    }
    product: {
      findUnique: typeof prisma.product.findUnique
    }
  },
  userId: string,
  goal: string,
  productId?: string,
  productName?: string,
): Promise<PlannerPlacement> {
  if (!productId) {
    const areas = await tx.area.findMany({
      where: { user_id: userId, deleted_at: null },
      orderBy: [{ display_order: "asc" }, { created_at: "asc" }],
      select: {
        id: true,
        name: true,
        scope: true,
        products: {
          where: { deleted_at: null },
          orderBy: [{ display_order: "asc" }, { created_at: "asc" }],
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return classifyPlannerPlacement(goal, areas)
  }

  if (productName) {
    const resolvedProduct = await tx.product.findUnique({
      where: { id: productId },
      select: {
        name: true,
        area: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return {
      areaId: resolvedProduct?.area.id ?? "",
      areaName: resolvedProduct?.area.name ?? "",
      productId,
      productName,
      displayProductName: normalizePlannerProductNameForDisplay(productName),
    }
  }

  const resolvedProduct = await tx.product.findUnique({
    where: { id: productId },
    select: {
      name: true,
      area: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  return {
    areaId: resolvedProduct?.area.id ?? "",
    areaName: resolvedProduct?.area.name ?? "",
    productId,
    productName: resolvedProduct?.name ?? "",
    displayProductName: normalizePlannerProductNameForDisplay(resolvedProduct?.name ?? ""),
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
- 如有 estimated_days，代表該任務自身的預估工期天數
- priority 預設 P1，P0 只用於最緊急的 1-2 個任務
- summary 用繁體中文說明整體規劃邏輯`

  const startedAt = Date.now()
  const { object, usage } = await resilientGenerateObject({
    model: google("gemini-2.5-flash-lite"),
    schema: PlannerModelOutputSchema,
    prompt: plannerPrompt,
  })
  logAgentLlmCall({
    event: "agent_llm_call",
    feature: "planner_generate_task_breakdown",
    latencyMs: Date.now() - startedAt,
    usage: normalizeAiSdkUsage(usage),
    model: "gemini-2.5-flash-lite",
    metadata: {
      goalLen: normalizedGoal.length,
      depth,
      taskCount: object.tasks.length,
    },
  })
  return normalizePlannerOutput(normalizedGoal, object)
}

async function executePlanCreation(
  userId: string,
  goal: string,
  output: z.infer<typeof PlannerOutputSchema>,
  productId?: string,
  dueDate?: string,
  productName?: string,
): Promise<PlannerCreationResult> {
  // P1 safety: 整個建立流程包在 $transaction 中，失敗時整體 rollback，不留半套資料
  return prisma.$transaction(async (tx) => {
    const createdItems: Array<{ task_id: string; title: string; product: string; sub_items?: string[] }> = []
    const dueDates = buildPlannerDueDates(output.tasks, dueDate)
    const placement = await resolvePlannerPlacement(tx, userId, goal, productId, productName)

    for (const [index, taskItem] of output.tasks.entries()) {
      const taskDueDate = dueDates[index]

      // 建立 narrative（包含 rationale + priority）
      const narrative = `${taskItem.rationale}${taskItem.priority ? ` [${taskItem.priority}]` : ""}`
      const taskStatus = taskDueDate ? Status.ACTIVE : Status.INBOX

      const task = await tx.task.create({
        data: {
          content: taskItem.title,
          user_id: userId,
          status: taskStatus,
          product_id: placement.productId,
          due_date: taskDueDate ? new Date(taskDueDate) : null,
          ai_analysis: { narrative: narrative.slice(0, 500) },
        },
        select: { id: true },
      })
      const taskId = task.id

      const createdSubItems: string[] = []

      // 建立子任務
      if (taskItem.sub_items && taskItem.sub_items.length > 0) {
        for (const subContent of taskItem.sub_items) {
          await tx.subTask.create({
            data: {
              content: subContent.slice(0, 200),
              task_id: taskId,
              user_id: userId,
              completed: false,
            },
          })
          createdSubItems.push(subContent)
        }
      }

      createdItems.push({
        task_id: taskId,
        title: taskItem.title,
        product: placement.displayProductName,
        sub_items: createdSubItems.length > 0 ? createdSubItems : undefined,
      })
    }

    return {
      placement,
      items: createdItems,
    }
  }, {
    maxWait: 10_000,
    timeout: 20_000,
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
        const { placement, items: createdItems } = await executePlanCreation(
          userId,
          goal,
          planOutput,
          product_id,
          due_date,
          productHint,
        )

        const lines = createdItems.map((item, i) => {
          const productSuffix = item.product ? ` [${item.product}]` : ""
          const subLine =
            item.sub_items && item.sub_items.length > 0
              ? `\n   子任務：${item.sub_items.map((s) => `・${s}`).join("、")}`
              : ""
          return `${i + 1}. ${item.title}${productSuffix}${subLine}`
        })

        return (
          `✅ 規劃完成！共建立 ${createdItems.length} 個任務：\n` +
          `${buildPlannerPlacementNotice(placement)}\n\n` +
          `${lines.join("\n")}\n\n` +
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
    triggers: [],
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
  placement: {
    area: string
    project: string
    path: string
  }
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

  const { placement, items } = await executePlanCreation(
    authContext.userId,
    goal,
    planOutput,
    params.product_id,
    params.due_date,
    productHint,
  )

  return {
    tasks_created: items.length,
    items,
    summary: planOutput.summary,
    placement: {
      area: placement.areaName,
      project: placement.displayProductName || placement.productName,
      path: formatPlannerPlacementPath(placement),
    },
  }
}

// ─── Backwards-compat export（zentropy-agent.ts import plannerSkill）──────────
// zentropy-agent.ts 目前 import 的是 plannerSkill（舊 stub），
// 保留一個相容匯出以避免修改 agent 時影響太多
export const plannerSkill = createPlannerSkill
