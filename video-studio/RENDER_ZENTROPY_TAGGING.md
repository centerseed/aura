# 🎬 Zentropy 標籤處理影片 - 渲染指南

## 影片內容

這支 10 秒的宣傳影片展示了 Zentropy 如何智能處理用戶輸入：

### 動畫流程（10 秒 / 300 幀）

1. **0-2秒**：用戶輸入出現
   - 打字機效果顯示：「明天下午要跟客戶開會討論新產品方案」
   - 現代卡片設計

2. **2-4秒**：Gatekeeper 分析
   - 加載動畫旋轉效果
   - 「Gatekeeper 分析中...」提示

3. **4-8秒**：標籤逐一彈出
   - Entity: Project（紫色）
   - Status: Active（綠色）
   - Type: Meeting（琥珀色）
   - Priority: High（紅色）
   - Spring 彈跳動畫 + 發光效果

4. **8-10秒**：完整結果展示
   - 所有標籤完整呈現

### 設計特色

- 🎨 深色主題（slate-900 背景）
- ✨ 網格背景裝飾
- 🌈 彩色標籤系統
- 💫 流暢的 Spring 動畫
- 🎯 專業的光影效果

---

## 🚀 快速渲染

### 方法 1：即時預覽（推薦先看效果）

```bash
cd /Users/wubaizong/Naruvia/video-studio
npm run dev
```

瀏覽器會開啟 `http://localhost:3000`，選擇 **"ZentropyTagging"** 組合即可預覽。

### 方法 2：渲染高品質影片

```bash
cd /Users/wubaizong/Naruvia/video-studio

# 標準渲染（1080p, 30fps）
npx remotion render ZentropyTagging out/zentropy-tagging.mp4

# 高品質渲染（較慢但更清晰）
npx remotion render ZentropyTagging out/zentropy-tagging-hq.mp4 --quality=90

# 快速預覽渲染（降低品質換取速度）
npx remotion render ZentropyTagging out/zentropy-tagging-preview.mp4 --quality=60 --concurrency=8
```

### 方法 3：不同尺寸版本

```bash
# Instagram 方形版本（1:1）
npx remotion render ZentropyTagging out/zentropy-tagging-ig.mp4 --width=1080 --height=1080

# Twitter 版本（16:9）
npx remotion render ZentropyTagging out/zentropy-tagging-twitter.mp4 --width=1280 --height=720

# 手機直式版本（9:16）
npx remotion render ZentropyTagging out/zentropy-tagging-vertical.mp4 --width=1080 --height=1920
```

---

## 📊 渲染預估時間

在 MacBook Pro（M1/M2）上：
- **標準渲染**：約 20-30 秒
- **高品質渲染**：約 40-60 秒
- **快速預覽**：約 10-15 秒

---

## 🎨 自訂調整

### 修改用戶輸入文字

編輯 `src/ZentropyTagging.tsx:17`：

```typescript
const userInput = "你的自訂文字";
```

### 修改標籤內容

編輯 `src/ZentropyTagging.tsx:147-152`：

```typescript
const tags = [
  { label: 'Entity', value: 'Project', color: '#8b5cf6', delay: 0 },
  { label: 'Status', value: 'Active', color: '#10b981', delay: 20 },
  // 新增或修改標籤...
];
```

### 修改配色

可用的 Tailwind 色系：
- Blue: `#3b82f6`
- Green: `#10b981`
- Violet: `#8b5cf6`
- Red: `#ef4444`
- Amber: `#f59e0b`
- Pink: `#ec4899`

### 調整動畫速度

編輯 Spring 彈簧配置：

```typescript
spring({
  frame,
  fps,
  config: {
    damping: 100,   // 增加 = 更快停止
    stiffness: 300, // 增加 = 更有彈性
  },
})
```

---

## 📦 匯出建議

### 社群媒體規格

| 平台 | 尺寸 | 長度 | 建議 |
|------|------|------|------|
| Twitter | 1280x720 | 10s | 標準版本即可 |
| Instagram Feed | 1080x1080 | 10s | 方形版本 |
| Instagram Story | 1080x1920 | 10s | 直式版本 |
| LinkedIn | 1920x1080 | 10s | 標準版本 |
| YouTube | 1920x1080 | 10s | 高品質版本 |

### 檔案大小優化

```bash
# 使用較低品質（檔案更小）
npx remotion render ZentropyTagging out/zentropy-tagging.mp4 --quality=70

# 或使用 H.265 編碼（需支援）
npx remotion render ZentropyTagging out/zentropy-tagging.mp4 --codec=h265
```

---

## 🐛 故障排除

### 問題：CSS 動畫不生效

確保 `global.css` 已在 `index.ts` 中引入：

```typescript
import './global.css';
```

### 問題：標籤顏色不正確

檢查 `ZentropyTagging.tsx` 中的 `color` 屬性是否使用正確的十六進位色碼。

### 問題：動畫卡頓

1. 降低並發數：`--concurrency=4`
2. 降低品質：`--quality=60`
3. 關閉其他應用程式釋放記憶體

---

## 🎯 下一步

1. ✅ 先用 `npm run dev` 預覽效果
2. 🎨 根據需求調整文字或顏色
3. 📹 渲染最終版本
4. 📤 分享到社群媒體

---

**影片規格**：
- 解析度：1920x1080 (Full HD)
- 幀率：30 fps
- 時長：10 秒（300 幀）
- 格式：MP4 (H.264)

**預估檔案大小**：約 2-5 MB（依品質設定）
