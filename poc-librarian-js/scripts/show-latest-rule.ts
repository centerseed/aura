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

    console.log('\n🔧 最新的 rule:')
    const rules = await client.query(`
      SELECT id, description, trigger_conditions, result_action, 
             confidence, is_active, created_at
      FROM poc_librarian.rules 
      WHERE domain = 'naruvia'
      ORDER BY created_at DESC 
      LIMIT 1
    `)
    
    if (rules.rows.length > 0) {
      const r = rules.rows[0]
      console.log(`  時間: ${r.created_at.toISOString().slice(0, 19)}`)
      console.log(`  描述: ${r.description}`)
      console.log(`  觸發條件: ${JSON.stringify(r.trigger_conditions, null, 2)}`)
      console.log(`  執行動作: ${JSON.stringify(r.result_action, null, 2)}`)
      console.log(`  信心度: ${(r.confidence * 100).toFixed(0)}%`)
      console.log(`  狀態: ${r.is_active ? '啟用' : '停用'}`)
    }
  } finally {
    await client.end()
  }
}

main()
