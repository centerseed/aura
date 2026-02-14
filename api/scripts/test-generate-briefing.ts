import { GenerateBriefingUseCase } from '../src/application/use-cases/coach/generate-briefing.js'

async function main() {
  const userId = '467c7125-d890-429f-b46f-168429b1907e'

  console.log('測試生成 2/14 晚報...')

  const useCase = new GenerateBriefingUseCase()

  try {
    const result = await useCase.execute({
      userId,
      type: 'EVENING',
      // 不傳 date，讓它使用當前日期
      timezone: 'Asia/Taipei'
    })

    console.log('\n✅ 晚報生成成功！')
    console.log(`Briefing ID: ${result.briefing.id}`)
    console.log(`Briefing Date: ${result.briefing.briefingDate}`)
    console.log(`\n時間統計：`)
    console.log(JSON.stringify(result.timings, null, 2))
  } catch (error) {
    console.error('❌ 生成失敗：', error)
  }

  process.exit(0)
}

main().catch(console.error)
