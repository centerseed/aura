import { NextRequest, NextResponse } from "next/server";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth-middleware";
import { Status, Lifecycle } from "@prisma/client";

// AI 重新分類結果結構（繁體中文）
const ReorganizeResultSchema = z.object({
  analysis: z.string().describe("以繁體中文描述目前結構的問題分析（1-2 句話）"),
  merges: z.array(
    z.object({
      reason: z.string().describe("以繁體中文說明為什麼要合併"),
      target_area: z.string().describe("保留的目標 Area 名稱"),
      source_areas: z.array(z.string()).describe("要合併到目標的來源 Area 名稱"),
      target_product: z.string().describe("保留的目標 Product 名稱"),
      source_products: z.array(z.string()).describe("要合併到目標的來源 Product 名稱"),
    })
  ).describe("建議合併的重複/相似結構"),
  reclassifications: z.array(
    z.object({
      task_id: z.string().describe("要重新分類的任務 ID"),
      task_title: z.string().describe("任務標題（用於顯示）"),
      current_area: z.string(),
      current_product: z.string(),
      new_area: z.string().describe("正確的 Area"),
      new_product: z.string().describe("正確的 Product"),
      reason: z.string().describe("以繁體中文說明重新分類的原因"),
    })
  ).describe("需要移動到不同 Area/Product 的任務"),
});

// POST /api/reorganize
export async function POST(request: NextRequest) {
  try {
    const userId = await authenticateRequest(request, prisma);
    const body = await request.json();
    const { preview = false, confirmed = false, selected_operation_ids = null } = body;

    // 獲取用戶所有現有結構
    const existingAreas = await prisma.area.findMany({
      where: { user_id: userId, deleted_at: null },
      include: {
        products: {
          where: { deleted_at: null },
          include: {
            topics: { where: { deleted_at: null } },
            tasks: {
              where: { deleted_at: null },
              orderBy: { created_at: "desc" },
            },
          },
        },
      },
    });

    if (existingAreas.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No data to reorganize",
        changes: { merges: 0, reclassifications: 0 },
      });
    }

    // 構建完整的結構摘要給 AI
    let structureSummary = "### Current Structure:\n\n";
    const taskMap: Record<string, { areaName: string; productName: string; content: string }> = {};

    for (const area of existingAreas) {
      structureSummary += `**Area: ${area.name}** (scope: ${area.scope || "undefined"})\n`;
      for (const product of area.products) {
        structureSummary += `  - Product: ${product.name}\n`;
        for (const task of product.tasks) {
          const aiAnalysis = task.ai_analysis as { narrative?: string } || {};
          structureSummary += `    - Task [${task.id}]: ${task.content} (${aiAnalysis.narrative || "no context"})\n`;
          taskMap[task.id] = {
            areaName: area.name,
            productName: product.name,
            content: task.content,
          };
        }
      }
      structureSummary += "\n";
    }

    // 調用 AI 進行分析和重新整理建議
    const { object: result } = await generateObject({
      model: google("gemini-2.5-flash-lite"),
      schema: ReorganizeResultSchema,
      prompt: `你是 Zentropy 的圖書管理員 AI，一個資訊熵減系統。

你的任務是重新整理和合併用戶現有的資料結構。

## 核心聚合規則（必須遵守）：
1. **絕不聚合 Area (L1)**：Area 代表身分/角色，應保持穩定，即使名稱相似也不合併
2. **L2 (Product) 完全沒資料才聚合**：只清理完全沒有任務的空 Product
3. **L2 相似專案才考慮聚合**：只合併語義上明顯重複的 Product（如「專案管理」vs「項目管理」）

## 治理原則：
- **語義引力**：關於同一現實概念的項目應該聚集在一起
- **清晰層級**：Area = 身分角色、Product = 長期資產、Topic = 主題模組
- **保守優先**：寧可保留分散的結構，也不要過度聚合造成混亂

${structureSummary}

## 指示：
1. 分析目前結構的問題（但要保守判斷）
2. **只建議合併明顯重複的 Product**（例如名稱幾乎相同、語義完全一致）
3. 識別需要重新分類的任務（但要有充分理由）
4. 盡可能使用現有的 Area/Product 名稱作為目標
5. **絕對不要合併 Area**

重要：
- 所有分析和理由必須使用繁體中文回覆
- 只建議有語義意義的變更，不要為了整理而整理
- 在 reclassifications 中，請填入 task_title 欄位（從 Task 內容中提取）
- **保守原則**：如果不確定是否該合併，就不要合併`,
    });

    console.log("AI Reorganize Analysis:", result.analysis);
    console.log("Suggested Merges:", result.merges);
    console.log("Reclassifications:", result.reclassifications);

    // 如果只是預覽模式，返回操作預覽，不實際執行
    if (preview || !confirmed) {
      // 結構化的操作預覽數據
      const structuredOperations: Array<{
        id: string;
        type: "merge" | "reclassify";
        reason: string;
        from: { area?: string; product: string; taskTitle?: string };
        to: { area?: string; product: string };
        taskCount?: number;
      }> = [];
      let operationIdCounter = 0;

      // 預覽合併操作
      for (const merge of result.merges) {
        for (const sourceProductName of merge.source_products) {
          const sourceProducts = await prisma.product.findMany({
            where: {
              user_id: userId,
              name: sourceProductName,
              deleted_at: null,
            },
            include: {
              area: { select: { name: true } },
            },
          });

          for (const sourceProduct of sourceProducts) {
            const taskCount = await prisma.task.count({
              where: { product_id: sourceProduct.id, deleted_at: null },
            });

            structuredOperations.push({
              id: `merge-${operationIdCounter++}`,
              type: "merge",
              reason: merge.reason,
              from: {
                area: sourceProduct.area?.name,
                product: sourceProductName,
              },
              to: {
                area: merge.target_area,
                product: merge.target_product,
              },
              taskCount,
            });
          }
        }
      }

      // 預覽重新分類操作
      for (const reclass of result.reclassifications) {
        const task = await prisma.task.findUnique({
          where: { id: reclass.task_id },
        });

        if (task && !task.deleted_at) {
          structuredOperations.push({
            id: `reclass-${operationIdCounter++}`,
            type: "reclassify",
            reason: reclass.reason,
            from: {
              area: reclass.current_area,
              product: reclass.current_product,
              taskTitle: reclass.task_title || task.content,
            },
            to: {
              area: reclass.new_area,
              product: reclass.new_product,
            },
          });
        }
      }

      return NextResponse.json({
        success: true,
        preview: true,
        analysis: result.analysis,
        structured_operations: structuredOperations,
        // 保留舊格式以向後兼容
        preview_operations: structuredOperations.map((op) => {
          if (op.type === "merge") {
            return `合併「${op.from.product}」→「${op.to.product}」（${op.taskCount} 個任務）`;
          } else {
            return `移動「${op.from.taskTitle}」從「${op.from.product}」到「${op.to.product}」`;
          }
        }),
        estimated_changes: {
          merges: result.merges.length,
          reclassifications: result.reclassifications.length,
        },
      });
    }

    // 如果有指定選中的操作 IDs，建立選擇集合
    let selectedOperationSet: Set<string> | null = null;
    if (selected_operation_ids && Array.isArray(selected_operation_ids)) {
      selectedOperationSet = new Set(selected_operation_ids);
    }

    // 操作日誌（用於顯示給用戶）
    const operationLog: string[] = [];

    // 執行合併操作
    let mergeCount = 0;
    let opIdCounter = 0; // 用於生成操作 ID 以匹配預覽時的 ID

    for (const merge of result.merges) {
      operationLog.push(`🔀 合併操作：${merge.reason}`);

      // 找到目標 Area
      let targetArea = await prisma.area.findFirst({
        where: { user_id: userId, name: merge.target_area, deleted_at: null },
      });

      if (!targetArea) {
        // 如果目標 Area 不存在，創建它
        targetArea = await prisma.area.create({
          data: {
            user_id: userId,
            name: merge.target_area,
            is_custom: true,
          },
        });
        operationLog.push(`  ➕ 創建新 Area：${merge.target_area}`);
      }

      // 找到或創建目標 Product
      let targetProduct = await prisma.product.findFirst({
        where: { user_id: userId, area_id: targetArea.id, name: merge.target_product, deleted_at: null },
      });

      if (!targetProduct) {
        targetProduct = await prisma.product.create({
          data: {
            user_id: userId,
            area_id: targetArea.id,
            name: merge.target_product,
            status: Status.ACTIVE,
            lifecycle: Lifecycle.FINITE,
          },
        });
        operationLog.push(`  ➕ 創建新 Product：${merge.target_area} / ${merge.target_product}`);
      }

      // 合併來源 Products 的 Tasks 到目標 Product
      for (const sourceProductName of merge.source_products) {
        // 找到所有匹配的來源 Products（可能在不同 Areas）
        const sourceProducts = await prisma.product.findMany({
          where: {
            user_id: userId,
            name: sourceProductName,
            deleted_at: null,
            id: { not: targetProduct.id }, // 排除目標自己
          },
        });

        for (const sourceProduct of sourceProducts) {
          // 生成操作 ID（需與預覽時一致）
          const currentOpId = `merge-${opIdCounter++}`;

          // 如果有選擇限制且此操作未被選中，跳過
          if (selectedOperationSet && !selectedOperationSet.has(currentOpId)) {
            continue;
          }

          // 計算任務數量
          const taskCount = await prisma.task.count({
            where: { product_id: sourceProduct.id, deleted_at: null },
          });

          // 移動所有 Tasks 到目標 Product
          await prisma.task.updateMany({
            where: { product_id: sourceProduct.id, deleted_at: null },
            data: { product_id: targetProduct.id },
          });

          // 移動所有 Topics 到目標 Product
          await prisma.topic.updateMany({
            where: { product_id: sourceProduct.id, deleted_at: null },
            data: { product_id: targetProduct.id },
          });

          operationLog.push(`  📦 合併「${sourceProductName}」→「${merge.target_product}」（${taskCount} 個任務）`);

          // 軟刪除來源 Product
          await prisma.product.update({
            where: { id: sourceProduct.id },
            data: { deleted_at: new Date() },
          });

          mergeCount++;
        }
      }

      // 軟刪除來源 Areas（如果它們現在是空的）
      for (const sourceAreaName of merge.source_areas) {
        if (sourceAreaName === merge.target_area) continue;

        const sourceArea = await prisma.area.findFirst({
          where: { user_id: userId, name: sourceAreaName, deleted_at: null },
          include: { products: { where: { deleted_at: null } } },
        });

        if (sourceArea && sourceArea.products.length === 0) {
          await prisma.area.update({
            where: { id: sourceArea.id },
            data: { deleted_at: new Date() },
          });
        }
      }
    }

    // 執行重新分類操作
    let reclassifyCount = 0;
    for (const reclass of result.reclassifications) {
      // 生成操作 ID（需與預覽時一致）
      const currentOpId = `reclass-${opIdCounter++}`;

      // 如果有選擇限制且此操作未被選中，跳過
      if (selectedOperationSet && !selectedOperationSet.has(currentOpId)) {
        continue;
      }

      // 找到任務
      const task = await prisma.task.findUnique({
        where: { id: reclass.task_id },
      });

      if (!task || task.deleted_at) continue;

      operationLog.push(`🏷️  重新分類：「${task.content}」`);
      operationLog.push(`  原本：${reclass.current_area} / ${reclass.current_product}`);
      operationLog.push(`  改為：${reclass.new_area} / ${reclass.new_product}`);
      operationLog.push(`  原因：${reclass.reason}`);

      // 找到目標 Area
      let targetArea = await prisma.area.findFirst({
        where: { user_id: userId, name: reclass.new_area, deleted_at: null },
      });

      if (!targetArea) {
        targetArea = await prisma.area.create({
          data: {
            user_id: userId,
            name: reclass.new_area,
            is_custom: true,
          },
        });
      }

      // 找到目標 Product
      let targetProduct = await prisma.product.findFirst({
        where: { user_id: userId, area_id: targetArea.id, name: reclass.new_product, deleted_at: null },
      });

      if (!targetProduct) {
        targetProduct = await prisma.product.create({
          data: {
            user_id: userId,
            area_id: targetArea.id,
            name: reclass.new_product,
            status: Status.ACTIVE,
            lifecycle: Lifecycle.FINITE,
          },
        });
      }

      // 更新任務
      await prisma.task.update({
        where: { id: reclass.task_id },
        data: {
          product_id: targetProduct.id,
          ai_analysis: {
            ...(task.ai_analysis as object || {}),
            reclassification_reason: reclass.reason,
            reclassified_at: new Date().toISOString(),
          },
        },
      });

      reclassifyCount++;
    }

    // 清理空的 Products 和 Areas
    const emptyProducts = await prisma.product.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
        tasks: { none: { deleted_at: null } },
      },
    });

    for (const product of emptyProducts) {
      await prisma.product.update({
        where: { id: product.id },
        data: { deleted_at: new Date() },
      });
    }

    const emptyAreas = await prisma.area.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
        products: { none: { deleted_at: null } },
      },
    });

    for (const area of emptyAreas) {
      await prisma.area.update({
        where: { id: area.id },
        data: { deleted_at: new Date() },
      });
    }

    // 添加清理操作日誌
    if (emptyProducts.length > 0) {
      operationLog.push(`🧹 清理空 Product：${emptyProducts.length} 個`);
    }
    if (emptyAreas.length > 0) {
      operationLog.push(`🧹 清理空 Area：${emptyAreas.length} 個`);
    }

    return NextResponse.json({
      success: true,
      analysis: result.analysis,
      operations: operationLog,
      changes: {
        merges: mergeCount,
        reclassifications: reclassifyCount,
        emptyProductsCleaned: emptyProducts.length,
        emptyAreasCleaned: emptyAreas.length,
      },
    });
  } catch (error) {
    console.error("Reorganize failed:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check for authentication errors
    if (
      errorMessage.includes("token") ||
      errorMessage.includes("User not found")
    ) {
      return NextResponse.json({
        error: "Unauthorized",
        details: "Authentication failed. Please provide a valid Firebase ID token.",
      }, { status: 401 });
    }

    return NextResponse.json({
      error: "Reorganize failed",
      details: errorMessage
    }, { status: 500 });
  }
}
