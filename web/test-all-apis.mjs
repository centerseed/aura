/**
 * 完整的 API 認證測試
 * 使用 Firebase 匿名登入測試所有 API 端點
 */

import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import * as dotenv from "dotenv";

// 載入環境變數
dotenv.config({ path: ".env.local" });

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

const BASE_URL = "http://localhost:3001";

let testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: []
};

async function getIdToken() {
  const user = auth.currentUser;
  if (!user) throw new Error("No user logged in");
  return await user.getIdToken();
}

async function testAPI(name, method, endpoint, options = {}) {
  testResults.total++;

  try {
    console.log(`\n測試 ${testResults.total}: ${method} ${endpoint}`);

    // 測試 1: 沒有 token 應該返回 401
    console.log("  ├─ 測試無 token...");
    const noAuthRes = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers: options.body ? { "Content-Type": "application/json" } : {},
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (noAuthRes.status !== 401) {
      console.log(`  ├─ ❌ 失敗: 無 token 應返回 401，實際返回 ${noAuthRes.status}`);
      testResults.failed++;
      testResults.details.push({
        name,
        endpoint,
        method,
        error: `無 token 應返回 401，實際返回 ${noAuthRes.status}`,
        passed: false
      });
      return;
    }
    console.log("  ├─ ✅ 無 token 正確返回 401");

    // 測試 2: 有效 token 應該成功
    console.log("  ├─ 測試有效 token...");
    const token = await getIdToken();
    const authRes = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers: {
        "Authorization": `Bearer ${token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const expectedStatuses = method === "POST" ? [200, 201] : method === "DELETE" ? [200, 204] : [200];
    if (!expectedStatuses.includes(authRes.status)) {
      const errorText = await authRes.text();
      console.log(`  ├─ ❌ 失敗: 有效 token 應返回 ${expectedStatuses.join("/")}，實際返回 ${authRes.status}`);
      console.log(`  └─ 錯誤: ${errorText.substring(0, 100)}`);
      testResults.failed++;
      testResults.details.push({
        name,
        endpoint,
        method,
        error: `返回 ${authRes.status}: ${errorText}`,
        passed: false
      });
      return;
    }

    console.log(`  └─ ✅ 有效 token 正確返回 ${authRes.status}`);
    testResults.passed++;
    testResults.details.push({
      name,
      endpoint,
      method,
      passed: true
    });

  } catch (error) {
    console.log(`  └─ ❌ 異常: ${error.message}`);
    testResults.failed++;
    testResults.details.push({
      name,
      endpoint,
      method,
      error: error.message,
      passed: false
    });
  }
}

async function runTests() {
  console.log("=" .repeat(60));
  console.log("開始 API 認證測試");
  console.log("=" .repeat(60));

  // 匿名登入
  console.log("\n📝 執行匿名登入...");
  const userCred = await signInAnonymously(auth);
  console.log(`✅ 登入成功: ${userCred.user.uid}`);

  // 創建測試用戶
  const token = await getIdToken();
  const signinRes = await fetch(`${BASE_URL}/api/auth/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "anonymous",
      providerId: userCred.user.uid,
      name: "Test User",
    }),
  });
  const userData = await signinRes.json();
  console.log(`✅ 測試用戶創建: ${userData.id}\n`);

  console.log("=" .repeat(60));
  console.log("開始測試 API 端點");
  console.log("=" .repeat(60));

  // 測試所有 GET 端點
  await testAPI("取得用戶資訊", "GET", "/api/me");
  await testAPI("取得 Library", "GET", "/api/library");
  await testAPI("取得 Areas", "GET", "/api/areas");
  await testAPI("取得 Tasks", "GET", "/api/tasks");
  await testAPI("取得 Milestones", "GET", "/api/milestones");
  await testAPI("取得 Evaluation Logs", "GET", "/api/evaluation/logs");

  // 測試 POST 端點 - Areas
  await testAPI("創建 Area", "POST", "/api/areas", {
    body: {
      name: "測試領域",
      scope: "測試範圍",
      description: "這是測試"
    }
  });

  // 取得剛創建的 Area
  const areasRes = await fetch(`${BASE_URL}/api/areas`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const areas = await areasRes.json();
  const testArea = areas.find(a => a.name === "測試領域");

  if (testArea) {
    // 測試 Product 相關
    await testAPI("創建 Product", "POST", "/api/products", {
      body: {
        areaId: testArea.id,
        name: "測試專案",
        status: "ACTIVE",
        lifecycle: "FINITE"
      }
    });

    await testAPI("Product 重新排序", "POST", "/api/products/reorder", {
      body: {
        productIds: []
      }
    });

    await testAPI("AI 推薦專案名稱", "POST", "/api/suggest-product", {
      body: {
        taskDescription: "測試任務描述",
        userId: userData.id
      }
    });

    // 測試 Task 相關
    await testAPI("Brain Dump", "POST", "/api/brain-dump", {
      body: {
        text: "這是測試任務",
        userId: userData.id
      }
    });

    await testAPI("調整標籤", "POST", "/api/adjust-tags", {
      body: {
        text: "測試調整",
        userId: userData.id
      }
    });

    await testAPI("重新組織", "POST", "/api/reorganize", {
      body: {
        text: "測試重組",
        userId: userData.id
      }
    });

    // 測試 Task PATCH
    await testAPI("更新 Task", "PATCH", "/api/tasks", {
      body: {
        id: "test-task-id",
        updates: {}
      }
    });

    // 測試 Area PATCH
    await testAPI("更新 Area", "PATCH", `/api/areas/${testArea.id}`, {
      body: {
        name: "更新後的測試領域"
      }
    });

    // 取得 Products 來測試 Product 相關 API
    const productsRes = await fetch(`${BASE_URL}/api/areas`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const areasWithProducts = await productsRes.json();
    const areaWithProduct = areasWithProducts.find(a => a.products && a.products.length > 0);

    if (areaWithProduct && areaWithProduct.products[0]) {
      const testProduct = areaWithProduct.products[0];

      await testAPI("更新 Product", "PATCH", `/api/products/${testProduct.id}`, {
        body: {
          name: "更新後的專案名稱"
        }
      });

      await testAPI("Product 重組主題", "POST", `/api/products/${testProduct.id}/reorganize-topics`, {
        body: {}
      });

      await testAPI("預覽最近刪除的 Tasks", "GET", `/api/products/${testProduct.id}/restore-recent-tasks?minutes=10`);

      await testAPI("恢復最近刪除的 Tasks", "POST", `/api/products/${testProduct.id}/restore-recent-tasks`, {
        body: {
          minutes: 10
        }
      });
    }
  }

  // 測試 Milestone 相關
  await testAPI("創建 Milestone", "POST", "/api/milestones", {
    body: {
      name: "測試里程碑",
      target_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      entity_type: "area"
    }
  });

  // 測試 Users API
  await testAPI("創建用戶", "POST", "/api/users", {
    body: {
      firebaseUid: "test-uid-" + Date.now(),
      email: null,
      name: "Test User",
      auth_provider: "ANONYMOUS"
    }
  });

  // 打印結果
  console.log("\n" + "=".repeat(60));
  console.log("測試結果摘要");
  console.log("=".repeat(60));
  console.log(`✅ 通過: ${testResults.passed} 個`);
  console.log(`❌ 失敗: ${testResults.failed} 個`);
  console.log(`📊 總計: ${testResults.total} 個`);
  console.log(`📈 成功率: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);

  if (testResults.failed > 0) {
    console.log("\n失敗的測試:");
    testResults.details
      .filter(t => !t.passed)
      .forEach(t => {
        console.log(`  ❌ ${t.method} ${t.endpoint}`);
        console.log(`     ${t.error}`);
      });
  }

  console.log("\n" + "=".repeat(60));

  process.exit(testResults.failed > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error("測試運行失敗:", error);
  process.exit(1);
});
