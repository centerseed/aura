/**
 * Reorganize Topics Prompt Builder
 *
 * 用於構建 AI 重組任務的 Prompt
 */

export interface ReorganizePromptContext {
  product_name: string;
  area_name: string;
  current_topics: string[];
  tasks: Array<{
    id: string;
    content: string;
    narrative: string;
    current_topic: string;
    status: string;
    current_due_date: string | null;
    // sub_items 資訊
    has_sub_items: boolean;
    completed_sub_items: string[];
    pending_sub_items: Array<{ id: string; content: string }>;
  }>;
  milestones: Array<{
    id: string;
    name: string;
    target_date: string;
    status: string;
    priority: number;
    description: string;
  }>;
  today: string;
}

export function buildReorganizePrompt(context: ReorganizePromptContext): string {
  // 分離「可整合任務」和「已有結構任務」
  const tasksCanConsolidate: string[] = [];
  const tasksWithStructure: string[] = [];

  context.tasks.forEach((t) => {
    const baseLine = `[${t.id}] ${t.content}${t.narrative ? ` - ${t.narrative}` : ''} (${t.current_topic})`;

    if (t.has_sub_items) {
      // 已有結構：顯示子項目內容（不顯示 ID）
      const allSubItems = [...t.completed_sub_items, ...t.pending_sub_items.map(s => s.content)];
      let structuredTask = `${baseLine} ← 已有結構，不可整合\n`;

      allSubItems.forEach((content, subIdx) => {
        const prefix = subIdx === allSubItems.length - 1 ? '   └─' : '   ├─';
        structuredTask += `${prefix} ${content}\n`;
      });

      tasksWithStructure.push(structuredTask.trim());
    } else {
      // 可整合：只有一層
      tasksCanConsolidate.push(baseLine);
    }
  });

  let tasksCompact = '';

  if (tasksCanConsolidate.length > 0) {
    tasksCompact += '## 可整合的任務（只能使用這些 task_id）\n\n';
    tasksCanConsolidate.forEach((line, idx) => {
      tasksCompact += `${idx + 1}. ${line}\n`;
    });
  }

  if (tasksWithStructure.length > 0) {
    tasksCompact += '\n## 已有結構的任務（絕對不可整合）\n\n';
    tasksWithStructure.forEach((task, idx) => {
      tasksCompact += `${tasksCanConsolidate.length + idx + 1}. ${task}\n\n`;
    });
  }

  return `你是任務組織專家。分析以下任務並提出重組建議。

# 背景
Product: "${context.product_name}" (Area: ${context.area_name})
**現有分類數量**: ${context.current_topics.length} 個
**現有分類**: ${context.current_topics.join('、')}

## Tasks (共 ${context.tasks.length} 個):
${tasksCompact}

---

# ⚠️ 核心原則：整理 = 簡化，不是細分

**整理的目標**：讓用戶「一眼就能找到相關任務」，而不是「分得更細緻」

**強制規則**：
1. **保守原則**：能用現有分類就不要創建新分類
2. **數量限制**：新分類數量 ≤ 現有數量 + 1（最多只能多 1 個）
3. **合併優先**：有 2 個以上任務語意接近 → 先考慮合併到同一分類

**禁止行為**：
- ❌ 把一個分類拆成多個更細的分類
- ❌ 為了「更精準」而創建新分類
- ❌ 每個任務都有自己的分類

---

# 任務 1: Topic 分群

**核心判斷**：兩個任務「做 A 時需要知道 B」→ 同一 Topic

分群依據：
1. 目標相同 — 達成同一成果
2. 上下文相依 — 完成 A 需參考 B
3. 語義相近 — 描述同一件事

**Topic 命名規則**：
- 必須是具體的 5-10 字名詞片語（例：用戶認證、支付系統、API 錯誤修復）
- **嚴禁使用籠統名稱**：未分類、其他、雜項、待整理、TODO、其它
- 必須能清楚描述這組任務的共同目標或技術領域
- **優先使用現有分類名稱**：只有在現有分類完全不適用時才創建新的

---

# 任務 2: 結構優化

**概念釐清**：
- **Task** = 用 [task-xxx] 標記的頂層實體（有獨立 ID）
- **Sub-item** = 用 ├─ 或 └─ 顯示的內容（**不是** Task，無 ID）

**兩種整合場景**：

### 場景 A：創建新結構
把多個簡單 Task 組織成主任務+子項目

條件：同一成果、無獨立價值、語意可映射

### 場景 B：補充現有結構
把某個簡單 Task 添加到已有結構的 Task 中

條件：該 Task 在語意上屬於某個已有結構

**輸出規範**：
- parent_task_id: 主任務的 Task ID（場景 A 選其中一個，場景 B 選已有結構的）
- sub_task_ids: 要整合的 Task IDs（**只能**用 [task-xxx] 格式）
- consolidated_title: 10-20 字（場景 A 新標題，場景 B 保持原標題）

**關鍵規則**：
1. **絕對不可**使用 ├─ 或 └─ 後面的內容作為 ID
2. 語意守恆 — consolidated_title 必須能反推出所有子任務的意圖
3. 保守原則 — 不確定就別整合

**禁止整合**（任一即禁）：
- 獨立上下文 — 有各自的「為什麼」
- 可獨立完成 — 單獨完成有價值
- 語意無法映射 — 標題無法體現子任務

---

# 輸出規則
- 使用繁體中文
- 所有 task_id 必須來自上方列表
- Topic name: 5-10 字
- consolidated_title: 10-20 字
- reasoning: 最多 10 字`;
}
