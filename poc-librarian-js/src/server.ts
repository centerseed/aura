/**
 * Librarian Service - Express HTTP Server
 *
 * 將 Librarian Engine 包裝為 HTTP 微服務，
 * 讓 Naruvia 和 Paceriz 共用同一套規則學習引擎。
 */

import express from 'express';
import dotenv from 'dotenv';
import { createPool, closePool, validateDatabaseSafety } from './core/db.js';
import { getDomainConfig } from './core/domain-config.js';
import { createNaruviaAdapter } from './adapters/naruvia-adapter.js';
import { apiKeyAuth } from './middleware/auth.js';

dotenv.config();

const app = express();
app.use(express.json());
app.use(apiKeyAuth);

// ============================================================================
// Helper: 根據 domain 建立 adapter
// ============================================================================

async function createAdapterForDomain(userId: string, domain: string) {
  const config = await getDomainConfig(domain);
  return createNaruviaAdapter(userId, {
    domain,
    distillThreshold: config.distillThreshold,
    similarityThreshold: config.similarityThreshold,
    categories: config.categories,
  });
}

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /api/observe - 記錄用戶修正
 */
app.post('/api/observe', async (req, res) => {
  try {
    const { userId, domain, type, input, aiPrediction, userCorrection, originalTopic, correctedTopic } = req.body;

    if (!userId || !domain || !input) {
      res.status(400).json({ error: 'Missing required fields: userId, domain, input' });
      return;
    }

    const adapter = await createAdapterForDomain(userId, domain);
    await adapter.observe({
      userId,
      domain,
      type: type ?? 'correction',
      input,
      aiPrediction: aiPrediction ?? {},
      userCorrection: userCorrection ?? {},
      originalTopic: originalTopic ?? null,
      correctedTopic: correctedTopic ?? null,
    });

    res.json({ ok: true });
  } catch (err: any) {
    console.error('observe error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/recall - 檢索相關規則
 */
app.post('/api/recall', async (req, res) => {
  try {
    const { userId, domain, input, topK } = req.body;

    if (!userId || !domain || !input) {
      res.status(400).json({ error: 'Missing required fields: userId, domain, input' });
      return;
    }

    const adapter = await createAdapterForDomain(userId, domain);
    const rules = await adapter.recall({ userId, domain, input, topK });

    res.json({ rules });
  } catch (err: any) {
    console.error('recall error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/reflect - 觸發蒸餾
 */
app.post('/api/reflect', async (req, res) => {
  try {
    const { userId, domain } = req.body;

    if (!userId || !domain) {
      res.status(400).json({ error: 'Missing required fields: userId, domain' });
      return;
    }

    const adapter = await createAdapterForDomain(userId, domain);
    const rules = await adapter.reflect(userId);

    res.json({ rules });
  } catch (err: any) {
    console.error('reflect error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/rules/:userId - 取得用戶所有規則
 */
app.get('/api/rules/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const domain = (req.query.domain as string) ?? 'naruvia';

    const adapter = await createAdapterForDomain(userId, domain);
    const rules = await adapter.getRules();

    res.json({ rules });
  } catch (err: any) {
    console.error('getRules error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/health - 健康檢查
 */
app.get('/api/health', async (_req, res) => {
  try {
    const { queryInSchema } = await import('./core/db.js');
    await queryInSchema('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (err: any) {
    res.status(503).json({ status: 'unhealthy', error: err.message });
  }
});

// ============================================================================
// Server Startup
// ============================================================================

const PORT = parseInt(process.env.PORT ?? '8080', 10);

async function start() {
  console.log('🚀 Librarian Service starting...');

  await createPool();
  await validateDatabaseSafety();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Librarian Service listening on port ${PORT}`);
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await closePool();
  process.exit(0);
});

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});

export { app };
