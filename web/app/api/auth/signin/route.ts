import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, providerId, email, name } = body;

    if (!provider) {
      return NextResponse.json({ error: "需要提供認證方式" }, { status: 400 });
    }

    // 根據認證方式處理使用者
    let user;

    if (provider === "google") {
      // Google SSO 登入
      if (!providerId || !email) {
        return NextResponse.json({ error: "Google 登入需要 providerId 和 email" }, { status: 400 });
      }

      // 嘗試透過 auth_provider_id 查找現有使用者
      user = await prisma.user.findFirst({
        where: {
          auth_provider: "GOOGLE",
          auth_provider_id: providerId,
        },
      });

      if (!user) {
        // 建立新使用者
        user = await prisma.user.create({
          data: {
            email,
            name: name || email.split("@")[0],
            auth_provider: "GOOGLE",
            auth_provider_id: providerId,
          },
        });
      } else {
        // 更新使用者資訊（如果有變更）
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            email,
            name: name || user.name,
            updated_at: new Date(),
          },
        });
      }
    } else if (provider === "anonymous") {
      // 匿名登入
      if (!providerId) {
        return NextResponse.json({ error: "匿名登入需要 providerId" }, { status: 400 });
      }

      // 檢查是否已存在該匿名使用者
      user = await prisma.user.findFirst({
        where: {
          auth_provider: "ANONYMOUS",
          auth_provider_id: providerId,
        },
      });

      if (!user) {
        // 建立新匿名使用者
        user = await prisma.user.create({
          data: {
            email: null,
            name: name || "訪客",
            auth_provider: "ANONYMOUS",
            auth_provider_id: providerId,
          },
        });
      }
    } else if (provider === "email") {
      // 使用名稱登入（舊有方式）
      if (!email || !name) {
        return NextResponse.json({ error: "名稱登入需要 email 和 name" }, { status: 400 });
      }

      // 透過 email 查找或建立使用者
      user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            name,
            auth_provider: "EMAIL",
            auth_provider_id: null,
          },
        });
      } else {
        // 更新名稱
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            name,
            updated_at: new Date(),
          },
        });
      }
    } else {
      return NextResponse.json({ error: "不支援的認證方式" }, { status: 400 });
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      authProvider: user.auth_provider,
    });
  } catch (error) {
    console.error("登入錯誤:", error);
    return NextResponse.json(
      { error: "伺服器錯誤" },
      { status: 500 }
    );
  }
}
