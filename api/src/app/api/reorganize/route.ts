/**
 * TODO [技術債 - 需重構至 Clean Architecture]:
 * 此 API 包含大量業務邏輯 (464行),應提取至 Use Case 層
 * 目前為快速統一格式,保留邏輯在此,未來需重構
 * 參考已重構的 Tasks/Products/Areas/Milestones APIs
 */


import { NextRequest } from "next/server";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth-middleware";
import { Status, Lifecycle } from "@prisma/client";
import { ApiResponseBuilder, catchDomainException } from "@/lib/api-response";

// 🚀 Raw SQL 查詢結果的型別
interface RawStructureRow {
  area_id: string
  area_name: string
  area_scope: string | null
  product_id: string | null
  product_name: string | null
  topic_id: string | null
  topic_name: string | null
  task_id: string | null
  task_content: string | null
  task_ai_analysis: unknown
}

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
  return catchDomainException<any>(async () => {
    const userId = await authenticateRequest(request, prisma);
    const body = await request.json() as any;
    const { preview = false, confirmed = false, selected_operation_ids = null } = body;

    // 🚀 獲取用戶所有現有結構（單一 SQL 查詢）
    const rawRows = await prisma.$queryRaw<RawStructureRow[]>`
      SELECT
        a.id::text as area_id,
        a.name as area_name,
        a.scope as area_scope,
        p.id::text as product_id,
        p.name as product_name,
        top.id::text as topic_id,
        top.name as topic_name,
        t.id::text as task_id,
        t.content as task_content,
        t.ai_analysis as task_ai_analysis
      FROM areas a
      LEFT JOIN products p ON p.area_id = a.id AND p.deleted_at IS NULL
      LEFT JOIN topics top ON top.product_id = p.id AND top.deleted_at IS NULL
      LEFT JOIN tasks t ON t.product_id = p.id
        AND t.deleted_at IS NULL
        AND t.status != 'ARCHIVE'::"statusenum"
      WHERE a.user_id = ${userId}::uuid AND a.deleted_at IS NULL
      ORDER BY a.name, p.name, t.created_at DESC
    `

    if (rawRows.length === 0) {
      return ApiResponseBuilder.success({
        message: "No data to reorganize",
        changes: { merges: 0, reclassifications: 0 },
      }, {});
    }

    // ✅ 優化：建立完整的快取結構，避免後續重複查詢
    const areaCache = new Map<string, { id: string; name: string }>();
    const productCache = new Map<string, { id: string; name: string; areaId: string; areaName: string; taskCount: number }>();
    const productByNameCache = new Map<string, Array<{ id: string; areaName: string; taskCount: number }>>();
    const taskMap: Record<string, { areaName: string; productName: string; content: string; aiAnalysis: object | null }> = {};

    // 用於計數和去重
    const productTaskCounts = new Map<string, number>();
    const tasksProcessed = new Set<string>();

    // 第一遍：計算每個 product 的 task 數量
    for (const row of rawRows) {
      if (row.product_id && row.task_id && !tasksProcessed.has(row.task_id)) {
        tasksProcessed.add(row.task_id);
        productTaskCounts.set(row.product_id, (productTaskCounts.get(row.product_id) || 0) + 1);
      }
    }
    tasksProcessed.clear();

    // 構建完整的結構摘要給 AI
    let structureSummary = "### Current Structure:\n\n";
    const areasProcessed = new Set<string>();
    const productsProcessed = new Set<string>();

    for (const row of rawRows) {
      // 處理 Area
      if (!areasProcessed.has(row.area_id)) {
        areasProcessed.add(row.area_id);
        areaCache.set(row.area_name, { id: row.area_id, name: row.area_name });
        structureSummary += `**Area: ${row.area_name}** (scope: ${row.area_scope || "undefined"})\n`;
      }

      // 處理 Product
      if (row.product_id && !productsProcessed.has(row.product_id)) {
        productsProcessed.add(row.product_id);
        const taskCount = productTaskCounts.get(row.product_id) || 0;

        // 快取 Product (by ID)
        productCache.set(row.product_id, {
          id: row.product_id,
          name: row.product_name!,
          areaId: row.area_id,
          areaName: row.area_name,
          taskCount,
        });

        // 快取 Product (by name，可能有多個同名 product)
        const existingByName = productByNameCache.get(row.product_name!) || [];
        existingByName.push({ id: row.product_id, areaName: row.area_name, taskCount });
        productByNameCache.set(row.product_name!, existingByName);

        structureSummary += `  - Product: ${row.product_name}\n`;
      }

      // 處理 Task
      if (row.task_id && row.product_id && !tasksProcessed.has(row.task_id)) {
        tasksProcessed.add(row.task_id);
        const aiAnalysis = row.task_ai_analysis as { narrative?: string } || {};
        structureSummary += `    - Task [${row.task_id}]: ${row.task_content} (${aiAnalysis.narrative || "no context"})\n`;
        taskMap[row.task_id] = {
          areaName: row.area_name,
          productName: row.product_name!,
          content: row.task_content!,
          aiAnalysis: row.task_ai_analysis as object | null,
        };
      }
    }
    structureSummary += "\n";

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

      // ✅ 優化：預覽合併操作 - 使用快取，不需要查詢資料庫
      for (const merge of result.merges) {
        for (const sourceProductName of merge.source_products) {
          // 從快取獲取同名 Products
          const sourceProducts = productByNameCache.get(sourceProductName) || [];

          for (const sourceProduct of sourceProducts) {
            structuredOperations.push({
              id: `merge-${operationIdCounter++}`,
              type: "merge",
              reason: merge.reason,
              from: {
                area: sourceProduct.areaName,
                product: sourceProductName,
              },
              to: {
                area: merge.target_area,
                product: merge.target_product,
              },
              taskCount: sourceProduct.taskCount,
            });
          }
        }
      }

      // ✅ 優化：預覽重新分類操作 - 使用 taskMap，不需要查詢資料庫
      for (const reclass of result.reclassifications) {
        const taskInfo = taskMap[reclass.task_id];

        if (taskInfo) {
          structuredOperations.push({
            id: `reclass-${operationIdCounter++}`,
            type: "reclassify",
            reason: reclass.reason,
            from: {
              area: reclass.current_area,
              product: reclass.current_product,
              taskTitle: reclass.task_title || taskInfo.content,
            },
            to: {
              area: reclass.new_area,
              product: reclass.new_product,
            },
          });
        }
      }

      return ApiResponseBuilder.success({
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
      }, {});
    }

    // 如果有指定選中的操作 IDs，建立選擇集合
    let selectedOperationSet: Set<string> | null = null;
    if (selected_operation_ids && Array.isArray(selected_operation_ids)) {
      selectedOperationSet = new Set(selected_operation_ids);
    }

    // 操作日誌（用於顯示給用戶）
    const operationLog: string[] = [];

    // ✅ 優化：建立執行時的動態快取（記錄新創建的 area/product）
    const execAreaCache = new Map<string, string>(); // areaName -> areaId
    const execProductCache = new Map<string, string>(); // areaId::productName -> productId

    // 預填充執行快取
    areaCache.forEach((info, name) => {
      execAreaCache.set(name, info.id);
    });
    productCache.forEach((info, id) => {
      execProductCache.set(`${info.areaId}::${info.name}`, id);
    });

    // 輔助函數：獲取或創建 Area
    const getOrCreateArea = async (areaName: string): Promise<string> => {
      const cached = execAreaCache.get(areaName);
      if (cached) return cached;

      const newArea = await prisma.area.create({
        data: {
          user_id: userId,
          name: areaName,
          is_custom: true,
          created_at: new Date(),
        },
      });
      execAreaCache.set(areaName, newArea.id);
      operationLog.push(`  ➕ 創建新 Area：${areaName}`);
      return newArea.id;
    };

    // 輔助函數：獲取或創建 Product
    const getOrCreateProduct = async (areaId: string, areaName: string, productName: string): Promise<string> => {
      const cacheKey = `${areaId}::${productName}`;
      const cached = execProductCache.get(cacheKey);
      if (cached) return cached;

      const newProduct = await prisma.product.create({
        data: {
          user_id: userId,
          area_id: areaId,
          name: productName,
          status: Status.ACTIVE,
          lifecycle: Lifecycle.FINITE,
          created_at: new Date(),
        },
      });
      execProductCache.set(cacheKey, newProduct.id);
      operationLog.push(`  ➕ 創建新 Product：${areaName} / ${productName}`);
      return newProduct.id;
    };

    // 執行合併操作
    let mergeCount = 0;
    let opIdCounter = 0;
    const productsToDelete: string[] = [];

    for (const merge of result.merges) {
      operationLog.push(`🔀 合併操作：${merge.reason}`);

      // ✅ 優化：使用快取獲取或創建目標 Area
      const targetAreaId = await getOrCreateArea(merge.target_area);

      // ✅ 優化：使用快取獲取或創建目標 Product
      const targetProductId = await getOrCreateProduct(targetAreaId, merge.target_area, merge.target_product);

      // ✅ 優化：使用快取獲取來源 Products
      for (const sourceProductName of merge.source_products) {
        const sourceProducts = productByNameCache.get(sourceProductName) || [];

        for (const sourceProduct of sourceProducts) {
          // 生成操作 ID（需與預覽時一致）
          const currentOpId = `merge-${opIdCounter++}`;

          // 如果有選擇限制且此操作未被選中，跳過
          if (selectedOperationSet && !selectedOperationSet.has(currentOpId)) {
            continue;
          }

          // 排除目標自己
          if (sourceProduct.id === targetProductId) continue;

          // ✅ 優化：使用快取中的 taskCount，不需要查詢
          const taskCount = sourceProduct.taskCount;

          // 移動所有 Tasks 到目標 Product
          await prisma.task.updateMany({
            where: { product_id: sourceProduct.id, deleted_at: null },
            data: { product_id: targetProductId },
          });

          // 移動所有 Topics 到目標 Product
          await prisma.topic.updateMany({
            where: { product_id: sourceProduct.id, deleted_at: null },
            data: { product_id: targetProductId },
          });

          operationLog.push(`  📦 合併「${sourceProductName}」→「${merge.target_product}」（${taskCount} 個任務）`);

          // 收集要刪除的 Product ID（稍後批量更新）
          productsToDelete.push(sourceProduct.id);
          mergeCount++;
        }
      }
    }

    // ✅ 優化：批量軟刪除來源 Products
    if (productsToDelete.length > 0) {
      await prisma.product.updateMany({
        where: { id: { in: productsToDelete } },
        data: { deleted_at: new Date() },
      });
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

      // ✅ 優化：使用 taskMap，不需要查詢資料庫
      const taskInfo = taskMap[reclass.task_id];
      if (!taskInfo) continue;

      operationLog.push(`🏷️  重新分類：「${taskInfo.content}」`);
      operationLog.push(`  原本：${reclass.current_area} / ${reclass.current_product}`);
      operationLog.push(`  改為：${reclass.new_area} / ${reclass.new_product}`);
      operationLog.push(`  原因：${reclass.reason}`);

      // ✅ 優化：使用快取獲取或創建目標 Area 和 Product
      const targetAreaId = await getOrCreateArea(reclass.new_area);
      const targetProductId = await getOrCreateProduct(targetAreaId, reclass.new_area, reclass.new_product);

      // 更新任務
      await prisma.task.update({
        where: { id: reclass.task_id },
        data: {
          product_id: targetProductId,
          ai_analysis: {
            ...(taskInfo.aiAnalysis || {}),
            reclassification_reason: reclass.reason,
            reclassified_at: new Date().toISOString(),
          },
        },
      });

      reclassifyCount++;
    }

    // ✅ 優化：清理空的 Products 和 Areas（使用批量更新）
    const emptyProducts = await prisma.product.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
        tasks: { none: { deleted_at: null, status: { not: Status.ARCHIVE } } },
      },
      select: { id: true },
    });

    // ✅ 批量軟刪除空 Products
    if (emptyProducts.length > 0) {
      await prisma.product.updateMany({
        where: { id: { in: emptyProducts.map(p => p.id) } },
        data: { deleted_at: new Date() },
      });
      operationLog.push(`🧹 清理空 Product：${emptyProducts.length} 個`);
    }

    const emptyAreas = await prisma.area.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
        products: { none: { deleted_at: null } },
      },
      select: { id: true },
    });

    // ✅ 批量軟刪除空 Areas
    if (emptyAreas.length > 0) {
      await prisma.area.updateMany({
        where: { id: { in: emptyAreas.map(a => a.id) } },
        data: { deleted_at: new Date() },
      });
      operationLog.push(`🧹 清理空 Area：${emptyAreas.length} 個`);
    }

    return ApiResponseBuilder.success({
      analysis: result.analysis,
      operations: operationLog,
      changes: {
        merges: mergeCount,
        reclassifications: reclassifyCount,
        emptyProductsCleaned: emptyProducts.length,
        emptyAreasCleaned: emptyAreas.length,
      },
    }, {});
  })
}
