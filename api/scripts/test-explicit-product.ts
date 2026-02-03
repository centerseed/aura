/**
 * 測試 @Product 標記功能
 */

const testCases = [
  "@Zentropy 修復所有flutter問題",
  "修復flutter所有問題",
  "@Paceriz 更新UI",
];

for (const text of testCases) {
  const productMentionRegex = /@(\S+)/g;
  const matches = Array.from(text.matchAll(productMentionRegex));
  const mentionedProductNames = matches.map(m => m[1]);
  const cleanedText = text.replace(productMentionRegex, '').trim();

  console.log(`\n輸入: "${text}"`);
  console.log(`提到的 Product: ${mentionedProductNames.join(', ') || '無'}`);
  console.log(`清理後的文字: "${cleanedText}"`);
}
