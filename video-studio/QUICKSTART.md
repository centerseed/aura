# 🚀 Remotion 快速上手指南

## 第一步：安裝完成確認

你已經完成安裝！現在可以開始製作影片了。

## 第二步：啟動 Remotion Studio

```bash
cd video-studio
npm run dev
```

瀏覽器會自動開啟 `http://localhost:3000`，你會看到：
- 📹 即時影片預覽
- ⏱️ 時間軸控制
- 🎨 參數調整面板

## 第三步：測試範例影片

1. 在 Remotion Studio 中，你會看到 "HelloWorld" 組合
2. 點擊播放按鈕查看動畫效果
3. 在右側面板調整參數：
   - `titleText`: 修改文字內容
   - `titleColor`: 修改文字顏色

## 第四步：渲染你的第一支影片

```bash
# 渲染預設設定
npm run render

# 或者自訂輸出
npx remotion render HelloWorld out/my-first-video.mp4
```

渲染完成後，影片會在 `video-studio/out/` 目錄。

## 🎯 用 Claude Code 快速生成影片

### 範例 1：產品介紹影片

在專案根目錄（或任何地方）跟 Claude Code 說：

```
用 Remotion 做一支 30 秒的 Naruvia 產品介紹影片，
包含以下內容：
1. 開場動畫顯示 "Naruvia - 讓一切井然有序"
2. 展示雙軸管理模型（Status × Entity）
3. 介紹三個 AI Agents：Gatekeeper, Librarian, Coach
4. 結束畫面顯示網站 URL

使用現代設計風格，配色使用藍色系。
```

### 範例 2：功能演示影片

```
建立一個 Remotion 影片展示 Naruvia 的任務管理流程：
1. 用戶輸入：「明天要跟客戶開會」
2. Gatekeeper 分析並結構化
3. Librarian 自動歸檔到正確位置
4. Coach 在日曆上標記並提醒
5. 整個流程用動畫呈現，時長 45 秒
```

### 範例 3：數據可視化動畫

```
用 Remotion 製作一個數據動畫：
- 顯示 Naruvia 如何讓用戶的任務完成率從 60% 提升到 95%
- 使用進度條和圖表動畫
- 時長 20 秒
- 配色使用 Tailwind 的 slate 和 blue 色系
```

## 🛠️ 進階技巧

### 1. 加入音訊

```bash
# 將音訊檔案放入 public/ 目錄
cp ~/Downloads/background-music.mp3 public/

# 在組件中使用
import { Audio } from 'remotion';

<Audio src="/background-music.mp3" />
```

### 2. 匯入圖片

```tsx
import { Img, staticFile } from 'remotion';

<Img src={staticFile('naruvia-logo.png')} />
```

### 3. 複雜動畫

```tsx
import { spring, interpolate } from 'remotion';

const rotation = spring({
  frame,
  fps,
  config: { damping: 100, stiffness: 200 }
});

const opacity = interpolate(frame, [0, 30, 60], [0, 1, 0]);
```

## 📚 更多學習資源

- **Remotion 官方教學**：https://www.remotion.dev/docs/
- **範例展示**：https://www.remotion.dev/showcase
- **Discord 社群**：https://remotion.dev/discord

## ⚠️ 重要提醒

### ✅ 不會影響現有部署
- Remotion 在獨立的 `video-studio/` 目錄
- 不會被包含在 `/web` 的 Next.js build 中
- 不會影響 Firebase Hosting 部署
- 渲染輸出已被 `.gitignore` 排除

### 🔐 安全性
- 不要將敏感資訊放入影片內容
- API keys 使用環境變數（`.env` 已被排除）
- 渲染的影片不會自動上傳，需手動處理

## 🐛 故障排除

### 問題：Remotion Studio 無法啟動

```bash
# 清除快取重試
rm -rf node_modules .remotion
npm install
npm run dev
```

### 問題：渲染速度太慢

```bash
# 調整並發數
npx remotion render HelloWorld out/video.mp4 --concurrency=8
```

### 問題：影片尺寸太大

```typescript
// 在 remotion.config.ts 調整品質
Config.setVideoImageFormat('jpeg');
Config.setQuality(70);  // 預設 80，降低以減小檔案
```

## 🎉 下一步

1. 查看 `src/HelloWorld.tsx` 了解基本結構
2. 閱讀 `README.md` 了解完整功能
3. 開始用 Claude Code 生成你的第一支產品影片！
