import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkTables() {
  try {
    // 檢查 calendar_events 表是否存在
    const calendarEvents = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'calendar_events'
      );
    `
    console.log('calendar_events 表:', calendarEvents)

    // 檢查 reminder_configs 表是否存在
    const reminderConfigs = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'reminder_configs'
      );
    `
    console.log('reminder_configs 表:', reminderConfigs)

    // 檢查 remindertypeenum 類型是否存在
    const reminderType = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM pg_type
        WHERE typname = 'remindertypeenum'
      );
    `
    console.log('remindertypeenum 類型:', reminderType)

  } catch (error) {
    console.error('檢查失敗:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkTables()
