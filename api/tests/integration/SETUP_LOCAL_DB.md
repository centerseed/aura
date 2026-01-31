# 整合測試 - 本地資料庫設置指南

## ⚠️ 重要警告

**絕對不要在生產資料庫上運行整合測試！**

整合測試會：
- 建立測試資料
- 刪除測試資料
- 可能會清空整個資料庫

## 為什麼需要本地測試資料庫？

1. **安全性**：不會影響生產資料
2. **速度**：本地資料庫更快
3. **隔離性**：測試不會互相干擾
4. **可重複性**：每次測試都從乾淨的狀態開始

## 方案 1: 使用 Docker 運行 PostgreSQL（推薦）

### 1. 安裝 Docker Desktop
```bash
# macOS
brew install --cask docker

# 或從官網下載：https://www.docker.com/products/docker-desktop
```

### 2. 啟動 PostgreSQL 容器
```bash
docker run -d \
  --name zentropy-test-db \
  -e POSTGRES_PASSWORD=testpass \
  -e POSTGRES_USER=testuser \
  -e POSTGRES_DB=zentropy_test \
  -p 5433:5432 \
  postgres:16-alpine
```

### 3. 設置測試環境變數
```bash
# 建立 .env.test 檔案
cat > /Users/wubaizong/Naruvia/api/.env.test << 'EOF'
DATABASE_URL="postgresql://testuser:testpass@localhost:5433/zentropy_test"
GOOGLE_GENERATIVE_AI_API_KEY="test-key"
EOF
```

### 4. 運行資料庫遷移
```bash
cd /Users/wubaizong/Naruvia/api
export $(cat .env.test | xargs)
npx prisma migrate deploy
```

### 5. 運行整合測試
```bash
# 啟用整合測試（移除 .skip）
# 然後運行
npm run test tests/integration/
```

### 6. 清理（測試完成後）
```bash
# 停止並刪除容器
docker stop zentropy-test-db
docker rm zentropy-test-db
```

## 方案 2: 使用 Homebrew 安裝 PostgreSQL

### 1. 安裝 PostgreSQL
```bash
brew install postgresql@16
brew services start postgresql@16
```

### 2. 建立測試資料庫
```bash
createdb zentropy_test
```

### 3. 設置測試環境變數
```bash
cat > /Users/wubaizong/Naruvia/api/.env.test << 'EOF'
DATABASE_URL="postgresql://localhost:5432/zentropy_test"
GOOGLE_GENERATIVE_AI_API_KEY="test-key"
EOF
```

### 4. 運行遷移和測試（同方案 1）

## 方案 3: 不運行整合測試（目前狀態）

如果你不想設置本地資料庫，可以：

1. **保持整合測試為 skip 狀態**（目前已經是）
2. **依賴單元測試**（已達到 76% 覆蓋率）
3. **在部署前手動驗證**

### 部署前檢查清單

```bash
# 1. 運行所有單元測試
npm run test

# 2. 檢查測試覆蓋率
npm run test:coverage

# 3. 驗證環境變數（手動）
echo $DATABASE_URL
echo $GOOGLE_GENERATIVE_AI_API_KEY
echo $FIREBASE_ADMIN_KEY
```

## 當前測試策略

### ✅ 單元測試（已完成）
- 257 個測試，全部通過
- 76.34% 覆蓋率
- Mock 所有外部依賴
- **可以安全運行，不會影響任何資料庫**

### ⏭️ 整合測試（已建立但 skip）
- 測試框架已建立
- 需要本地測試資料庫才能啟用
- 用於驗證真實的資料庫互動

## 整合測試 vs 單元測試

| 特性 | 單元測試 | 整合測試 |
|------|---------|---------|
| 速度 | ⚡️ 快 | 🐢 慢 |
| 隔離性 | ✅ 完全隔離 | ❌ 需要外部服務 |
| 可靠性 | ✅ 高 | ⚠️ 依賴環境 |
| 覆蓋範圍 | 邏輯測試 | 端到端測試 |
| 資料庫 | Mock | 真實連接 |
| 安全性 | ✅ 安全 | ⚠️ 需要測試 DB |

## 建議的測試流程

### 開發時
```bash
# 運行單元測試（快速反饋）
npm run test

# 或使用 watch 模式
npm run test:watch
```

### 部署前（如果有本地 DB）
```bash
# 運行完整測試套件
npm run test:coverage

# 運行整合測試
export $(cat .env.test | xargs)
npm run test tests/integration/
```

### CI/CD Pipeline（未來）
```yaml
# GitHub Actions 範例
jobs:
  test:
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: testpass
    steps:
      - run: npm run test
      - run: npm run test tests/integration/
```

## 總結

目前的策略：
1. ✅ **單元測試**：已完成，可以安全運行
2. 📝 **整合測試**：已建立框架，需要本地 DB 才能啟用
3. 🚀 **部署前**：依賴單元測試 + 手動驗證環境變數

這樣既安全又實用！
