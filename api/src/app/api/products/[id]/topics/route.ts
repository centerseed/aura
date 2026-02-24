import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth-middleware";
import { UnauthorizedException } from "@/lib/api-response";

// GET /api/products/[id]/topics
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await authenticateRequest(request, prisma);
    const { id: productId } = await params;

    // Verify product belongs to user
    const product = await prisma.product.findUnique({
      where: { id: productId, user_id: userId, deleted_at: null },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const topics = await prisma.topic.findMany({
      where: { product_id: productId, deleted_at: null },
      orderBy: { created_at: "asc" },
      select: { id: true, name: true },
    });

    return NextResponse.json({
      data: { topics },
    });
  } catch (error) {
    if (error instanceof UnauthorizedException) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get product topics failed:", error);
    return NextResponse.json(
      { error: "Failed to get topics" },
      { status: 500 }
    );
  }
}
