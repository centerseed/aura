import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function runMigration() {
  const migrationPath = path.join(
    __dirname,
    '../prisma/migrations/20260208112407_add_calendar_event_and_reminder_tables/migration.sql'
  )

  const sql = fs.readFileSync(migrationPath, 'utf-8')

  // 移除註解並分割 SQL 語句
  const statements = sql
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)

  console.log(`執行 ${statements.length} 條 SQL 語句...`)

  try {
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement) {
        console.log(`[${i + 1}/${statements.length}] 執行...`)
        await prisma.$executeRawUnsafe(statement)
      }
    }
    console.log('✅ Migration 執行成功！')
  } catch (error) {
    console.error('❌ Migration 執行失敗:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

runMigration()
