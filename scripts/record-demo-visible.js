/**
 * Zentropy 可視化錄製腳本
 *
 * 特點：
 * - 瀏覽器視窗會顯示在前景
 * - 每個步驟都有明顯延遲，讓你看清楚
 * - 在終端顯示進度
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const CONFIG = {
  baseUrl: 'http://localhost:3000',
  videoDir: path.join(__dirname, '..', 'demo-videos'),
  viewport: { width: 1920, height: 1080 },
  slowMo: 1000, // 每個操作延遲 1 秒（讓你看清楚）
};

if (!fs.existsSync(CONFIG.videoDir)) {
  fs.mkdirSync(CONFIG.videoDir, { recursive: true });
}

async function wait(ms, message) {
  if (message) console.log(`   ⏳ ${message}`);
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function recordDemo() {
  console.clear();
  console.log('╔════════════════════════════════════════╗');
  console.log('║  🎬 Zentropy 可視化錄製               ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');

  const browser = await chromium.launch({
    headless: false,
    slowMo: CONFIG.slowMo,
    args: [
      '--window-position=0,0',  // 視窗位置在左上角
      '--window-size=1920,1080', // 視窗大小
    ],
  });

  const context = await browser.newContext({
    viewport: CONFIG.viewport,
    recordVideo: {
      dir: CONFIG.videoDir,
      size: CONFIG.viewport,
    },
  });

  const page = await context.newPage();

  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📍 步驟 1/8: 開啟 Zentropy 首頁');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle' });
    await wait(2000, '等待頁面載入...');

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📍 步驟 2/8: 尋找登入方式');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 嘗試多種登入方式
    const loginMethods = [
      { selector: 'button:has-text("快速體驗")', name: '快速體驗' },
      { selector: 'button:has-text("開始使用")', name: '開始使用' },
      { selector: 'button:has-text("Demo")', name: 'Demo' },
      { selector: 'a[href="/dashboard"]', name: '直接進入 Dashboard' },
    ];

    let loginSuccess = false;
    for (const method of loginMethods) {
      const button = page.locator(method.selector).first();
      if (await button.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log(`   ✅ 找到「${method.name}」按鈕`);
        await button.click();
        await wait(2000, '登入中...');
        loginSuccess = true;
        break;
      }
    }

    if (!loginSuccess) {
      console.log('   ⚠️  未找到登入按鈕，直接前往 Dashboard');
      await page.goto(`${CONFIG.baseUrl}/dashboard`, { waitUntil: 'networkidle' });
      await wait(2000);
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📍 步驟 3/8: 等待 Dashboard 載入');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await page.waitForURL(/dashboard|\//, { timeout: 10000 }).catch(() => {});
    await wait(2000, 'Dashboard 載入中...');

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📍 步驟 4/8: 尋找輸入框');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 截圖以便除錯
    await page.screenshot({
      path: path.join(CONFIG.videoDir, 'step4-finding-input.png'),
      fullPage: true
    });
    console.log('   📸 已截圖: step4-finding-input.png');

    const inputSelectors = [
      'textarea[placeholder*="輸入"]',
      'textarea[placeholder*="想法"]',
      'textarea[placeholder*="任務"]',
      'input[placeholder*="輸入"]',
      'textarea',
      '[data-testid="quick-input"]',
      '[data-testid="quick-capture"]',
    ];

    let inputBox = null;
    for (const selector of inputSelectors) {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 500 }).catch(() => false)) {
        inputBox = element;
        console.log(`   ✅ 找到輸入框: ${selector}`);
        break;
      }
    }

    // 如果找不到，嘗試點擊「新增」按鈕
    if (!inputBox) {
      console.log('   ⚠️  未找到輸入框，嘗試點擊「新增」按鈕...');
      const addButtons = [
        'button:has-text("新增")',
        'button:has-text("+")',
        'button[aria-label*="新增"]',
        '[data-testid="add-task"]',
      ];

      for (const selector of addButtons) {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 500 }).catch(() => false)) {
          console.log(`   ✅ 找到按鈕: ${selector}`);
          await button.click();
          await wait(1000, '等待輸入框出現...');

          // 再次尋找輸入框
          inputBox = page.locator('textarea, input[type="text"]').first();
          if (await inputBox.isVisible({ timeout: 1000 }).catch(() => false)) {
            console.log('   ✅ 輸入框已出現');
            break;
          }
        }
      }
    }

    if (!inputBox || !(await inputBox.isVisible({ timeout: 1000 }).catch(() => false))) {
      throw new Error('❌ 找不到輸入框！請查看截圖 step4-finding-input.png');
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📍 步驟 5/8: 輸入示範文字');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const demoText = '明天下午要跟客戶開會討論新產品方案';
    console.log(`   📝 文字: "${demoText}"`);

    await inputBox.click();
    await wait(500);

    // 逐字輸入
    for (let i = 0; i < demoText.length; i++) {
      await inputBox.type(demoText[i], { delay: 150 });
      process.stdout.write(`\r   進度: ${i + 1}/${demoText.length} 字`);
    }
    console.log('\n   ✅ 輸入完成');

    await wait(1500);

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📍 步驟 6/8: 提交');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const submitSelectors = [
      'button:has-text("送出")',
      'button:has-text("發送")',
      'button:has-text("提交")',
      'button[type="submit"]',
    ];

    let submitButton = null;
    for (const selector of submitSelectors) {
      const button = page.locator(selector).first();
      if (await button.isVisible({ timeout: 500 }).catch(() => false)) {
        submitButton = button;
        console.log(`   ✅ 找到提交按鈕: ${selector}`);
        break;
      }
    }

    if (submitButton) {
      await submitButton.click();
      console.log('   ✅ 已點擊提交');
    } else {
      console.log('   ⚠️  未找到提交按鈕，使用 Enter 鍵');
      await inputBox.press('Enter');
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📍 步驟 7/8: 等待 AI 處理');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await wait(4000, 'AI 分析中...');

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📍 步驟 8/8: 展示結果');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 截圖結果
    await page.screenshot({
      path: path.join(CONFIG.videoDir, 'step8-result.png'),
      fullPage: true
    });
    console.log('   📸 已截圖: step8-result.png');

    await wait(3000, '展示結果中...');

    console.log('');
    console.log('╔════════════════════════════════════════╗');
    console.log('║  ✅ 錄製完成！                        ║');
    console.log('╚════════════════════════════════════════╝');

  } catch (error) {
    console.error('\n❌ 錯誤:', error.message);
    const screenshotPath = path.join(CONFIG.videoDir, 'error-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 錯誤截圖: ${screenshotPath}`);
    throw error;
  } finally {
    await context.close();
    await browser.close();

    console.log('\n📁 影片位置: demo-videos/');
    console.log('💡 找到最新的 .webm 檔案即可');
  }
}

recordDemo().catch(error => {
  console.error('\n❌ 執行失敗:', error);
  process.exit(1);
});
