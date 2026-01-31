#!/usr/bin/env node
/**
 * 批量修復 web/ 測試以符合新的 API 回應格式
 *
 * 新格式：
 * - 成功: {success: true, data: {...}, meta: {timestamp}}
 * - 失敗: {success: false, error: {code, message, details}, meta: {timestamp}}
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

// 修正模式
const fixes = [
  // 1. 成功回應: data.id -> data.data.id
  {
    pattern: /expect\(data\)\.toHaveProperty\('(\w+)',\s*([^)]+)\)/g,
    replace: "expect(data.data).toHaveProperty('$1', $2)"
  },

  // 2. 成功回應: expect(data.xxx) -> expect(data.data.xxx)
  {
    pattern: /expect\(data\.(\w+)\)/g,
    replace: "expect(data.data.$1)"
  },

  // 3. 錯誤回應: data.error -> data.error.message (當 error 是字串時)
  {
    pattern: /expect\(data\)\.toHaveProperty\('error',\s*'([^']+)'\)/g,
    replace: "expect(data.error.message).toBe('$1')"
  },

  // 4. 錯誤回應: data.error 包含字串
  {
    pattern: /expect\(data\.error\)\.toContain\('([^']+)'\)/g,
    replace: "expect(data.error.message).toContain('$1')"
  },

  // 5. 驗證錯誤: data.error.field -> data.error.details.field
  {
    pattern: /expect\(data\.error\.field\)/g,
    replace: "expect(data.error.details?.field)"
  }
];

async function fixTestFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;

  for (const fix of fixes) {
    const newContent = content.replace(fix.pattern, fix.replace);
    if (newContent !== content) {
      content = newContent;
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✓ 修復: ${path.relative(process.cwd(), filePath)}`);
    return true;
  }

  return false;
}

async function main() {
  console.log('🔧 開始批量修復測試檔案...\n');

  const testFiles = await glob('web/tests/**/*.test.ts');
  let fixedCount = 0;

  for (const file of testFiles) {
    if (await fixTestFile(file)) {
      fixedCount++;
    }
  }

  console.log(`\n✅ 完成！共修復 ${fixedCount} 個測試檔案`);
  console.log('\n請執行 cd web && npm test 驗證結果');
}

main().catch(console.error);
