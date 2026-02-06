/**
 * Domain Config - 從 DB 載入並快取各 domain 的蒸餾設定
 */

import { queryInSchema } from './db.js';
import type { DomainConfig } from './types.js';

const configCache = new Map<string, DomainConfig>();

/**
 * 從 DB 載入 domain config，帶記憶體快取
 */
export async function getDomainConfig(domain: string): Promise<DomainConfig> {
  const cached = configCache.get(domain);
  if (cached) return cached;

  const result = await queryInSchema<{
    domain: string;
    display_name: string;
    warm_threshold: number;
    distill_threshold: number;
    similarity_threshold: number;
    confidence_decay_days: number;
    categories: string[] | null;
    created_at: Date;
  }>(
    `SELECT * FROM domain_configs WHERE domain = $1`,
    [domain]
  );

  if (result.rows.length === 0) {
    throw new Error(`Unknown domain: ${domain}`);
  }

  const row = result.rows[0];
  const config: DomainConfig = {
    domain: row.domain,
    displayName: row.display_name,
    warmThreshold: row.warm_threshold,
    distillThreshold: row.distill_threshold,
    similarityThreshold: row.similarity_threshold,
    confidenceDecayDays: row.confidence_decay_days,
    categories: row.categories,
    createdAt: row.created_at,
  };

  configCache.set(domain, config);
  return config;
}

/**
 * 清除快取（用於測試或重載設定）
 */
export function clearDomainConfigCache(): void {
  configCache.clear();
}
