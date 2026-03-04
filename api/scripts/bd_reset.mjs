import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const UID = 'd8493e56-db97-4cfa-b18d-8c843b8574f3'

const r1 = await prisma.$executeRawUnsafe(`DELETE FROM sub_tasks WHERE task_id IN (SELECT id FROM tasks WHERE user_id = '${UID}')`)
const r2 = await prisma.$executeRawUnsafe(`DELETE FROM daily_plan_items WHERE task_id IN (SELECT id FROM tasks WHERE user_id = '${UID}')`)
const r3 = await prisma.$executeRawUnsafe(`DELETE FROM tasks WHERE user_id = '${UID}'`)
const r4 = await prisma.$executeRawUnsafe(`DELETE FROM topics WHERE product_id IN (SELECT id FROM products WHERE user_id = '${UID}')`)
const r5 = await prisma.$executeRawUnsafe(`DELETE FROM products WHERE user_id = '${UID}'`)
const r6 = await prisma.$executeRawUnsafe(`DELETE FROM daily_ai_usage WHERE user_id = '${UID}'`)
console.log(`Cleaned: sub_tasks=${r1} tasks=${r3} products=${r5} ai_usage=${r6}`)
await prisma.$disconnect()
