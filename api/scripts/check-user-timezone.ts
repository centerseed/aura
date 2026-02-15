import { prisma } from '../src/lib/db.js'

async function main() {
  const user = await prisma.user.findFirst({
    where: {
      id: '467c7125-d890-429f-b46f-168429b1907e'
    },
    select: {
      id: true,
      email: true,
      timezone: true,
      updated_at: true
    }
  })

  console.log('用戶資訊：')
  console.log(JSON.stringify(user, null, 2))

  // 檢查 Cron 執行邏輯
  const nowUTC = new Date()
  const tz = user?.timezone || 'Asia/Taipei'

  // 計算用戶當地時間
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })

  const parts = formatter.formatToParts(nowUTC)
  const localHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0')

  console.log(`\n當前時間分析：`)
  console.log(`UTC 時間: ${nowUTC.toISOString()}`)
  console.log(`用戶時區: ${tz}`)
  console.log(`用戶當地小時: ${localHour}`)
  console.log(`是否在晚報窗口 (19-23): ${localHour >= 19 && localHour <= 23}`)

  await prisma.$disconnect()
}

main().catch(console.error)
