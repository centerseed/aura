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

    console.log('\n📊 Rules 按 user_id 分組統計：\n')
    const result = await client.query(`
      SELECT
        user_id,
        COUNT(*) as rule_count,
        AVG(confidence) as avg_confidence
      FROM poc_librarian.rules
      WHERE domain = 'naruvia'
      GROUP BY user_id
      ORDER BY rule_count DESC
    `)

    result.rows.forEach((r: any) => {
      console.log(`  用戶: ${r.user_id}`)
      console.log(`    規則數: ${r.rule_count}`)
      console.log(`    平均信心度: ${(parseFloat(r.avg_confidence) * 100).toFixed(0)}%`)
      console.log()
    })

    console.log('\n📝 Corrections 按 user_id 分組統計：\n')
    const corrections = await client.query(`
      SELECT
        user_id,
        COUNT(*) as correction_count
      FROM poc_librarian.corrections
      WHERE domain = 'naruvia'
      GROUP BY user_id
      ORDER BY correction_count DESC
    `)

    corrections.rows.forEach((r: any) => {
      console.log(`  用戶: ${r.user_id}`)
      console.log(`    修正數: ${r.correction_count}`)
      console.log()
    })
  } finally {
    await client.end()
  }
}

main()
