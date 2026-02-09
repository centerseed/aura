/**
 * Image Understanding Service
 *
 * 使用 Gemini 2.5 Flash multimodal 辨識圖片內容，
 * 提取結構化任務項目供 Brain Dump 管線使用。
 */

import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

// ============================================================================
// Schema 定義
// ============================================================================

const ExtractedItemSchema = z.object({
  title: z.string().describe("任務標題（簡潔明確）"),
  description: z.string().describe("任務描述或補充說明"),
  date: z.string().optional().describe("日期（ISO date 格式，如 2026-02-10）"),
  time: z.string().optional().describe("時間（HH:mm 格式）"),
  priority: z.enum(["high", "medium", "low"]).describe("優先級"),
  visual_cues: z.array(z.string()).describe("圖片中的視覺線索（顏色標記、圖示等）"),
  category: z.string().describe("分類（如：交通、住宿、觀光、會議等）"),
  sub_items: z.array(z.string()).describe("子項目（如果有的話）"),
  notes: z.string().describe("額外備註"),
});

const ImageUnderstandingResultSchema = z.object({
  image_type: z.enum(["itinerary", "meeting_notes", "todo_list", "whiteboard", "other"])
    .describe("圖片類型"),
  confidence: z.number().min(0).max(1).describe("辨識信心度"),
  extracted_text: z.string().describe("從圖片提取的原始文字內容"),
  extracted_items: z.array(ExtractedItemSchema).describe("提取的任務項目"),
  context: z.object({
    overall_theme: z.string().describe("整體主題描述"),
    date_range: z.object({
      start: z.string().describe("開始日期（ISO date）"),
      end: z.string().describe("結束日期（ISO date）"),
    }).optional().describe("日期範圍（如果有的話）"),
  }),
});

export type ImageUnderstandingResult = z.infer<typeof ImageUnderstandingResultSchema>;
export type ExtractedItem = z.infer<typeof ExtractedItemSchema>;

// ============================================================================
// 常數
// ============================================================================

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const SUPPORTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type SupportedMimeType = typeof SUPPORTED_MIME_TYPES[number];

// ============================================================================
// 主要函式
// ============================================================================

/**
 * 辨識圖片內容並提取結構化任務項目
 */
export async function understandImage(
  imageBuffer: Buffer,
  mimeType: string,
  supplementaryText?: string,
): Promise<ImageUnderstandingResult> {
  // 驗證圖片大小
  if (imageBuffer.length > MAX_IMAGE_SIZE) {
    throw new Error(`圖片大小超過限制（最大 ${MAX_IMAGE_SIZE / 1024 / 1024}MB）`);
  }

  // 驗證 MIME 類型
  if (!SUPPORTED_MIME_TYPES.includes(mimeType as SupportedMimeType)) {
    throw new Error(`不支援的圖片格式：${mimeType}。支援格式：${SUPPORTED_MIME_TYPES.join(", ")}`);
  }

  const base64Image = imageBuffer.toString("base64");

  const supplementaryPrompt = supplementaryText
    ? `\n\n用戶補充說明：「${supplementaryText}」\n請結合用戶說明來理解圖片內容。`
    : "";

  const { object: result } = await generateObject({
    model: google("gemini-2.5-flash"),
    schema: ImageUnderstandingResultSchema,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            image: base64Image,
            mimeType: mimeType as SupportedMimeType,
          },
          {
            type: "text",
            text: `你是一個專業的圖片內容分析助手。請仔細辨識這張圖片的內容。

# 任務

1. 判斷圖片類型（行程表、會議記錄、待辦清單、白板、其他）
2. 提取圖片中的所有文字內容
3. 將內容結構化為可執行的任務項目

# 提取規則

- **完整性**：不要遺漏圖片中的任何項目或細節
- **日期**：如果圖片中有日期資訊，請轉為 ISO date 格式（如 2026-02-10）
- **時間**：如果有時間資訊，請轉為 HH:mm 格式
- **分類**：根據項目性質自動分類（交通、住宿、觀光、餐飲、會議、工作等）
- **優先級**：根據視覺線索（顏色、星號、底線）和內容重要性判斷
- **子項目**：如果某個項目下有子步驟或細節，放入 sub_items
- **備註**：圖片中的備註、提醒、注意事項放入 notes

# 特殊處理

- **行程表**：每個時段/活動為一個 item，保留日期和時間
- **會議記錄**：每個 action item 為一個 item
- **待辦清單**：每個待辦事項為一個 item
- **白板**：每個獨立概念或任務為一個 item

# 語言

使用繁體中文輸出。如果圖片中有其他語言，翻譯後保留原文。${supplementaryPrompt}`,
          },
        ],
      },
    ],
  });

  return result;
}

/**
 * 將圖片理解結果轉為 Brain Dump 可處理的文字
 */
export function formatExtractedItemsAsText(result: ImageUnderstandingResult): string {
  const lines: string[] = [];

  // 加入整體主題
  lines.push(`【${result.context.overall_theme}】`);

  if (result.context.date_range) {
    lines.push(`日期範圍：${result.context.date_range.start} ~ ${result.context.date_range.end}`);
  }

  lines.push("");

  // 按日期分組
  const itemsByDate = new Map<string, ExtractedItem[]>();
  const noDateItems: ExtractedItem[] = [];

  for (const item of result.extracted_items) {
    if (item.date) {
      const existing = itemsByDate.get(item.date) || [];
      existing.push(item);
      itemsByDate.set(item.date, existing);
    } else {
      noDateItems.push(item);
    }
  }

  // 輸出有日期的項目
  for (const [date, items] of Array.from(itemsByDate.entries()).sort()) {
    lines.push(`📅 ${date}:`);
    for (const item of items) {
      const timeStr = item.time ? `${item.time} ` : "";
      lines.push(`- ${timeStr}${item.title}`);
      if (item.description) lines.push(`  ${item.description}`);
      if (item.sub_items.length > 0) {
        for (const sub of item.sub_items) {
          lines.push(`  - ${sub}`);
        }
      }
      if (item.notes) lines.push(`  備註：${item.notes}`);
    }
    lines.push("");
  }

  // 輸出無日期的項目
  if (noDateItems.length > 0) {
    for (const item of noDateItems) {
      lines.push(`- ${item.title}`);
      if (item.description) lines.push(`  ${item.description}`);
      if (item.sub_items.length > 0) {
        for (const sub of item.sub_items) {
          lines.push(`  - ${sub}`);
        }
      }
      if (item.notes) lines.push(`  備註：${item.notes}`);
    }
  }

  return lines.join("\n").trim();
}

/**
 * 驗證圖片檔案
 */
export function validateImage(size: number, mimeType: string): { valid: boolean; error?: string } {
  if (size > MAX_IMAGE_SIZE) {
    return { valid: false, error: `圖片大小超過限制（最大 ${MAX_IMAGE_SIZE / 1024 / 1024}MB，目前 ${(size / 1024 / 1024).toFixed(1)}MB）` };
  }
  if (!SUPPORTED_MIME_TYPES.includes(mimeType as SupportedMimeType)) {
    return { valid: false, error: `不支援的圖片格式：${mimeType}。支援格式：${SUPPORTED_MIME_TYPES.join(", ")}` };
  }
  return { valid: true };
}
