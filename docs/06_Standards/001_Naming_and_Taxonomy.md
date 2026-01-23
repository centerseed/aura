# SAM System Naming Convention & Taxonomy
# SAM 系統命名規範與術語統一表

為了確保 LLM、開發者與使用者（創辦人）在理解上高度對齊，本文件定義了 SAM 系統內所有核心名詞與檔案命名規範。

---

## 一、 核心術語定義 (Core Taxonomy)

### 1. 狀態維度 (Status - 橫軸)
決定資訊在儀表板上的出現權重。
*   **[Active] 衝刺**：目前正在推進、有明確期限或需近期決策的事項。
*   **[Maintain] 營運**：週期性發生、需維持穩定、只有在異常（亮燈）時才需關注的事項。
*   **[Reference] 知識備存**：無時效性、純供參考的靜態資訊。平時隱形，由 LLM 自動喚醒。

### 2. 實體維度 (Entity - 縱軸)
決定資訊的語意歸屬。
*   **領域 (Area)**：最高層級分類（如：03_Operations, 04_Product）。
*   **主體 (Project / Subject)**：具體的業務實體（如：Project_A, Japan_Entity）。
*   **主題 (Topic)**：專案下的具體議題（如：Visa_Application, API_Spec）。

### 3. 輸入性質 (Input Type)
*   **Action (任務)**：可執行的具體事項。
*   **Note (筆記)**：純資訊、記錄、靈感或背景資料。

---

## 二、 檔案命名規範 (File Naming Conventions)

所有由系統自動生成或歸檔的文件必須遵循以下格式，以確保物理層級的有序性。

### 1. 通用格式 (General Format)
`XXX_主題描述_版本.md`
*   **XXX (編號)**: 3 位數零補齊的數字（如 `001`, `002`），代表在該資料夾內的邏輯與建立順序。
*   **主題描述**: 建議使用底線 `_` 分隔，不使用空格。
*   **範例**：`001_Aura_Technical_Blueprint_v1.md`

### 2. 不同類別的特殊命名
*   **會議記錄 (Meetings)**：`YYYYMMDD_MTG_參與者簡稱_主題.md`
    *   範例：`20260121_MTG_Admin_TaxDiscussion.md`
*   **日/週報 (Reports)**：`YYYYMMDD_Report_Daily.md` 或 `2026_W04_Report_Weekly.md`
*   **策略文件 (Strategy)**：`YYYYMMDD_Strategy_主題.md`

---

## 三、 資料夾結構規範 (Directory Architecture)

檔案路徑必須反映 Entity 權屬。

*   `/00_Strategy_and_Identity/`：核心願景、藍圖、戰略。
*   `/01_Legal_and_Compliance/`：法律、合約、簽證相關文件。
*   `/02_Finance_and_Tax/`：稅務、發票、銀行、現金流監控。
*   `/03_Operations/`：公司日常營運、會議記錄、週計畫。
*   `/04_Product_and_Engineering/`：產品開發、技術文件、Bug 追蹤清單。
*   `/05_Marketing_and_Sales/`：市場行銷、客戶關係。
*   `/10_Brain_Storming/`：原始想法、草稿、方法論討論。

---

## 四、 術語對齊 (Term Alignment)

| 中文稱呼 | 英文對應 (LLM Key) | 定義描述 |
| :--- | :--- | :--- |
| **雙軸矩陣** | Dual-Axis Matrix | 狀態與實體的交叉管理模型。 |
| **上下文喚醒** | Contextual Recall | 點擊任務時自動彈出相關 Reference 的行為。 |
| **心理閉環** | Psychological Closure | 晚報確認後大腦可以停止盤點的狀態。 |
| **低摩擦輸入** | Low-Friction Ingest | 不要求格式的單一入口。 |
| **穩定化** | Stabilization | 將混亂訊息轉化為定義明確的 Status/Entity 的過程。 |

---

## 五、 更新建議
*   任何新實體（New Project）加入時，應同步更新此文件的資料夾結構規範。
*   本文件為 LLM 進行自動歸檔時的最高準則（System Prompt 的基礎）。
