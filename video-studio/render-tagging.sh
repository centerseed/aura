#!/bin/bash
# Zentropy 標籤處理影片快速渲染腳本

echo "🎬 開始渲染 Zentropy 標籤處理影片..."
echo ""

# 確保在正確的目錄
cd "$(dirname "$0")"

# 建立輸出目錄
mkdir -p out

# 渲染影片
echo "📹 渲染中... (預計 20-30 秒)"
npx remotion render ZentropyTagging out/zentropy-tagging.mp4 --overwrite

# 檢查是否成功
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 渲染完成！"
    echo ""
    echo "📁 影片位置："
    echo "   $(pwd)/out/zentropy-tagging.mp4"
    echo ""
    echo "🎥 影片規格："
    echo "   - 解析度: 1920x1080 (Full HD)"
    echo "   - 幀率: 30 fps"
    echo "   - 時長: 10 秒"
    echo ""

    # 顯示檔案大小
    SIZE=$(du -h out/zentropy-tagging.mp4 | cut -f1)
    echo "📦 檔案大小: $SIZE"
    echo ""
    echo "🎉 現在可以使用了！"

    # macOS 自動開啟影片
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo ""
        read -p "要在 QuickTime 中開啟影片嗎？ (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            open out/zentropy-tagging.mp4
        fi
    fi
else
    echo ""
    echo "❌ 渲染失敗，請檢查錯誤訊息"
    exit 1
fi
