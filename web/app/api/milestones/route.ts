import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { authenticateRequest } from "@/lib/auth-middleware";

// Validation schema
const CreateMilestoneSchema = z.object({
  name: z.string().min(1).max(200),
  target_date: z.string().datetime({ offset: true }), // ISO 8601 date string (允許時區偏移)
  entity_type: z.enum(["AREA", "PRODUCT", "TOPIC"]),
  entity_id: z.string().uuid(),
  priority: z.number().int().min(1).max(10).default(5),
  description: z.string().optional(),
  status: z.enum(["planned", "in_progress", "completed", "delayed", "cancelled"]).default("planned"),
});

// GET /api/milestones
export async function GET(request: NextRequest) {
  try {
    const userId = await authenticateRequest(request, prisma);

    const milestones = await prisma.milestone.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
      },
      orderBy: {
        target_date: "asc",
      },
    });

    // 手動處理多態關聯 - 根據 entity_type 批次查詢關聯實體
    const productIds = milestones
      .filter((m) => m.entity_type === "PRODUCT")
      .map((m) => m.entity_id);
    const areaIds = milestones
      .filter((m) => m.entity_type === "AREA")
      .map((m) => m.entity_id);
    const topicIds = milestones
      .filter((m) => m.entity_type === "TOPIC")
      .map((m) => m.entity_id);

    // 批次查詢所有關聯實體
    const [products, areas, topics] = await Promise.all([
      productIds.length > 0
        ? prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true },
          })
        : [],
      areaIds.length > 0
        ? prisma.area.findMany({
            where: { id: { in: areaIds } },
            select: { id: true, name: true },
          })
        : [],
      topicIds.length > 0
        ? prisma.topic.findMany({
            where: { id: { in: topicIds } },
            select: { id: true, name: true },
          })
        : [],
    ]);

    // 建立 ID -> Entity 的 Map 以便快速查找
    const productMap = new Map(products.map((p) => [p.id, p]));
    const areaMap = new Map(areas.map((a) => [a.id, a]));
    const topicMap = new Map(topics.map((t) => [t.id, t]));

    // 組合最終結果
    const milestonesWithEntities = milestones.map((milestone) => {
      let entity = null;
      if (milestone.entity_type === "PRODUCT") {
        entity = productMap.get(milestone.entity_id) || null;
      } else if (milestone.entity_type === "AREA") {
        entity = areaMap.get(milestone.entity_id) || null;
      } else if (milestone.entity_type === "TOPIC") {
        entity = topicMap.get(milestone.entity_id) || null;
      }

      return {
        ...milestone,
        product: milestone.entity_type === "PRODUCT" ? entity : null,
        area: milestone.entity_type === "AREA" ? entity : null,
        topic: milestone.entity_type === "TOPIC" ? entity : null,
      };
    });

    return NextResponse.json(milestonesWithEntities);
  } catch (error) {
    console.error("Failed to fetch milestones:", error);
    console.error("Error details:", error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.message.includes("token")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // 如果 Milestone 表不存在，返回空陣列而不是錯誤
    if (error instanceof Error && error.message.includes('milestone')) {
      console.warn("Milestone table may not exist yet. Returning empty array.");
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: "Failed to fetch milestones" }, { status: 500 });
  }
}

// POST /api/milestones
export async function POST(request: NextRequest) {
  try {
    const userId = await authenticateRequest(request, prisma);
    const body = await request.json();
    console.log("Received milestone creation request:", JSON.stringify(body, null, 2));

    const validated = CreateMilestoneSchema.parse(body);
    console.log("Validated data:", JSON.stringify(validated, null, 2));

    const milestone = await prisma.milestone.create({
      data: {
        user_id: userId,
        name: validated.name,
        target_date: new Date(validated.target_date),
        entity_type: validated.entity_type,
        entity_id: validated.entity_id,
        priority: validated.priority,
        description: validated.description,
        status: validated.status,
      },
    });

    return NextResponse.json(milestone, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Validation error:", error.errors);
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    if (error instanceof Error && error.message.includes("token")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to create milestone:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
    console.error("Error message:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({
      error: "Failed to create milestone",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
