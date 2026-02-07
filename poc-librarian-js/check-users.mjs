import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './src/db/schema.ts';
import { eq, sql } from 'drizzle-orm';

const dbUrl = 'postgresql://neondb_owner:npg_6P2FyWpRZVcl@ep-patient-king-a1gfua8n-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
const client = neon(dbUrl);
const db = drizzle(client, { schema });

// 查詢 corrections 中的 userId 分佈
const corrections = await db.select({
  userId: schema.corrections.userId,
  count: sql`count(*)`.as('count')
}).from(schema.corrections).groupBy(schema.corrections.userId);

console.log('Corrections by userId:');
corrections.forEach(r => console.log(`  ${r.userId}: ${r.count} 筆`));

// 查詢 rules 中的 userId 分佈
const rules = await db.select({
  userId: schema.rules.userId,
  count: sql`count(*)`.as('count')
}).from(schema.rules).groupBy(schema.rules.userId);

console.log('\nRules by userId:');
rules.forEach(r => console.log(`  ${r.userId}: ${r.count} 筆`));
