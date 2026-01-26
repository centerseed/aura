# Zentropy Software Engineering Standards
# Zentropy 軟體工程開發標準

本文件定義了 Zentropy 系統跨平台的開發標準，確保程式碼的一致性、可測試性與長期維護性。所有實作計畫 (Plan) 必須符合本標準。

---

## 一、 核心架構：Clean Architecture
系統嚴格遵循 Clean Architecture 分層原則，確保業務邏輯與外部框架解耦。

### 1. 分層定義 (Layer Definition)

#### 🔵 Domain Layer (核心領域層) - 最內層
*   **Entities**: 核心數據模型（純文字/對象，無框架依賴）。
*   **Interfaces**: 定義 Repository 或 Service 的行為介面。
*   **Exceptions**: 業務專屬異常。

#### 🟢 Application Layer (應用程序層)
*   **Use Cases**: 實作具體的業務工作流。
*   **DTOs**: 定義層與層之間傳輸的數據對象。

#### 🟡 Interface Adapters Layer (接口轉換層)
*   **Controllers**: 處理外部輸入（API Request, UI Event）。
*   **Presenters**: 格式化輸出。
*   **Repository Implementations**: 介面的具體實作，負責與外部系統溝通。

#### 🔴 Infrastructure Layer (基礎設施層) - 最外層
*   **External APIs**: 第三方服務 SDK。
*   **Persistence**: 具體的數據庫驅動（Firestore, Client）。
*   **Frameworks**: Web/App 框架（FastAPI, Flutter）。

---

## 二、 開發流程標準

### 1. TDD (Test-Driven Development)
*   **開發順序**: 
    1. 針對 Use Case 撰寫失敗的單元測試。
    2. 實作最少代碼使測試通過。
    3. 重構並確保測試依然通過。
*   **覆蓋要求**: Domain 與 Application 層必須達到 100% Logic 覆蓋。

### 2. 整合測試 (Integration Testing)
*   任何獨立模組完成後，必須撰寫整合測試驗證與外部服務（如 Firestore, LLM）的聯作。

### 3. 錯誤處理 (Error Handling)
*   嚴禁吞掉異常。
*   所有錯誤必須被轉化為 Domain Exception 或記錄於系統 Log。

---

## 三、 名言對齊
*   **實體不變原則**: 如果資料庫換了，Domain 層代碼不應變動。
*   **介面優先**: 永遠先定義 Interface，再撰寫實作。
