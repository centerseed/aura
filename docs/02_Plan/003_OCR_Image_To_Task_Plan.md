# OCR 圖片轉任務功能 - 實作計畫

> **狀態**: Draft
> **建立日期**: 2026-02-08
> **相關規格**: 待建立

---

## 1. 功能目標

用戶拍照或上傳圖片（如行程表、會議白板、手寫筆記），系統自動：
1. **辨識圖片中的文字**（OCR）
2. **理解語義結構**（表格、時間軸、清單）
3. **轉換為結構化任務**，自動分類到對應的 Entity（Area/Product/Topic）

---

## 2. 技術方案選型

### 方案比較

| 方案 | 優點 | 缺點 | 成本 |
|------|------|------|------|
| **Google Cloud Vision API** | 98% 準確率、支援多語言、表格偵測 | 需額外 API key、多一個服務依賴 | ~$1.5/1000 張 |
| **Tesseract (本地)** | 免費、離線 | 中文準確率較差、無法理解語義 | 免費 |
| **Gemini 2.5/3 Multimodal (推薦)** | 直接理解圖片語義、一步完成 OCR + 結構化、已在專案中使用、Agentic Vision 可主動分析 | 最新版仍在 preview | 2.5 Flash ~$0.002/張 |

### 推薦方案：Gemini 2.5 Flash / Gemini 3 Flash Multimodal

**最新模型資訊（2026-02）**：
- **Gemini 3 Pro / 3 Flash** — 最新一代，支援 Agentic Vision（Think → Act → Observe 循環），可主動放大圖片區域、解析表格、執行 Python 分析。3 Flash 開啟 code execution 可提升視覺 benchmark 5-10%
- **Gemini 2.5 Flash** — 穩定版本，閃電快速，支援可控 thinking budget，適合高吞吐量場景
- **Gemini 2.5 Pro** — 高能力版本，100 萬 token context，複雜推理能力最強
- ⚠️ **Gemini 2.0 Flash 將於 2026-03-31 停用**，必須遷移

**建議選擇**：
- **開發階段**：`gemini-2.5-flash`（快速、便宜、足夠準確）
- **生產環境**：`gemini-2.5-flash`，複雜圖片 fallback 到 `gemini-2.5-pro`
- **未來升級**：`gemini-3-flash` 穩定後遷移，利用 Agentic Vision 提升表格辨識

**新功能 `media_resolution` 參數**：
Gemini 3 支援 `low` / `medium` / `high` / `ultra_high` 解析度控制，可針對細小文字提高解析度（增加 token 消耗），或對簡單圖片降低解析度（節省成本）。

**理由**：
1. **已有依賴** — 專案已整合 Google Generative AI SDK（Gemini），無需引入新服務
2. **一步到位** — Gemini 可直接從圖片理解語義並輸出結構化 JSON，不需要先 OCR 再丟給 LLM 做 NLU，減少一個步驟
3. **成本最低** — `gemini-2.5-flash` 視覺能力強，價格極低
4. **中文支援佳** — 對繁體中文、手寫、混合排版都有不錯的辨識能力
5. **結構理解** — 可辨識表格、時間軸、顏色標記等視覺語義（如圖中紅字=重要提醒、綠字=備註）
6. **Agentic Vision（Gemini 3）** — 可主動分析表格結構，zoom in 細節區域，大幅提升複雜圖片準確率

---

## 3. 整體架構

```
用戶上傳圖片 (Flutter / Web)
        ↓
  API: /api/brain-dump (擴展支援 multipart/form-data)
        ↓
  圖片 → Base64 編碼
        ↓
  Gemini 2.0 Flash (multimodal prompt)
  ┌─────────────────────────────────┐
  │ System: 你是 OCR + NLU 助手     │
  │ Input: [圖片] + [提取指令]       │
  │ Output: 結構化 JSON              │
  └─────────────────────────────────┘
        ↓
  與現有 Brain Dump 管線合併
  (Entity 分類、時間推斷、Source Attribution)
        ↓
  儲存至 PostgreSQL
```

---

## 4. 實作模組拆解

### 4.1 API 層：擴展 Brain Dump 端點

**修改檔案**: `api/src/app/api/brain-dump/route.ts`

- 支援 `multipart/form-data`，接受圖片檔案（JPEG/PNG/WEBP）
- 圖片大小限制：10MB
- 支援同時傳送圖片 + 文字補充說明（如「這是下週的行程」）
- 新增 `input_type` 欄位：`text` | `image` | `image_with_text`

### 4.2 核心邏輯：圖片理解服務

**新增檔案**: `api/src/lib/image-understanding.ts`

職責：
- 接收圖片 Buffer，轉換為 Gemini 可接受的格式
- 組裝 Multimodal Prompt（見 4.5）
- 呼叫 Gemini API，取得結構化輸出
- 錯誤處理（圖片模糊、無文字、格式不支援）

### 4.3 Prompt 設計（關鍵）

針對不同圖片類型設計 prompt 策略：

**通用 Prompt 結構**：
```
角色：你是一個專業的圖片內容提取助手。
任務：從圖片中提取所有可操作的任務和資訊。

提取規則：
1. 辨識圖片類型（行程表/會議記錄/待辦清單/白板/其他）
2. 提取所有時間相關資訊（日期、時間、期限）
3. 提取所有任務/行動項目
4. 辨識視覺提示（紅色=重要、刪除線=已完成 等）
5. 保留原始語言，不翻譯

輸出格式：JSON Schema（見下方）
```

**輸出 JSON Schema**：
```json
{
  "image_type": "itinerary | meeting_notes | todo_list | whiteboard | other",
  "confidence": 0.95,
  "extracted_items": [
    {
      "title": "任務標題",
      "description": "詳細說明",
      "date": "2026-02-10",
      "time": "08:00",
      "duration_minutes": 60,
      "priority": "high | medium | low",
      "visual_cues": ["red_text", "bold"],
      "category": "transportation | meal | activity | reminder | other",
      "sub_items": ["子項目1", "子項目2"],
      "notes": "額外備註（如：雨備方案）"
    }
  ],
  "context": {
    "overall_theme": "九州7日旅遊行程",
    "date_range": { "start": "2026-02-10", "end": "2026-02-12" },
    "participants_mentioned": ["小穎", "李媽", "播種家"]
  }
}
```

### 4.4 與現有 Brain Dump 管線整合

OCR 提取的結果需轉換為現有 Brain Dump 的輸入格式：
- 每個 `extracted_item` → 一個 Brain Dump entry
- `source_type` 設為 `"extracted_from_image"`
- 保留原始圖片 URL 作為 `source_reference`
- 時間資訊的 `confidence` 來自 Gemini 的判斷

### 4.5 Source Attribution 擴展

現有 source_type 需新增：
```typescript
type SourceType =
  | "explicit"                // 用戶明確輸入
  | "inferred_from_context"   // AI 從上下文推斷
  | "inferred_from_system"    // 系統規則推斷
  | "extracted_from_image"    // 新增：從圖片 OCR 提取
```

### 4.6 Flutter 端：圖片輸入 UI

**修改檔案**: `app/lib/presentation/screens/capture/`

- Capture Screen 新增「相機」和「相簿」按鈕
- 圖片預覽 + 裁切（可選）
- 上傳進度指示
- 提取結果預覽：用戶可在送出前編輯/刪除/調整

### 4.7 Web 端：圖片上傳

- Brain Dump 頁面新增拖拽上傳區域
- 支援貼上剪貼簿圖片（Ctrl+V）
- 提取結果預覽表格

---

## 5. 以旅遊行程圖為例的處理流程

```
輸入：用戶上傳旅遊行程表圖片
  ↓
Gemini 辨識為 "itinerary" 類型
  ↓
提取 3 天（Day 5-7）共約 15-20 個任務項目：
  ├─ Day 5 (2/10): 太宰府→由布院
  │   ├─ 08:00 出門
  │   ├─ 08:30 JR大橋站接送播種 [transportation]
  │   ├─ 09:00 太宰府天滿宮 [activity]
  │   ├─ 09:00 雨備：九州國立博物館 [activity, conditional]
  │   ├─ 12:00 午餐 [meal]
  │   ├─ 逛表參道吃梅枝餅 [activity]
  │   ├─ 13:30 出發去由布院 [transportation]
  │   └─ 15:00 花卉村、湯之坪 [activity]
  ├─ Day 6 (2/11): 九重森林公園滑雪
  │   ├─ 08:00 出發 [transportation]
  │   ├─ ⚠️ 要帶護照、身份證、駕照 [reminder, high_priority]
  │   ├─ 09:00 抵達九重森林公園 [activity]
  │   ├─ 11:30-13:00 滑雪教學 [activity]
  │   ├─ 午餐：九重森林公園餐廳 [meal]
  │   ├─ ⚠️ 小穎/李媽先排隊買午餐 [reminder, delegated]
  │   └─ 17:45 離開滑雪場 [transportation]
  └─ Day 7 (2/12): 由布院→福岡機場
      ├─ 07:00 金鱗池（6:30-8:00最美）[activity, time_sensitive]
      ├─ 09:00 別府纜車 [activity]
      ├─ ⚠️ 保暖！山上比平地冷10度 [reminder]
      ├─ 午餐：とよ常 別府本店 [meal]
      ├─ 別府地獄巡遊 [activity]
      ├─ 14:00 出發離開別府 [transportation]
      ├─ 16:00 抵達福岡機場 T1 [transportation]
      └─ 19:10 JX841 班機起飛 [transportation, critical]
  ↓
用戶預覽 → 確認/編輯 → 批次匯入
```

---

## 6. 錯誤處理策略

| 情境 | 處理方式 |
|------|---------|
| 圖片模糊/無文字 | 回傳提示「無法辨識圖片內容，請重新拍照」 |
| 部分辨識 | 回傳已辨識內容 + confidence 分數，標記不確定的項目 |
| 圖片太大 | 前端壓縮至 4MB 以下再上傳 |
| API 超時 | 重試 1 次，仍失敗則提示用戶稍後再試 |
| 非文字圖片（純風景照） | 辨識為 `other` 類型，提示「此圖片不包含可提取的任務」 |

---

## 7. 開發順序（建議）

### Phase 1：核心 OCR 管線（MVP）
1. 建立 `image-understanding.ts` 服務
2. 設計並測試 Multimodal Prompt（用旅遊行程圖作為測試案例）
3. 擴展 Brain Dump API 支援圖片輸入
4. 單元測試（Mock Gemini 回應）

### Phase 2：前端整合
5. Flutter Capture Screen 新增圖片輸入
6. Web Brain Dump 新增圖片上傳
7. 提取結果預覽 + 編輯 UI

### Phase 3：優化
8. Prompt 針對不同圖片類型優化（行程表、白板、手寫）
9. 批次匯入確認流程
10. 圖片壓縮與快取策略

---

## 8. 非目標（本次不做）

- 即時相機 OCR（需要 on-device model）
- PDF 文件解析（另開功能）
- 手寫辨識優化（Gemini 基本能力已足夠）
- 多圖片拼接

---

## 9. 依賴與前置條件

- ✅ Gemini API 已整合（`@google/generative-ai`）
- ✅ Brain Dump API 已存在
- ✅ Source Attribution 機制已建立
- ⚠️ Gemini 2.0 Flash 將於 2026-03-31 停用，需使用 2.5+ 版本
- ⬜ 需確認 Gemini 2.5 Flash 的 multimodal 用量限制與 rate limit
- ⬜ 需確認圖片儲存策略（Firebase Storage vs 不儲存原圖）
