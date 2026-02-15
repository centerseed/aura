/**
 * 測試 Briefing 生成的實際性能
 *
 * 執行：cd api && npx tsx scripts/test-briefing-performance.ts
 */

import 'dotenv/config'
import { GenerateBriefingUseCase } from '../src/application/use-cases/coach/generate-briefing'

const USER_ID = '467c7125-d890-429f-b46f-168429b1907e' // 73 tasks

async function testEvening() {
  console.log('🌙 Testing EVENING briefing...\n')

  const useCase = new GenerateBriefingUseCase()
  const start = Date.now()

  const result = await useCase.execute({
    userId: USER_ID,
    type: 'EVENING',
  })

  const totalTime = Date.now() - start

  console.log('\n📊 Results:')
  console.log('  Summary:', result.briefing.summary.substring(0, 100) + '...')
  console.log('  Total time:', totalTime, 'ms')
  console.log('\n⏱️  Detailed timings:', result.timings)

  return totalTime
}

async function testMorning() {
  console.log('\n☀️  Testing MORNING briefing...\n')

  const useCase = new GenerateBriefingUseCase()
  const start = Date.now()

  const result = await useCase.execute({
    userId: USER_ID,
    type: 'MORNING',
  })

  const totalTime = Date.now() - start

  console.log('\n📊 Results:')
  console.log('  Summary:', result.briefing.summary.substring(0, 100) + '...')
  console.log('  Total time:', totalTime, 'ms')
  console.log('\n⏱️  Detailed timings:', result.timings)

  return totalTime
}

async function main() {
  console.log('=' .repeat(60))
  console.log('Briefing Performance Test')
  console.log('=' .repeat(60))

  const eveningTime = await testEvening()
  const morningTime = await testMorning()

  console.log('\n' + '='.repeat(60))
  console.log('📈 Summary:')
  console.log(`  Evening: ${eveningTime}ms`)
  console.log(`  Morning: ${morningTime}ms`)
  console.log('=' .repeat(60))
}

main().catch(console.error)
