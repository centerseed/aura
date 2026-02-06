/**
 * POC Librarian Engine - Base Adapter
 *
 * 定義 Librarian Adapter 的抽象基礎類別
 */

import type {
  LibrarianAdapter,
  ObserveEvent,
  RecallQuery,
  Rule,
} from '../core/types.js';

/**
 * Librarian Adapter 抽象基礎類別
 *
 * 不同專案透過實作不同的 Adapter 來使用 Librarian Engine：
 * - Naruvia: 任務分類規則學習
 * - Havital: 訓練對話壓縮（未來）
 */
export abstract class BaseLibrarianAdapter implements LibrarianAdapter {
  protected userId: string;
  protected domain: string;

  constructor(userId: string, domain: string = 'naruvia') {
    this.userId = userId;
    this.domain = domain;
  }

  /**
   * 記錄觀察事件（用戶修正）
   */
  abstract observe(event: ObserveEvent): Promise<void>;

  /**
   * 檢索相關規則
   */
  abstract recall(query: RecallQuery): Promise<Rule[]>;

  /**
   * 觸發蒸餾（背景任務）
   */
  abstract reflect(userId: string): Promise<Rule[]>;

  /**
   * 取得用戶 ID
   */
  getUserId(): string {
    return this.userId;
  }

  /**
   * 格式化輸入為標準格式
   */
  protected normalizeInput(input: string): string {
    return input.trim().toLowerCase();
  }

  /**
   * 檢查規則是否匹配輸入
   */
  protected checkRuleMatch(input: string, rule: Rule): boolean {
    const normalizedInput = this.normalizeInput(input);

    for (const condition of rule.triggerConditions) {
      // 解析 "contains:關鍵字" 格式
      if (condition.startsWith('contains:')) {
        const keyword = condition.replace('contains:', '').toLowerCase();
        if (normalizedInput.includes(keyword)) {
          return true;
        }
      }
    }

    return false;
  }
}
