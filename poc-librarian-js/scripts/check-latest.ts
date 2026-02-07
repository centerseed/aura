import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Client } = pg

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()

    console.log('\n📋 最新的 3 筆 corrections:')
    const corrections = await client.query(`
      SELECT id, LEFT(original_input, 40) as input, 
             ai_prediction, user_correction, created_at
      FROM poc_librarian.corrections 
      WHERE domain = 'naruvia'
      ORDER BY created_at DESC 
      LIMIT 3
    `)
    corrections.rows.forEach((c: any) => {
      const aiPred = typeof c.ai_prediction === 'string' ? c.ai_prediction : JSON.stringify(c.ai_prediction)
      const userCorr = typeof c.user_correction === 'string' ? c.user_correction : JSON.stringify(c.user_correction)
      console.log(`  ${c.created_at.toISOString().slice(0, 19)} | ${c.input}`)
      console.log(`    ${aiPred} → ${userCorr}`)
    })

    console.log('\n🔧 最新的 3 筆 rules:')
    const rules = await client.query(`
      SELECT id, pattern, correction, confidence, status, created_at
      FROM poc_librarian.rules 
      WHERE domain = 'naruvia'
      ORDER BY created_at DESC 
      LIMIT 3
    `)
    rules.rows.forEach((r: any) => {
      console.log(`  ${r.created_at.toISOString().slice(0, 19)} | [${r.status}] ${r.pattern} → ${r.correction} (${(r.confidence * 100).toFixed(0)}%)`)
    })
  } finally {
    await client.end()
  }
}

main()
