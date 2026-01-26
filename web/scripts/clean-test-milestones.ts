import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // 刪除所有測試 milestone
    const result = await prisma.milestone.deleteMany({});
    console.log(`Deleted ${result.count} test milestones`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
