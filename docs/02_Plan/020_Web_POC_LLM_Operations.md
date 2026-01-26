# Web POC LLM 操作清單

> 本文件整理了 Web POC 中所有與 LLM（Large Language Model）相關的操作點位。

## 概觀

Web POC 使用 **Google Gemini 2.5 Flash Lite** 模型進行所有 AI 操作，透過 `@ai-sdk/google` 套件進行整合。目前共有 **4 個 API 端點** 涉及 LLM 操作。

---

## 1. Brain Dump（腦內傾倒）

### 📍 程式碼位置
[`web/app/api/brain-dump/route.ts`](../../web/app/api/brain-dump/route.ts)

### 📝 功能說明
將用戶混亂的自然語言輸入結構化為可管理的任務項目。

### 🤖 LLM 操作細節

**觸發位置：** 第 130-211 行

```typescript
const { object: result } = await generateObject({
  model: google("gemini-2.5-flash-lite"),
  schema: StructureResultSchema,
  prompt: `你是 Zentropy 的圖書管理員 AI，負責將用戶的混亂輸入整理成結構化的項目...`
});
```

**輸入資料：**
- `text`: 用戶的自然語言輸入
- 用戶現有結構（Areas、Products、Topics、Tasks）
- 用戶設定的 Milestones（未來 90 天內）

**輸出結構（Zod Schema）：**
```typescript
const StructuredItemSchema = z.object({
  title: z.string(),           // 精簡可執行的標題
  narrative: z.string(),       // 上下文敘述
  drawer: z.enum(["INBOX", "ACTIVE", "MAINTAIN", "REFERENCE", "ARCHIVE"]),
  lifecycle: z.enum(["FINITE", "PERPETUAL"]),
  tag: z.object({
    area: z.string(),          // L1: 身分/工作區上下文
    product: z.string(),       // L2: 長期建立的資產
    topic: z.string(),         // L3: Product 內的主題模組
  }),
  strategy_used: z.string(),   // 分類策略
  reasoning: z.string(),       // 分類推理說明
  due_date: z.string().datetime().optional(),          // 推斷的截止日期
  inferred_from_milestone: z.string().optional(),      // 關聯的里程碑 ID
  time_confidence: z.number().min(0).max(1).optional(), // 時間推斷信心分數
  time_reasoning: z.string().optional(),               // 時間推斷理由
});
```

**AI 指令核心原則：**
1. **語意引力**：根據現有任務內容判斷歸屬
2. **邊界遵守**：嚴格使用已定義的 Area
3. **避免重複**：選擇最匹配的 Product
4. **Topic 填寫規則**：優先使用現有 Topics
5. **Drawer 狀態分類**：INBOX/ACTIVE/MAINTAIN/REFERENCE/ARCHIVE

**時間推斷策略（三階段）：**
- **階段 A（強關聯 0.8-1.0）**：任務與里程碑直接相關
- **階段 B（中關聯 0.5-0.8）**：任務屬於有里程碑的 Product
- **階段 C（弱關聯 0.2-0.5）**：根據 Drawer 狀態推斷預設時間

---

## 2. Adjust Tags（標籤調整）

### 📍 程式碼位置
[`web/app/api/adjust-tags/route.ts`](../../web/app/api/adjust-tags/route.ts)

### 📝 功能說明
解析用戶的自然語言指令，調整現有任務的分類（移動任務或改變主題標籤）。

### 🤖 LLM 操作細節

**觸發位置：** 第 84-113 行

```typescript
const { object: intent } = await generateObject({
  model: google("gemini-2.5-flash-lite"),
  schema: AdjustmentIntentSchema,
  prompt: `你是 Naruvia 的標籤調整助手。用戶想要調整現有任務的分類...`
});
```

**輸入資料：**
- `text`: 用戶的調整指令（如「把 XX 移到 YY 專案」）
- 用戶現有結構（含任務 ID 與詳細資訊）

**輸出結構（Zod Schema）：**
```typescript
const AdjustmentIntentSchema = z.object({
  intent_type: z.enum(["move_tasks", "change_topic", "no_action"]),
  task_matches: z.array(z.object({
    task_id: z.string(),
    task_title: z.string(),
    current_location: z.string(),
    match_reason: z.string(),
  })),
  target_area: z.string().optional(),
  target_product: z.string().optional(),
  target_topic: z.string().optional(),
  reasoning: z.string(),
});
```

**AI 判斷邏輯：**
1. **意圖識別**：
   - `move_tasks`：移動任務到不同專案
   - `change_topic`：改變任務的主題標籤
   - `no_action`：非調整指令（如新增任務）
2. **模糊匹配**：根據用戶描述的關鍵字匹配任務
3. **目標定位**：使用現有結構的完全相同名稱

**支援的指令範例：**
- 「把『向學校主任通報出入境』移到『搬家去日本』專案」
- 「把所有關於手機的任務歸到『行政事務』專案」
- 「把『送竹節餅』的 Topic 改成『其他』」

---

## 3. Suggest Product（專案名稱推薦）

### 📍 程式碼位置
[`web/app/api/suggest-product/route.ts`](../../web/app/api/suggest-product/route.ts)

### 📝 功能說明
當用戶將任務移到某個 Area 但該 Area 下沒有合適的 Product 時，AI 推薦專案名稱。

### 🤖 LLM 操作細節

**觸發位置：** 第 41-74 行

```typescript
const { object: suggestion } = await generateObject({
  model: google("gemini-2.5-flash-lite"),
  schema: ProductSuggestionSchema,
  prompt: `你是 Naruvia 的專案命名助手。用戶想要將一個任務移到「${areaName}」身分下...`
});
```

**輸入資料：**
- `taskContent`: 任務內容
- `taskNarrative`: 任務背景（可選）
- `areaId` / `areaName` / `areaScope`: 身分資訊
- 該 Area 下現有的 Product 名稱（避免重複）

**輸出結構（Zod Schema）：**
```typescript
const ProductSuggestionSchema = z.object({
  suggested_name: z.string(),         // 建議的專案名稱
  reasoning: z.string(),               // 建議理由
  alternative_names: z.array(z.string()).max(2), // 備選名稱
});
```

**命名原則：**
1. **精簡**：2-6 個字為佳
2. **具體**：明確指出核心主題
3. **避重複**：不與現有專案名稱相似
4. **語意群組**：能涵蓋類似性質的任務
5. **符合身分**：與身分的範圍和定位一致

---

## 4. Reorganize（重新整理）

### 📍 程式碼位置
[`web/app/api/reorganize/route.ts`](../../web/app/api/reorganize/route.ts)

### 📝 功能說明
分析用戶現有的資料結構，建議合併重複的 Product 並重新分類錯誤歸類的任務。

### 🤖 LLM 操作細節

**觸發位置：** 第 88-120 行

```typescript
const { object: result } = await generateObject({
  model: google("gemini-2.5-flash-lite"),
  schema: ReorganizeResultSchema,
  prompt: `你是 Naruvia 的圖書管理員 AI，一個資訊熵減系統...`
});
```

**輸入資料：**
- 用戶完整的結構摘要（所有 Areas、Products、Tasks）

**輸出結構（Zod Schema）：**
```typescript
const ReorganizeResultSchema = z.object({
  analysis: z.string(),  // 結構問題分析
  merges: z.array(z.object({
    reason: z.string(),
    target_area: z.string(),
    source_areas: z.array(z.string()),
    target_product: z.string(),
    source_products: z.array(z.string()),
  })),
  reclassifications: z.array(z.object({
    task_id: z.string(),
    task_title: z.string(),
    current_area: z.string(),
    current_product: z.string(),
    new_area: z.string(),
    new_product: z.string(),
    reason: z.string(),
  })),
});
```

**核心聚合規則：**
1. **絕不聚合 Area (L1)**：Area 代表身分/角色，保持穩定
2. **L2 (Product) 完全沒資料才聚合**：只清理空的 Product
3. **L2 相似專案才考慮聚合**：只合併語義上明顯重複的 Product

**治理原則：**
- **語義引力**：關於同一現實概念的項目應聚集
- **清晰層級**：Area = 身分角色、Product = 長期資產、Topic = 主題模組
- **保守優先**：寧可保留分散結構，不過度聚合

---

## 技術架構摘要

### 使用的套件
- `@ai-sdk/google`: Google AI SDK
- `ai`: Vercel AI SDK (提供 `generateObject`)
- `zod`: Schema 定義與輸出驗證

### LLM 模型
- **模型名稱**: `gemini-2.5-flash-lite`
- **使用方式**: 透過 `generateObject` 產生結構化輸出

### 共同特性
1. 所有 API 都使用 **Zod Schema** 定義輸出結構
2. 所有 AI 回應都要求使用 **繁體中文**
3. 都會載入用戶現有結構作為上下文
4. 都支援 **preview 模式**（除 brain-dump 外）

---

## 檔案連結總覽

| API 端點 | 檔案路徑 | 主要功能 |
|---------|---------|---------|
| `/api/brain-dump` | [`route.ts`](../../web/app/api/brain-dump/route.ts) | 自然語言輸入轉結構化任務 |
| `/api/adjust-tags` | [`route.ts`](../../web/app/api/adjust-tags/route.ts) | 任務標籤調整 |
| `/api/suggest-product` | [`route.ts`](../../web/app/api/suggest-product/route.ts) | 專案名稱推薦 |
| `/api/reorganize` | [`route.ts`](../../web/app/api/reorganize/route.ts) | 資料結構重新整理 |

---

*文件產生日期：2026-01-25*
