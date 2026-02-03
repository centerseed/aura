import * as fs from 'fs';
import * as path from 'path';

// 載入 API Key
const envLocalPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envLocalPath, 'utf-8');
const apiKeyLine = envContent.split('\n').find(line => line.startsWith('GOOGLE_GENERATIVE_AI_API_KEY'));
const API_KEY = apiKeyLine?.split('=')[1]?.trim();

async function inspectAPIResponse() {
  const testText = '測試文本123';

  console.log(`🔍 檢查 API 完整響應...\n`);
  console.log(`測試文本: "${testText}"\n`);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${API_KEY}`;

  const requestBody = {
    model: 'models/text-embedding-004',
    content: {
      parts: [{ text: testText }]
    }
  };

  console.log('請求 Body:');
  console.log(JSON.stringify(requestBody, null, 2));
  console.log('');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  });

  console.log(`\nHTTP Status: ${response.status} ${response.statusText}`);
  console.log(`\nResponse Headers:`);
  response.headers.forEach((value, key) => {
    console.log(`  ${key}: ${value}`);
  });

  const data = await response.json();

  console.log(`\n完整 Response:`);
  console.log(JSON.stringify(data, null, 2));
}

inspectAPIResponse().catch(console.error);
