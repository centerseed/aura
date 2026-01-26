import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const userId = '467c7125-d890-429f-b46f-168429b1907e';

console.log('\n=== 測試修復結果 ===\n');

// 1. 檢查所有任務的 sub_items 位置
const tasks = await prisma.task.findMany({
  where: {
    user_id: userId,
    deleted_at: null
  },
  include: {
    product: true
  }
});

console.log(`總共 ${tasks.length} 個任務\n`);

let correctCount = 0;
let incorrectCount = 0;
let bothCount = 0;

tasks.forEach(task => {
  const dbSubItems = Array.isArray(task.sub_items) ? task.sub_items.length : 0;
  const aiSubItems = Array.isArray(task.ai_analysis?.sub_items) ? task.ai_analysis.sub_items.length : 0;

  if (dbSubItems > 0 && aiSubItems === 0) {
    correctCount++;
  } else if (dbSubItems === 0 && aiSubItems > 0) {
    incorrectCount++;
    console.log(`❌ 錯誤: ${task.content} (Product: ${task.product.name})`);
    console.log(`   sub_items 仍在 ai_analysis 中 (${aiSubItems} 個)\n`);
  } else if (dbSubItems > 0 && aiSubItems > 0) {
    bothCount++;
    console.log(`⚠️  警告: ${task.content} (Product: ${task.product.name})`);
    console.log(`   sub_items 同時存在兩個位置 (DB: ${dbSubItems}, AI: ${aiSubItems})\n`);
  }
});

console.log('\n=== 統計結果 ===');
console.log(`✅ 正確 (sub_items 在 task.sub_items): ${correctCount} 個`);
console.log(`❌ 錯誤 (sub_items 在 ai_analysis.sub_items): ${incorrectCount} 個`);
console.log(`⚠️  兩個位置都有: ${bothCount} 個`);
console.log(`🔵 沒有 sub_items: ${tasks.length - correctCount - incorrectCount - bothCount} 個`);

if (incorrectCount === 0 && bothCount === 0) {
  console.log('\n🎉 所有任務的 sub_items 位置都正確!');
} else if (incorrectCount > 0) {
  console.log('\n⚠️  發現錯誤! 有任務的 sub_items 仍在錯誤位置。');
  console.log('   這些可能是修復前創建的,需要運行資料遷移腳本。');
}

await prisma.$disconnect();
