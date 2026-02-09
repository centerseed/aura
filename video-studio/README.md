# Naruvia Video Studio 🎬

使用 Remotion 製作 Naruvia 產品演示影片的獨立工作室。

## 🚀 快速開始

### 安裝依賴

```bash
cd video-studio
npm install
```

### 啟動 Remotion Studio（視覺化編輯器）

```bash
npm run dev
```

這會在 `http://localhost:3000` 啟動 Remotion Studio，讓你可以即時預覽和編輯影片。

### 渲染影片

```bash
# 渲染預設影片
npm run render

# 自訂渲染
npx remotion render HelloWorld out/naruvia-demo.mp4
```

## 📁 專案結構

```
video-studio/
├── src/
│   ├── Root.tsx          # Remotion 組合根組件
│   ├── HelloWorld.tsx    # 範例影片組件
│   └── index.ts          # 入口點
├── out/                  # 渲染輸出目錄（被 .gitignore 排除）
├── public/               # 靜態資源（圖片、音訊等）
├── package.json          # 獨立的依賴管理
└── remotion.config.ts    # Remotion 配置

```

## 🎨 建立新影片

### 1. 用 Claude Code 自然語言生成

在專案根目錄執行：

```bash
# 跟 Claude Code 說
"用 Remotion 做一支 30 秒的影片，展示 Naruvia 的雙軸管理模型"
```

### 2. 手動建立組件

```tsx
// src/NaruviaDemo.tsx
import { AbsoluteFill } from 'remotion';

export const NaruviaDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <h1>Naruvia - 讓一切井然有序</h1>
    </AbsoluteFill>
  );
};
```

然後在 `src/Root.tsx` 註冊：

```tsx
<Composition
  id="NaruviaDemo"
  component={NaruviaDemo}
  durationInFrames={900}  // 30 秒 * 30 fps
  fps={30}
  width={1920}
  height={1080}
/>
```

## 🔧 常用命令

```bash
# 開發模式（即時預覽）
npm run dev

# 渲染單個組合
npx remotion render <CompositionId> out/<filename>.mp4

# 列出所有可用的組合
npx remotion compositions

# 升級 Remotion
npm run upgrade
```

## 📦 與主專案的隔離

- ✅ **完全獨立**：不會影響 `/web` 的 Next.js 構建
- ✅ **獨立依賴**：有自己的 `package.json` 和 `node_modules`
- ✅ **部署分離**：不會被包含在 Firebase Hosting 部署中
- ✅ **Git 乾淨**：渲染輸出被 `.gitignore` 排除

## 🎓 學習資源

- [Remotion 官方文件](https://www.remotion.dev/docs/)
- [Claude Code + Remotion 指南](https://www.remotion.dev/docs/ai/claude-code)
- [Remotion 範例庫](https://www.remotion.dev/showcase)

## 💡 使用案例

- 產品功能演示
- 用戶引導教學
- 功能發布預告
- 數據可視化動畫
- 社群媒體行銷影片
