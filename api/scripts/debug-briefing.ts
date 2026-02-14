import { prisma } from '../src/lib/db.js'

async function main() {
  const briefings = await prisma.coachBriefing.findMany({
    where: {
      type: 'EVENING'
    },
    orderBy: [
      { briefing_date: 'desc' },
      { created_at: 'desc' }
    ],
    take: 5,
    select: {
      id: true,
      briefing_date: true,
      created_at: true,
      type: true,
      user_id: true
    }
  })

  console.log('最近 5 筆晚報記錄：')
  console.log(JSON.stringify(briefings, null, 2))

  await prisma.$disconnect()
}

main().catch(console.error)
