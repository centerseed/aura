# Zentropy System Constitution (Zentropy 系統大憲法)

本文件是 Zentropy 專案的「守法原點」。它是超越所有規格書、設計圖與代碼的**最高指導原則**。所有後續的 AI 規劃、開發任務與代碼編修，都必須通過本憲法的合規性檢查 (Constitutional Check)。

---

## 第一條：規格驅動開發 (Spec-Driven Development)
1. **規格即真理**：任何代碼改動必須有對應的規格描述支持。嚴禁在未更新規格的情況下進行「憑感覺編碼 (Vibe Coding)」。
2. **單一真實來源 (SSOT)**：`docs/` 目錄內的文件是系統行為的唯一解釋權所有者。

## 第二條：Clean Architecture 與 TDD 測試驅動規範
1. **全模組 Clean Arch**：無論是 Backend (FastAPI)、Web 還是 Flutter，均須嚴格遵循 Clean Architecture 分層，確保業務邏輯與介面、數據庫完全解耦。
2. **TDD (Test-Driven Development)**：
    *   所有功能開發必須「先寫單元測試 (Unit Test)」。
    *   單元測試必須能保護規格規範後，才允許編寫實作代碼。
3. **整合測試強制性**：在階段性 Task 或 Plan 完成後，必須編寫並通過整合測試 (Integration Test)，確保各 Agent 與模組間的協作無誤。

## 第三條：AI 協作與人類監督
1. **驗證循環**：AI 負責生成建議、規劃與初步代碼，人類負責在關鍵節點（Specify -> Plan -> Task -> Implement）進行簽核驗證。
2. **可追溯性**：所有重大決策必須記錄於 `03_ADR`。

## 第四條：命名與語意一體化
1. **命名一致性**：代碼中的變數、函數與資料庫欄位，必須嚴格遵守 `05_Standards/naming_convention.md` 中的定義。
2. **無歧義通訊**：AI 代理 (Agents) 之間的通訊格式必須是強型別 (Strongly Typed) 的結構化數據。

## 第五條：心理安全與穩定優先
1. **穩定 > 性能**：Zentropy 的首要任務是提供「穩定感」。任何會導致使用者不可預測焦慮的性能優化或功能，均視為違憲。
2. **閉環機制**：系統必須保證所有的輸入都能在 `21:00 PM` 之前完成穩定化或狀態確認。

---

## 第六條：文件生命週期管理 (Documentation Lifecycle)
1. **持續演進 (Living Specs)**：`01_Specification` 與 `02_Plan` 必須隨代碼異動同步更新。它們描述的是「系統當前的狀態」，而非「歷史發展過程」。
2. **決策永存**：`04_ADR` (架構決策紀錄) 嚴禁刪除，它是系統演進的唯一歷史對照。
3. **任務歸檔 (Task Archiving)**：`03_Tasks` 中的任務清單在 100% 完成並併入代碼庫後，應移動至 `03_Tasks/Archive` 資料夾，以保持工作區的整潔，同時保留實作紀錄。
4. **清理即秩序**：任何不再符合當前系統行為的過時草稿或文件，必須立即清理或標記為過時，嚴禁保留具有誤導性的舊規格。

---

## 憲法執行機制 (Execution)
*   **憲法檢查 (Constitutional Check)**：在每個 Sprint 開始前，必須複查一次本文件，確保開法方向未偏離核心原則。
*   **修正案**：憲法可以被修改，但必須確保修改理由充分且被記錄在 `04_ADR` 中。
