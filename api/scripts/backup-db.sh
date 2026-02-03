#!/bin/bash
#
# 資料庫備份腳本
# 每日自動執行，保留最近 7 天的備份
#

set -e

# 配置
BACKUP_DIR="$HOME/naruvia-backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/naruvia_backup_$TIMESTAMP.sql"
RETENTION_DAYS=7

# 創建備份目錄
mkdir -p "$BACKUP_DIR"

# 從 .env.local 讀取 DATABASE_URL
if [ -f ".env.local" ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

echo "🔄 開始備份資料庫..."
echo "   時間: $TIMESTAMP"
echo "   備份檔案: $BACKUP_FILE"

# 執行備份
pg_dump "$DATABASE_URL" > "$BACKUP_FILE"

# 壓縮備份
gzip "$BACKUP_FILE"
echo "✅ 備份完成: ${BACKUP_FILE}.gz"

# 刪除超過保留期限的備份
find "$BACKUP_DIR" -name "naruvia_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete
echo "🧹 清理舊備份（保留 $RETENTION_DAYS 天）"

# 顯示當前備份列表
echo ""
echo "📋 現有備份:"
ls -lh "$BACKUP_DIR"

# 設置 cron job（每日凌晨 3:00 執行）
# crontab -e
# 0 3 * * * cd /path/to/naruvia/api && ./scripts/backup-db.sh >> /var/log/naruvia-backup.log 2>&1
