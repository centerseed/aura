#!/usr/bin/env node
import * as dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';

// 載入環境變數
dotenv.config({ path: '.env.local' });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// API 端點列表（按類別分組）
const API_ENDPOINTS = {
  '認證相關': [
    { method: 'GET', path: '/api/me', requiresAuth: true },
  ],
  '核心資料': [
    { method: 'GET', path: '/api/library', requiresAuth: true },
    { method: 'GET', path: '/api/areas', requiresAuth: true },
    { method: 'POST', path: '/api/areas', requiresAuth: true, body: { name: 'Test Area', scope: 'personal' } },
    { method: 'GET', path: '/api/tasks', requiresAuth: true },
    { method: 'GET', path: '/api/milestones', requiresAuth: true },
  ],
  'Product 相關': [
    { method: 'POST', path: '/api/products', requiresAuth: true, needsAreaId: true },
    { method: 'POST', path: '/api/products/reorder', requiresAuth: true, body: { productIds: [] } },
    { method: 'POST', path: '/api/suggest-product', requiresAuth: true, body: { taskDescription: 'test' } },
  ],
  'Task 相關': [
    { method: 'PATCH', path: '/api/tasks', requiresAuth: true, body: {} },
    { method: 'POST', path: '/api/brain-dump', requiresAuth: true, body: { text: 'test' } },
    { method: 'POST', path: '/api/adjust-tags', requiresAuth: true, body: { text: 'test' } },
  ],
  'Reorganize 相關': [
    { method: 'POST', path: '/api/reorganize', requiresAuth: true, body: { text: 'test' } },
  ],
  '評估系統': [
    { method: 'GET', path: '/api/evaluation/logs', requiresAuth: true },
  ],
  '用戶管理': [
    { method: 'POST', path: '/api/users', requiresAuth: true, body: {} },
  ],
};

async function testEndpoint(method, path, token = null, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers,
  };

  if (body && (method === 'POST' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(`${BASE_URL}${path}`, options);
    return { status: res.status, ok: res.ok };
  } catch (error) {
    return { status: 0, ok: false, error: error.message };
  }
}

console.log('============================================================');
console.log('完整 API 認證測試');
console.log('============================================================\n');

try {
  // 1. 登入
  console.log('📝 執行匿名登入...');
  const userCredential = await signInAnonymously(auth);
  const firebaseUid = userCredential.user.uid;
  const token = await userCredential.user.getIdToken();
  console.log(`✅ 登入成功: ${firebaseUid}\n`);

  // 2. 創建測試用戶
  const createUserRes = await fetch(`${BASE_URL}/api/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      firebaseUid,
      email: null,
      name: null,
      auth_provider: 'ANONYMOUS',
    }),
  });

  let userId = null;
  if (createUserRes.ok) {
    const userData = await createUserRes.json();
    userId = userData.user?.id;
    console.log(`✅ 測試用戶創建: ${userId}\n`);
  }

  // 3. 創建測試 Area (用於後續測試)
  let testAreaId = null;
  const createAreaRes = await fetch(`${BASE_URL}/api/areas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: 'Test Area for API Testing',
      scope: 'personal',
    }),
  });

  if (createAreaRes.ok) {
    const areaData = await createAreaRes.json();
    testAreaId = areaData.area?.id;
    console.log(`✅ 測試 Area 創建: ${testAreaId}\n`);
  }

  console.log('============================================================');
  console.log('開始測試所有 API 端點');
  console.log('============================================================\n');

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  const failedEndpoints = [];

  for (const [category, endpoints] of Object.entries(API_ENDPOINTS)) {
    console.log(`\n📁 ${category}`);
    console.log('─'.repeat(60));

    for (const endpoint of endpoints) {
      const { method, path, requiresAuth, body, needsAreaId } = endpoint;

      // 準備請求 body
      let testBody = body;
      if (needsAreaId && testAreaId) {
        testBody = {
          ...body,
          areaId: testAreaId,
          name: 'Test Product',
          status: 'ACTIVE',
          lifecycle: 'FINITE',
        };
      }
      if (testBody && userId && testBody.userId === undefined) {
        // 某些 API 可能需要 userId，但新架構不應該需要
      }

      totalTests += 2; // 每個端點測試兩次：無 token 和有 token

      console.log(`\n${method} ${path}`);

      // 測試 1: 無 token
      const noTokenResult = await testEndpoint(method, path, null, testBody);
      if (noTokenResult.status === 401) {
        console.log(`  ├─ ✅ 無 token 正確返回 401`);
        passedTests++;
      } else {
        console.log(`  ├─ ❌ 無 token 返回 ${noTokenResult.status} (預期 401)`);
        failedTests++;
        failedEndpoints.push({ method, path, type: 'no-token', got: noTokenResult.status });
      }

      // 測試 2: 有效 token
      const withTokenResult = await testEndpoint(method, path, token, testBody);
      if (withTokenResult.status === 200 || withTokenResult.status === 201) {
        console.log(`  └─ ✅ 有效 token 正確返回 ${withTokenResult.status}`);
        passedTests++;
      } else if (withTokenResult.status === 400) {
        // 400 可能是因為缺少必要參數，但至少通過了認證
        console.log(`  └─ ⚠️  有效 token 返回 400 (可能缺少參數，但已通過認證)`);
        passedTests++;
      } else {
        console.log(`  └─ ❌ 有效 token 返回 ${withTokenResult.status} (預期 200/201)`);
        failedTests++;
        failedEndpoints.push({ method, path, type: 'with-token', got: withTokenResult.status });
      }
    }
  }

  // 4. 摘要
  console.log('\n\n============================================================');
  console.log('測試結果摘要');
  console.log('============================================================');
  console.log(`✅ 通過: ${passedTests} 個`);
  console.log(`❌ 失敗: ${failedTests} 個`);
  console.log(`📊 總計: ${totalTests} 個`);
  console.log(`📈 成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (failedEndpoints.length > 0) {
    console.log('\n❌ 失敗的端點：');
    for (const { method, path, type, got } of failedEndpoints) {
      console.log(`   - ${method} ${path} (${type}): 返回 ${got}`);
    }
  }

  console.log('\n============================================================\n');

  process.exit(failedTests > 0 ? 1 : 0);

} catch (error) {
  console.error('❌ 測試執行失敗:', error);
  process.exit(1);
}
