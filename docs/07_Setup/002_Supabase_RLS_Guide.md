# Supabase Row Level Security (RLS) 設定指南

## 🔍 RLS 警告的原因

Supabase Dashboard 顯示 RLS 警告是因為：

1. **預設行為**：Supabase 建議所有資料表都啟用 RLS
2. **安全考量**：防止前端直接存取資料庫時的未授權存取
3. **最佳實踐**：Supabase 的設計理念是前端直接連資料庫

## 🏗️ 我們的架構 vs Supabase 典型架構

### Supabase 典型架構（需要 RLS）
```
前端 (React/Next.js)
  ↓ 使用 @supabase/supabase-js
  ↓ 直接連接
Supabase Database
  ↓ RLS 保護
資料表
```
**特點**：前端直接存取資料庫，需要 RLS 保護使用者資料

### 我們的架構（不需要 RLS）
```
前端 (Next.js)
  ↓ HTTP API 請求
後端 API (Next.js API Routes / FastAPI)
  ↓ Prisma ORM
  ↓ Service Role Connection (繞過 RLS)
Supabase Database
```
**特點**：後端控制所有資料存取，前端無法直接存取資料庫

## ✅ 我們目前的安全架構

### 1. 認證層（Firebase Auth）
- ✅ 使用者透過 Firebase 登入
- ✅ Firebase 提供 JWT token
- ✅ 後端驗證 token

### 2. API 層（Next.js API Routes）
```typescript
// app/api/auth/signin/route.ts
export async function POST(request: NextRequest) {
  // ✅ 驗證 Firebase token
  // ✅ 檢查權限
  // ✅ 使用 Prisma 存取資料庫
}
```

### 3. 資料庫層（Supabase + Prisma）
```typescript
// lib/db.ts
export const prisma = new PrismaClient({
  // ✅ 使用 Service Role connection
  // ✅ 繞過 RLS（因為我們在後端控制權限）
});
```

## 🎯 解決方案選項

### 選項 1：保持現狀（推薦）

**適合**：大多數使用後端 API 的應用

**做法**：關閉 RLS 警告，不啟用 RLS

```sql
-- 在 Supabase SQL Editor 執行
-- 這會關閉 RLS 警告，但資料表仍然受後端保護

-- 為每個資料表禁用 RLS
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE areas DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE topics DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE milestones DISABLE ROW LEVEL SECURITY;
ALTER TABLE governance_proposals DISABLE ROW LEVEL SECURITY;
```

**優點**：
- ✅ 簡單直接
- ✅ 不需要設定複雜的 RLS 規則
- ✅ 後端完全控制權限
- ✅ 符合我們的架構

**注意**：
- ⚠️ 確保**永遠不要**將 Service Role Key 暴露給前端
- ⚠️ 所有資料存取都必須透過後端 API

### 選項 2：啟用 RLS + 使用 Service Role

**適合**：需要額外安全層的企業應用

**做法**：啟用 RLS，但使用 Service Role Key 繞過

```sql
-- 啟用 RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 建立 Policy 允許 Service Role 完全存取
CREATE POLICY "Service role bypass" ON users
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

**優點**：
- ✅ 滿足 Supabase 的安全建議
- ✅ 如果未來需要前端直接存取，已經有基礎

**缺點**：
- ❌ 需要為每個資料表設定 policy
- ❌ 增加複雜度
- ❌ 我們目前不需要

### 選項 3：完整 RLS 設定（未來考慮）

**適合**：前端直接存取 Supabase 的應用

**做法**：設定完整的 RLS 規則

```sql
-- 範例：使用者只能看到自己的資料
CREATE POLICY "Users can view own data" ON users
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE
  USING (auth.uid() = id);
```

**注意**：需要將 Firebase Auth 整合到 Supabase Auth，目前不適用

## 🚀 推薦做法（立即執行）

### 步驟 1：關閉 RLS 警告

在 Supabase Dashboard → SQL Editor 執行：

```sql
-- 禁用所有資料表的 RLS
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE areas DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE topics DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE milestones DISABLE ROW LEVEL SECURITY;
ALTER TABLE governance_proposals DISABLE ROW LEVEL SECURITY;
ALTER TABLE alembic_version DISABLE ROW LEVEL SECURITY;
```

### 步驟 2：確認安全配置

檢查你的環境變數：

```bash
# ✅ 正確：這是 Service Role connection，只能在後端使用
DATABASE_URL="postgresql://postgres.xxx:password@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"

# ❌ 錯誤：絕不要在前端程式碼中使用 DATABASE_URL
# ❌ 錯誤：絕不要將 DATABASE_URL 暴露在 NEXT_PUBLIC_* 環境變數中
```

### 步驟 3：驗證後端權限控制

確保你的 API routes 有適當的權限檢查：

```typescript
// app/api/tasks/route.ts
export async function GET(request: NextRequest) {
  // ✅ 驗證使用者身份
  const userId = await verifyUser(request);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ✅ 只返回該使用者的資料
  const tasks = await prisma.task.findMany({
    where: { user_id: userId }
  });

  return NextResponse.json(tasks);
}
```

## 📋 安全檢查清單

- [ ] DATABASE_URL 只存在於後端環境變數
- [ ] 沒有 NEXT_PUBLIC_DATABASE_URL
- [ ] API routes 有使用者驗證
- [ ] API routes 檢查資料存取權限
- [ ] 前端只透過 API routes 存取資料
- [ ] RLS 已禁用（因為我們用後端控制）

## 🔒 安全最佳實踐

### ✅ 要做的事

1. **後端驗證所有請求**
   ```typescript
   // 每個 API route 都要驗證
   const user = await verifyFirebaseToken(request);
   ```

2. **檢查資料所有權**
   ```typescript
   // 確保使用者只能存取自己的資料
   where: { user_id: currentUserId }
   ```

3. **使用 TypeScript 型別**
   ```typescript
   // 確保資料結構正確
   interface Task {
     user_id: string;
     // ...
   }
   ```

### ❌ 不要做的事

1. **不要在前端暴露資料庫連接**
   ```typescript
   // ❌ 錯誤
   const NEXT_PUBLIC_DATABASE_URL = "..."
   ```

2. **不要讓前端直接查詢資料庫**
   ```typescript
   // ❌ 錯誤 - 在前端使用 Prisma
   const tasks = await prisma.task.findMany()
   ```

3. **不要跳過權限檢查**
   ```typescript
   // ❌ 錯誤 - 沒有檢查使用者權限
   export async function DELETE(request, { params }) {
     await prisma.task.delete({ where: { id: params.id } })
   }
   ```

## 🎯 總結

### 我們的安全模型

```
使用者登入
  ↓ Firebase Auth
JWT Token
  ↓ 傳送到後端
後端 API
  ↓ 驗證 token
  ↓ 檢查權限
  ↓ Prisma ORM
Supabase PostgreSQL
  ↓ Service Role (繞過 RLS)
資料表
```

### 為什麼不需要 RLS？

1. **前端無法直接存取資料庫** - 所有請求都經過後端
2. **後端控制所有權限** - API routes 負責驗證和授權
3. **使用 Service Role** - 後端使用完全權限的連接
4. **Firebase Auth 處理認證** - 不使用 Supabase Auth

### 快速解決 RLS 警告

執行這個腳本：

```sql
-- 一次關閉所有 RLS 警告
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')
    LOOP
        EXECUTE 'ALTER TABLE ' || quote_ident(r.tablename) || ' DISABLE ROW LEVEL SECURITY';
    END LOOP;
END $$;
```

執行後，Supabase Dashboard 的 RLS 警告就會消失！✨
