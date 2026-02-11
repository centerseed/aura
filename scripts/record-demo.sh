#!/bin/bash
# Zentropy 真實 Web UI 錄製腳本

set -e

echo "🎬 Zentropy 真實操作錄製工具"
echo "================================"
echo ""

# 切換到專案根目錄
cd "$(dirname "$0")/.."

# 檢查 Playwright 是否已安裝
if ! npm list playwright >/dev/null 2>&1; then
    echo "❌ Playwright 未安裝"
    echo "正在安裝 Playwright..."
    npm install --save-dev playwright
fi

# 檢查 Playwright 瀏覽器是否已安裝
if [ ! -d "$HOME/Library/Caches/ms-playwright" ]; then
    echo "📦 安裝 Playwright 瀏覽器..."
    npx playwright install chromium
fi

# 檢查 Web 應用是否正在運行
echo "🔍 檢查 Web 應用狀態..."
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "⚠️  Web 應用未運行"
    echo "正在啟動 Web 應用..."

    # 啟動 Web 應用（背景執行）
    cd web
    npm run dev > /dev/null 2>&1 &
    WEB_PID=$!
    cd ..

    echo "⏳ 等待 Web 應用啟動（最多 30 秒）..."
    for i in {1..30}; do
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            echo "✅ Web 應用已啟動"
            break
        fi
        sleep 1
        echo -n "."
    done
    echo ""

    # 設置陷阱以在腳本結束時清理
    trap "kill $WEB_PID 2>/dev/null || true" EXIT
else
    echo "✅ Web 應用正在運行"
fi

# 執行錄製腳本
echo ""
echo "🎥 開始錄製..."
echo "================================"
echo ""

node scripts/record-demo.js

# 轉換影片格式（如果需要）
echo ""
echo "🔄 檢查影片檔案..."

# 找到最新生成的影片
VIDEO_FILE=$(find demo-videos -name "*.webm" -type f -print0 | xargs -0 ls -t | head -n 1)

if [ -n "$VIDEO_FILE" ]; then
    echo "✅ 找到影片: $VIDEO_FILE"

    # 取得檔案大小
    SIZE=$(du -h "$VIDEO_FILE" | cut -f1)
    echo "📦 檔案大小: $SIZE"

    # 詢問是否轉換為 MP4
    echo ""
    read -p "要轉換為 MP4 格式嗎？ (需要 ffmpeg) [y/N] " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if command -v ffmpeg &> /dev/null; then
            OUTPUT_FILE="${VIDEO_FILE%.webm}.mp4"
            echo "🔄 轉換中..."
            ffmpeg -i "$VIDEO_FILE" -c:v libx264 -preset fast -crf 22 "$OUTPUT_FILE" -y
            echo "✅ 轉換完成: $OUTPUT_FILE"
        else
            echo "❌ ffmpeg 未安裝"
            echo "安裝方式: brew install ffmpeg"
        fi
    fi

    # 詢問是否開啟影片
    echo ""
    read -p "要開啟影片嗎？ [y/N] " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        open "$VIDEO_FILE"
    fi
else
    echo "⚠️  未找到影片檔案"
    echo "請檢查 demo-videos/ 目錄"
fi

echo ""
echo "🎉 完成！"
