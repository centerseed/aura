# LINE Non-Text Message Fallback

**日期**: 2026-03-12

## 問題

使用者傳 LINE 貼圖後沒有任何回應。

## 根因

這個失敗是因為 `api/src/app/api/line/webhook/route.ts` 在入口直接判斷：

- `event.type !== "message"` 或
- `event.message?.type !== "text"`

就 `continue`。

因此貼圖、圖片、語音等非文字訊息完全不會進入任何回覆路徑。

## 本輪修正

1. 保留文字訊息既有流程
2. 對非文字訊息提供明確 fallback reply
3. 至少補上貼圖情境的 webhook 測試

## 非目標

- 不在本輪解析貼圖語意
- 不在本輪做圖片 OCR / 語音轉文字
