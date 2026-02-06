/**
 * API Key 認證 middleware
 */

import type { Request, Response, NextFunction } from 'express';

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  const expectedKey = process.env.LIBRARIAN_API_KEY;

  if (!expectedKey) {
    // 若未設定 API key 則跳過驗證（開發模式）
    next();
    return;
  }

  if (!apiKey || apiKey !== expectedKey) {
    res.status(401).json({ error: 'Unauthorized: invalid or missing x-api-key' });
    return;
  }

  next();
}
