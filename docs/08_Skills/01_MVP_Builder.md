# Skill 1: 最小可行性產品解構器 (MVP Builder) 執行模組

## 1. 模組定義 (Metadata)
- **ID**: `skill_mvp_builder`
- **觸發意圖 (Intent Regex/Embedding)**:
  `["想做一個", "開發...MVP", "測試...想法", "新產品"]`
- **所需權限 (Scopes)**: `read:user_momentum`, `write:tasks`, `write:projects`

---

## 2. Pre-Script: 上下文收集程式 (Context Fetcher)
在呼叫 LLM 之前，系統必須先執行這段 Script，獲取用戶當前的「動能狀態」與「歷史偏差」，以此作為 Prompt 的變數。

```typescript
// scripts/fetchContext.ts
async function getMvpBuilderContext(userId: string) {
  // 1. 獲取用戶當前動能水位 (Momentum)
  const activeP0Projects = await db.projects.count({ where: { userId, priority: 'P0', status: 'ACTIVE' } });
  
  // 2. 獲取開發類任務的歷史偏差值 (Episodic Memory)
  const devBias = await biasTracker.getCategoryBias(userId, 'development'); 

  // 3. 判斷負載狀態
  const isOverloaded = activeP0Projects >= 2;
  const targetArea = isOverloaded ? 'P2 Maintenance' : 'P0 Focus';

  return {
    isOverloaded,
    targetArea,
    devBiasRatio: devBias.ratio // 例如: 2.1 (代表通常低估2倍時間)
  };
}
```

---

## 3. LLM Engine (Prompt & Required JSON Schema)

將 `Pre-Script` 拿到的 Context 動態注入到 System Prompt 中，並且**強制規定 LLM 只准輸出符合下方 JSON Schema 的格式**。

### System Prompt 模板
```text
你是一個精實創業 (Lean Startup) 專家與 Zentropy 專案規劃器。
用戶想開發一個新產品 MVP。
[系統注入Context: 該用戶開發類任務通常低估 {{devBiasRatio}} 倍時間。目前他的首要目標區已滿 ({{isOverloaded}})，請建議將此計畫排入 {{targetArea}}。]

請將 MVP 拆解為「驗證期、設計期、實作期、上線前」四個 Phase。
實作期的估計時間請自動乘上 {{devBiasRatio}} 以確保計畫寫實。
輸出的任務清單必須維持微小與可執行性 (Actionable)。
```

### 預期產出的 JSON Schema (Structured Output)
```json
{
  "type": "object",
  "properties": {
    "project_name": { "type": "string" },
    "suggested_priority": { "type": "string", "enum": ["P0", "P1", "P2", "P3"] },
    "coach_message": { "type": "string", "description": "負責向用戶解釋為何這樣排程的溫暖話語" },
    "phases": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "phase_name": { "type": "string" },
          "tasks": {
            "type": "array",
            "items": {
              "title": { "type": "string" },
              "estimated_hours": { "type": "number" },
              "tag": { "type": "string", "enum": ["@外包", "@開發", "@驗證"] }
            }
          }
        }
      }
    }
  }
}
```

---

## 4. Post-Script: 狀態變異與後續動作 (Action Executor)
當 LLM 回傳正確的 JSON 後，絕不是只把文字印在螢幕上。這段 Script 將負責把計畫「變成真實的系統物件」。

```typescript
// scripts/executeBuilder.ts
async function executeMvpBuilder(userId: string, llmOutput: MvpPlanJson) {
  // 1. 在 Zentropy 資料庫中建置實體 Project
  const newProject = await zentropyAPI.createProject({
    userId,
    name: llmOutput.project_name,
    priority: llmOutput.suggested_priority // 系統會依據負載自動建議 P2
  });

  // 2. 遍歷 Phases，建立帶有關聯的 Task 與 Subtask
  for (const phase of llmOutput.phases) {
    const parentTask = await zentropyAPI.createTask({
      projectId: newProject.id,
      title: phase.phase_name,
    });

    for (const task of phase.tasks) {
      await zentropyAPI.createSubtask(parentTask.id, {
        title: task.title,
        estimatedHours: task.estimated_hours,
        tags: [task.tag]
      });
    }
  }

  // 3. 觸發 LINE / 系統推播，要求用戶確認
  await notificationService.sendUIBlock(userId, {
    message: llmOutput.coach_message, // "老闆，您的 MVP 拆解好了，考量到您最近...所以安排在 P2..."
    actionButton: "一鍵啟用計畫"
  });
}
```

## 總結：這是 Agent，不是 Prompt
透過這個架構，MVP Builder 才真正具備了 Zentropy 的靈魂：**能感知用戶現況 (Pre-script) -> 能運用領域知識 (LLM) -> 能自動改變世界狀態 (Post-script)。**
