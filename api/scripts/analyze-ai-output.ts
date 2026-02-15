/**
 * 分析 AI 輸出的內容長度
 */

import 'dotenv/config'
import { GenerateBriefingUseCase } from '../src/application/use-cases/coach/generate-briefing'

const USER_ID = '467c7125-d890-429f-b46f-168429b1907e'

async function analyzeOutput() {
  console.log('🔍 Analyzing AI output size...\n')

  const useCase = new GenerateBriefingUseCase()

  try {
    const result = await useCase.execute({
      userId: USER_ID,
      type: 'EVENING',
    })

    const briefing = result.briefing

    console.log('📊 Output Analysis:')
    console.log('─'.repeat(60))

    // Summary
    console.log('\n📝 Summary:')
    console.log(`  Length: ${briefing.summary.length} chars`)
    console.log(`  Content: "${briefing.summary}"`)

    // Recommendations
    console.log('\n💡 Recommendations:')
    console.log(`  Count: ${briefing.recommendations.length}`)
    for (const rec of briefing.recommendations) {
      console.log(`  - Priority ${rec.priority}:`)
      console.log(`    Action (${rec.action.length} chars): "${rec.action}"`)
      console.log(`    Reasoning (${rec.reasoning.length} chars): "${rec.reasoning}"`)
    }

    // Defer Suggestions
    console.log('\n⏸️  Defer Suggestions:')
    console.log(`  Count: ${briefing.deferSuggestions.length}`)
    for (const sug of briefing.deferSuggestions) {
      console.log(`  - Task: ${sug.taskContent.substring(0, 50)}...`)
      console.log(`    Action: ${sug.suggestedAction}`)
      console.log(`    Reasoning (${sug.reasoning.length} chars): "${sug.reasoning}"`)
    }

    // Total output
    const totalChars =
      briefing.summary.length +
      briefing.recommendations.reduce((sum, r) => sum + r.action.length + r.reasoning.length, 0) +
      briefing.deferSuggestions.reduce((sum, s) => sum + s.reasoning.length, 0)

    console.log('\n📊 Total Stats:')
    console.log(`  Total output: ${totalChars} chars`)
    console.log(`  Total items: ${1 + briefing.recommendations.length + briefing.deferSuggestions.length}`)
    console.log(`  AI time: ${result.timings.ai}ms`)
    console.log(`  Chars per second: ${(totalChars / (result.timings.ai / 1000)).toFixed(0)}`)

  } catch (e) {
    console.error('Error:', (e as Error).message)
  }
}

analyzeOutput()
