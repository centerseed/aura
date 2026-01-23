# Task 001: 基礎架構與雲端環境搭建

## 狀態 (Status)
*   **階段**: Milestone 1
*   **優先級**: 高
*   **執行者**: Antigravity
*   **狀態**: 已完成 (Completed) ✅

## 任務描述 (Description)
建立 Aura 後端 (FastAPI) 的基礎運行環境，並串線 Firebase 與 Cloud Run 部署流程。本任務遵循 TDD 流程。

## 查核清單 (Checklist)

### 1. 環境初始化
- [x] [001-1] 建立 `backend/` 目錄結構並初始化 Python 虛擬環境。
- [x] [001-2] 配置 `requirements.txt` (FastAPI, Pytest, Firebase Admin)。
- [x] [001-3] 建立 `.env.example` 並定義 Firebase 所需環境變數。

### 2. TDD 基礎驗證
- [x] [001-4] **(TDD)** 撰寫第一個失敗測試：驗證 `/health` 接口。
- [x] [001-5] 實作最小化 FastAPI 接口讓測試轉綠。

### 3. Docker 與雲端配置
- [x] [001-6] 撰寫初版 `Dockerfile`。
- [x] [001-7] 建立 GCP/Firebase 專案與下載 Service Account。
- [x] [001-8] **(Cloud Run 部署)** 執行節流部署成功。

### 4. 整合驗證
- [x] [001-9] 外部 Ping 測試：`https://aura-backend-522828066537.asia-east1.run.app/health` ✅
- [x] [001-10] 執行整合測試，成功寫入並讀取 Firestore。 ✅

---

## 驗證日誌 (Log)
*   2026-01-21: 成功建立 Firebase 專案 `aura-business-os`。
*   2026-01-21: 部署 Cloud Run Service `aura-backend`。
*   2026-01-21: 本地 Pytest 通過健康檢查與 Firestore 聯通測試。
