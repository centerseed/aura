/**
 * 測試數據庫連接檢查腳本
 *
 * 用途：
 * 1. 確保測試數據庫可用
 * 2. 在執行 integration tests 前自動檢查
 * 3. 提供清晰的錯誤訊息和設置指示
 */

import { PrismaClient } from '@prisma/client';

async function checkTestDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  // 1. 檢查環境變數
  if (!databaseUrl) {
    console.error('❌ 錯誤：DATABASE_URL 環境變數未設置');
    console.log('\n請設置測試數據庫連接字串：');
    console.log('  export DATABASE_URL="postgresql://user:password@localhost:5432/zentropy_test"');
    console.log('\n或使用現有的開發數據庫（不建議，會影響開發數據）：');
    console.log('  export DATABASE_URL="postgresql://postgres:your_password@localhost:5432/zentropy"');
    process.exit(1);
  }

  // 2. 解析數據庫 URL
  const dbInfo = parseDatabaseUrl(databaseUrl);
  console.log('🔍 檢查測試數據庫連接...');
  console.log(`   Host: ${dbInfo.host}:${dbInfo.port}`);
  console.log(`   Database: ${dbInfo.database}`);
  console.log(`   User: ${dbInfo.user}`);

  // 3. 嘗試連接
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  try {
    // 執行簡單查詢測試連接
    await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ 數據庫連接成功！\n');
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ 數據庫連接失敗！\n');

    if (error instanceof Error) {
      const errorMsg = error.message;

      // 針對常見錯誤提供解決方案
      if (errorMsg.includes('ECONNREFUSED')) {
        console.error('錯誤：無法連接到數據庫服務器');
        console.log('\n可能的原因：');
        console.log('1. PostgreSQL 服務未啟動');
        console.log('   解決方法：brew services start postgresql@15');
        console.log('');
        console.log('2. 端口號錯誤');
        console.log('   檢查：psql -l 或查看 PostgreSQL 配置');
      } else if (errorMsg.includes('password authentication failed')) {
        console.error('錯誤：密碼認證失敗');
        console.log('\n解決方法：');
        console.log('1. 確認數據庫用戶密碼正確');
        console.log('2. 重新設置 DATABASE_URL');
      } else if (errorMsg.includes('database') && errorMsg.includes('does not exist')) {
        console.error(`錯誤：數據庫 "${dbInfo.database}" 不存在`);
        console.log('\n解決方法：');
        console.log(`1. 創建數據庫：createdb ${dbInfo.database}`);
        console.log(`2. 或執行 SQL：CREATE DATABASE ${dbInfo.database};`);
        console.log('3. 運行 Prisma migrations：npm run prisma:migrate');
      } else {
        console.error('詳細錯誤：', errorMsg);
      }
    }

    console.log('\n📚 完整設置指南：tests/integration/SETUP_LOCAL_DB.md\n');
    await prisma.$disconnect();
    process.exit(1);
  }
}

/**
 * 解析數據庫 URL
 */
function parseDatabaseUrl(url: string): {
  host: string;
  port: string;
  database: string;
  user: string;
} {
  try {
    // postgresql://user:password@host:port/database
    const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);

    if (match) {
      return {
        user: match[1],
        host: match[3],
        port: match[4],
        database: match[5],
      };
    }

    // 簡化格式
    return {
      host: 'localhost',
      port: '5432',
      database: url.split('/').pop() || 'unknown',
      user: 'postgres',
    };
  } catch {
    return {
      host: 'unknown',
      port: 'unknown',
      database: 'unknown',
      user: 'unknown',
    };
  }
}

// 執行檢查
checkTestDatabase()
  .catch((error) => {
    console.error('❌ 檢查腳本執行失敗:', error);
    process.exit(1);
  });
