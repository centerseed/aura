import express from 'express'
import pg from 'pg'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = 3002

// 靜態檔案
app.use(express.static(path.join(__dirname, 'public')))

// API: 取得最新規則
app.get('/api/rules', async (req, res) => {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()

    const limit = parseInt(req.query.limit) || 10
    const result = await client.query(`
      SELECT
        id,
        user_id,
        description,
        trigger_conditions,
        result_action,
        confidence,
        is_active,
        created_at,
        times_applied,
        times_correct
      FROM poc_librarian.rules
      WHERE domain = 'naruvia'
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit])

    res.json({
      success: true,
      rules: result.rows
    })
  } catch (error) {
    console.error('查詢 rules 失敗:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  } finally {
    await client.end()
  }
})

// API: 取得最新修正記錄
app.get('/api/corrections', async (req, res) => {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()

    const limit = parseInt(req.query.limit) || 10
    const result = await client.query(`
      SELECT
        id,
        original_input,
        ai_prediction,
        user_correction,
        created_at
      FROM poc_librarian.corrections
      WHERE domain = 'naruvia'
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit])

    res.json({
      success: true,
      corrections: result.rows
    })
  } catch (error) {
    console.error('查詢 corrections 失敗:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  } finally {
    await client.end()
  }
})

// API: 取得統計資訊
app.get('/api/stats', async (req, res) => {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()

    // 規則統計
    const rulesStats = await client.query(`
      SELECT
        COUNT(*) as total_rules,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_rules,
        AVG(confidence) as avg_confidence,
        SUM(times_applied) as total_applications,
        SUM(times_correct) as total_correct
      FROM poc_librarian.rules
      WHERE domain = 'naruvia'
    `)

    // 修正統計
    const correctionsStats = await client.query(`
      SELECT
        COUNT(*) as total_corrections,
        COUNT(DISTINCT DATE(created_at)) as active_days
      FROM poc_librarian.corrections
      WHERE domain = 'naruvia'
    `)

    res.json({
      success: true,
      stats: {
        rules: rulesStats.rows[0],
        corrections: correctionsStats.rows[0]
      }
    })
  } catch (error) {
    console.error('查詢統計失敗:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  } finally {
    await client.end()
  }
})

app.listen(PORT, () => {
  console.log(`\n🔍 Librarian 監控面板啟動`)
  console.log(`📊 http://localhost:${PORT}`)
  console.log(`\n按 Ctrl+C 停止\n`)
})
