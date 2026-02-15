import 'dotenv/config'
import { prisma } from '../src/lib/db'

async function main() {
  const users = await prisma.$queryRaw<Array<{ user_id: string; task_count: bigint }>>`
    SELECT
      user_id::text,
      COUNT(*) as task_count
    FROM tasks
    WHERE deleted_at IS NULL
    GROUP BY user_id
    ORDER BY task_count DESC
    LIMIT 5
  `

  console.log('📊 Users with most tasks:')
  for (const user of users) {
    console.log(`  ${user.user_id}: ${user.task_count} tasks`)
  }

  await prisma.$disconnect()
}

main()
