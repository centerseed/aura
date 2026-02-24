import { config } from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// 載入環境變數
config({ path: '.env.local' });

// 初始化 Firebase Admin
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

// 處理私鑰格式（可能被引號包裹，且有 \n 轉義）
if (privateKey) {
  privateKey = privateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n');
}

initializeApp({
  credential: cert({
    projectId: projectId!,
    clientEmail: clientEmail!,
    privateKey: privateKey!,
  }),
});

// 切換測試目標
const API_BASE = process.argv[2] === 'local'
  ? 'http://localhost:3002'
  : 'https://api.zentropy.cc';

console.log(`Testing: ${API_BASE}\n`);
const UID = 'e9adcccc-e4ad-46d6-b92e-6018f5dc4b11';
const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
if (!FIREBASE_API_KEY) {
  throw new Error('NEXT_PUBLIC_FIREBASE_API_KEY environment variable is required');
}

async function testConcurrency() {
  // 生成 custom token 並交換為 ID token
  const customToken = await getAuth().createCustomToken(UID);

  // 用 custom token 交換 ID token
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  const data = await response.json() as { idToken?: string };
  const idToken = data.idToken;

  if (!idToken) {
    console.error('Failed to get ID token:', data);
    return;
  }

  console.log('Got ID token, testing concurrent requests to Cloud Run...\n');

  const headers = {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json',
  };

  // 測試新的 Dashboard API（單一請求）vs 舊的多請求模式
  const useDashboardApi = process.argv[3] === 'dashboard';

  const endpoints = useDashboardApi
    ? ['/api/dashboard']  // 新的單一請求
    : [
        '/api/library',
        '/api/milestones',
        '/api/tasks?completed_today=true',
      ];

  console.log(`Mode: ${useDashboardApi ? 'Dashboard API (單一請求)' : '多請求模式'}\n`);

  // 記錄開始時間
  const startTime = Date.now();
  console.log(`Start time: ${new Date().toISOString()}`);

  // 並發發送請求
  const promises = endpoints.map(async (endpoint, i) => {
    const reqStart = Date.now();
    console.log(`[${i}] ${endpoint} - sending at ${reqStart - startTime}ms`);

    const res = await fetch(`${API_BASE}${endpoint}`, { headers });
    const reqEnd = Date.now();

    console.log(`[${i}] ${endpoint} - completed at ${reqEnd - startTime}ms (took ${reqEnd - reqStart}ms, status: ${res.status})`);
    return { endpoint, start: reqStart - startTime, end: reqEnd - startTime, duration: reqEnd - reqStart };
  });

  const results = await Promise.all(promises);

  const totalTime = Date.now() - startTime;
  console.log(`\n=== Summary ===`);
  console.log(`Total time: ${totalTime}ms`);

  // 計算是否真的並發
  const maxDuration = Math.max(...results.map(r => r.duration));
  const sumDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`Sum of individual durations: ${sumDuration}ms`);
  console.log(`Max individual duration: ${maxDuration}ms`);
  console.log(`\nIf concurrent: total ≈ max (${maxDuration}ms)`);
  console.log(`If sequential: total ≈ sum (${sumDuration}ms)`);
  console.log(`\nActual ratio: ${(totalTime / maxDuration).toFixed(2)}x of max`);

  if (totalTime < sumDuration * 0.7) {
    console.log('✅ Requests appear to be CONCURRENT');
  } else {
    console.log('❌ Requests appear to be SEQUENTIAL');
  }
}

testConcurrency().catch(console.error);
