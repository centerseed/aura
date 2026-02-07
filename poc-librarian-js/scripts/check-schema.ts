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

    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'poc_librarian' 
        AND table_name = 'corrections'
      ORDER BY ordinal_position
    `)
    
    console.log('corrections 表欄位：')
    result.rows.forEach((r: any) => {
      console.log(`  ${r.column_name}: ${r.data_type}`)
    })
  } finally {
    await client.end()
  }
}

main()
