/**
 * Zentropy 真實 Web UI 操作錄製腳本
 *
 * 使用 Playwright 自動化操作真實的 Web 應用並錄製成影片
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// 配置
const CONFIG = {
  baseUrl: 'http://localhost:3000',
  videoDir: path.join(__dirname, '..', 'demo-videos'),
  videoFile: 'zentropy-tagging-demo.webm',
  viewport: { width: 1920, height: 1080 },
  slowMo: 500, // 每個操作延遲 500ms（讓動畫更清楚）
};

// 確保影片目錄存在
if (!fs.existsSync(CONFIG.videoDir)) {
  fs.mkdirSync(CONFIG.videoDir, { recursive: true });
}

async function recordDemo() {
  console.log('🎬 開始錄製 Zentropy 真實操作演示...\n');

  // 啟動瀏覽器（開啟錄影）
  const browser = await chromium.launch({
    headless: false, // 顯示瀏覽器視窗
    slowMo: CONFIG.slowMo,
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
    // ============================================================
    // 步驟 1: 開啟首頁
    // ============================================================
    console.log('📍 步驟 1: 開啟 Zentropy 首頁...');
    await page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // ============================================================
    // 步驟 2: 快速登入（匿名或 Demo）
    // ============================================================
    console.log('📍 步驟 2: 登入系統...');

    // 檢查是否有「快速開始」或「匿名登入」按鈕
    const quickStartButton = await page.locator('button:has-text("快速體驗")').first();
    if (await quickStartButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await quickStartButton.click();
      await page.waitForTimeout(2000);
    } else {
      // 或者使用 demo 帳號登入
      console.log('   使用 Demo 流程進入...');
      // 這裡可以根據實際登入流程調整
      await page.goto(`${CONFIG.baseUrl}/dashboard`, { waitUntil: 'networkidle' });
    }

    // ============================================================
    // 步驟 3: 等待 Dashboard 載入
    // ============================================================
    console.log('📍 步驟 3: 等待 Dashboard 載入...');
    await page.waitForURL(/dashboard/, { timeout: 10000 });
    await page.waitForTimeout(1500);

    // ============================================================
    // 步驟 4: 找到快速輸入框
    // ============================================================
    console.log('📍 步驟 4: 尋找快速輸入框...');

    // 嘗試找到輸入框（可能的選擇器）
    const inputSelectors = [
      'textarea[placeholder*="輸入"]',
      'input[placeholder*="輸入"]',
      'textarea',
      '[data-testid="quick-input"]',
    ];

    let inputBox = null;
    for (const selector of inputSelectors) {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
        inputBox = element;
        console.log(`   ✅ 找到輸入框: ${selector}`);
        break;
      }
    }

    if (!inputBox) {
      // 如果找不到，嘗試點擊「新增」按鈕
      const addButton = page.locator('button:has-text("新增"), button:has-text("+")').first();
      if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('   點擊「新增」按鈕...');
        await addButton.click();
        await page.waitForTimeout(500);

        // 再次尋找輸入框
        inputBox = page.locator('textarea, input[type="text"]').first();
      }
    }

    if (!inputBox || !(await inputBox.isVisible({ timeout: 1000 }).catch(() => false))) {
      throw new Error('❌ 找不到輸入框！請確保 Dashboard 已正確載入。');
    }

    // ============================================================
    // 步驟 5: 輸入文字（模擬打字）
    // ============================================================
    console.log('📍 步驟 5: 輸入示範文字...');
    const demoText = '明天下午要跟客戶開會討論新產品方案';

    await inputBox.click();
    await page.waitForTimeout(500);

    // 逐字輸入（模擬真實打字）
    for (const char of demoText) {
      await inputBox.type(char, { delay: 100 });
    }

    await page.waitForTimeout(1000);

    // ============================================================
    // 步驟 6: 提交並等待 AI 處理
    // ============================================================
    console.log('📍 步驟 6: 提交並等待 AI 處理...');

    // 尋找提交按鈕
    const submitButton = page.locator('button:has-text("送出"), button:has-text("發送"), button[type="submit"]').first();
    if (await submitButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await submitButton.click();
    } else {
      // 或使用 Enter 鍵
      await inputBox.press('Enter');
    }

    // 等待 AI 處理動畫
    console.log('   ⏳ 等待 AI 分析...');
    await page.waitForTimeout(3000);

    // ============================================================
    // 步驟 7: 等待標籤出現
    // ============================================================
    console.log('📍 步驟 7: 等待標籤顯示...');

    // 等待任務卡片或標籤出現
    const taskCard = page.locator('[data-testid*="task"], .task-card, [class*="Task"]').first();
    await taskCard.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {
      console.log('   ⚠️  未找到任務卡片，繼續等待...');
    });

    await page.waitForTimeout(2000);

    // ============================================================
    // 步驟 8: 展示結果（放大或高亮標籤）
    // ============================================================
    console.log('📍 步驟 8: 展示標籤結果...');

    // 可以點擊任務查看詳情（如果有的話）
    if (await taskCard.isVisible().catch(() => false)) {
      await taskCard.hover();
      await page.waitForTimeout(1500);
    }

    // ============================================================
    // 步驟 9: 完成
    // ============================================================
    console.log('📍 步驟 9: 錄製完成！');
    await page.waitForTimeout(2000);

  } catch (error) {
    console.error('❌ 錄製過程中發生錯誤:', error.message);

    // 截圖以便除錯
    const screenshotPath = path.join(CONFIG.videoDir, 'error-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 錯誤截圖已儲存: ${screenshotPath}`);

    throw error;
  } finally {
    // 關閉瀏覽器（自動儲存影片）
    await context.close();
    await browser.close();

    console.log('\n✅ 錄製完成！');
    console.log(`📁 影片位置: ${CONFIG.videoDir}`);
    console.log('\n💡 提示: Playwright 會自動生成 .webm 影片檔案');
    console.log('   你可以在 demo-videos/ 目錄中找到它');
  }
}

// 執行錄製
recordDemo().catch((error) => {
  console.error('\n❌ 錄製失敗:', error);
  process.exit(1);
});
