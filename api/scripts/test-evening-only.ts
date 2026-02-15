/**
 * 只測試 EVENING briefing，並且先暖機避免冷啟動
 */

import 'dotenv/config'
import { GenerateBriefingUseCase } from '../src/application/use-cases/coach/generate-briefing'

const USER_ID = '467c7125-d890-429f-b46f-168429b1907e' // 73 tasks

async function warmup() {
  console.log('🔥 Warming up...')
  const useCase = new GenerateBriefingUseCase()
  try {
    await useCase.execute({ userId: USER_ID, type: 'EVENING' })
    console.log('✅ Warmup complete\n')
  } catch (e) {
    // Ignore errors during warmup
    console.log('⚠️  Warmup had errors (expected), continuing...\n')
  }
}

async function testEvening() {
  console.log('🌙 Testing EVENING briefing (after warmup)...\n')

  const useCase = new GenerateBriefingUseCase()
  const start = Date.now()

  try {
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
  } catch (e) {
    const totalTime = Date.now() - start
    console.log('\n❌ Error:', (e as Error).message)
    console.log('  Time until error:', totalTime, 'ms')
    return totalTime
  }
}

async function main() {
  await warmup()
  const time = await testEvening()

  console.log('\n' + '='.repeat(60))
  console.log(`⏱️  EVENING briefing (warmed up): ${time}ms`)
  console.log('='.repeat(60))
}

main()
