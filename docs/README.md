# Zentropy Business OS - SDD Hub (Spec-Driven Development)

本目錄遵循 **Spec-Driven Development (SDD)** 流程。開發不再是「憑感覺編碼」，而是依序通過各個「規格閘門 (Spec Gates)」。

## 🚀 SDD 工作流與目錄結構

### [00_Constitution](./00_Constitution) - 最高法律 (The Constitution)
*專案的最高指導原則。所有開發活動、AI 規劃與代碼邏輯均須符合此憲法規範。*
*   `constitution.md`: 定義核心架構原則。

### [01_Specification](./01_Specification) - 規格定義 (Phase 1: Specify)
*定義「做什麼」與「業務價值」。包含產品定義與詳細功能行為邏輯。*
*   `001_Product_Definition.md`: 願景、目標與成功指標。
*   `002_Functional_Specification.md`: 雙軸管理模型、Agent 協作與功能細節。
*   `003_System_Infrastructure_Spec.md`: 技術選型 (FastAPI/Flutter/Firestore) 與架構約束。

### [02_Plan](./02_Plan) - 實作計畫 (Phase 2: Plan)
*定義「怎麼做」。技術架構圖、數據庫模型、API 規格。*
*   `001_Backend_Implementation_Plan.md`: FastAPI 後端具體實作里程碑。

### [03_Tasks](./03_Tasks) - 原子任務 (Phase 3: Tasks)
*將 Plan 拆解為 AI 可執行的具體、有編號的 Task 清單。*

### [04_ADR](./04_ADR) - 決策紀錄 (The Why)
*Architecture Decision Records. 紀錄技術選型的動機。*

### [05_Refinery](./05_Refinery) - 方法論精煉 (The Soul)
*定義 Zentropy 方法論、雙軸穩定模型等核心思考。*
*   `001_SAM_Methodology_Logic.md`: 核心邏輯機制。
*   `002_SDD_Workflow_Guide.md`: SDD 開發工作流指南。

### [06_Standards](./06_Standards) - 規範標準 (The Rules)
*Naming Convention, Directory Structure 等全域標準。*
*   `001_Naming_and_Taxonomy.md`: 檔案命名與術語定義。
*   `002_Software_Engineering_Standards.md`: **Clean Arch 與 TDD 工程實作標準**（開發必讀）。

---
## 🛠️ 開發守則
1. **嚴禁跳過階段**：沒有 Specification，就不准寫 Plan；沒有 Plan，就不准拆 Task。
2. **規格先行**：代碼改動前，必須先確保 01 & 02 的文件已更新。
