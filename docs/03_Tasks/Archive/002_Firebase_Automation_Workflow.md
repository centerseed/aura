# Zentropy Firebase Automation Workflow

本文件定義了如何自動化建立 Firebase 專案、下載金鑰並完成後端配置的標準流程。

---

## 🚀 自動化初始化腳本 (Setup Script)

我們可以使用 `gcloud` 與 `firebase` CLI 進行一鍵初始化。

### 步驟 1: 設定專案 ID
請選擇一個唯一的 Project ID（例如: `aura-system-2026`）。

### 步驟 2: 執行初始化指令
您可以執行以下組合指令（或由 AI 代為執行）：

```bash
# 1. 建立 GCP/Firebase 專案
gcloud projects create [PROJECT_ID] --name="Zentropy Business OS"

# 2. 啟用核心服務
gcloud services enable firestore.googleapis.com \
                       cloudrun.googleapis.com \
                       artifactregistry.googleapis.com \
                       --project=[PROJECT_ID]

# 3. 初始化 Firestore (預設使用 native 模式)
gcloud alpha firestore databases create --location=asia-east1 --project=[PROJECT_ID]

# 4. 建立 Service Account 並下載金鑰
gcloud iam service-accounts create zentropy-backend-sa --display-name="Zentropy Backend Service Account" --project=[PROJECT_ID]

# 5. 授權 Firestore 存取權限
gcloud projects add-iam-policy-binding [PROJECT_ID] \
    --member="serviceAccount:zentropy-backend-sa@[PROJECT_ID].iam.gserviceaccount.com" \
    --role="roles/datastore.user"

# 6. 生成並下載密鑰到 backend 目錄
gcloud iam service-accounts keys create backend/service-account.json \
    --iam-account=zentropy-backend-sa@[PROJECT_ID].iam.gserviceaccount.com \
    --project=[PROJECT_ID]
```

---

## 🛠️ 自動化配置規則
1. **安全第一**: 生成的 `service-account.json` 必須存放在 `backend/` 下，並確保已被 `.gitignore` 排除。
2. **環境變數對齊**: 腳本執行完後，應自動更新 `backend/.env` 中的 `FIREBASE_PROJECT_ID`。
3. **雲端預備**: 建立 Artifact Registry 儲存庫，為 Cloud Run 部署做準備。

---

## 📝 後續人工操作 (One-time)
*   **Billing**: 如果專案需要連接外部 API 或使用超過免費額度，需至 GCP Console 綁定信用卡。
*   **Authentication**: Firebase Auth 目前仍建議至 Firebase Console 手動開啟 (Google/Email 登入)。
