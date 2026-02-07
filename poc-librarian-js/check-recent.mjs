import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { corrections } from './src/db/schema.ts';
import { eq, desc } from 'drizzle-orm';

const dbUrl = 'postgresql://neondb_owner:npg_6P2FyWpRZVcl@ep-patient-king-a1gfua8n-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
const client = neon(dbUrl);
const db = drizzle(client, { schema: { corrections } });

const recent = await db.select()
  .from(corrections)
  .where(eq(corrections.domain, 'naruvia'))
  .orderBy(desc(corrections.createdAt))
  .limit(5);

console.log('最新 5 筆 corrections:\n');
recent.forEach((c, i) => {
  console.log(`${i + 1}. userId: ${c.userId.substring(0, 25)}...`);
  console.log(`   input: ${c.input}`);
  console.log(`   aiPrediction: ${c.aiPrediction}`);
  console.log(`   userCorrection: ${c.userCorrection}`);
  console.log(`   時間: ${c.createdAt.toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'})}\n`);
});
