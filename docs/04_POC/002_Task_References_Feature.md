# Task References 功能實作文件

## 功能概述

為 Task 增加參考資料(references)功能,讓使用者可以在任務中附加相關的網頁連結或文字備註。當 Task 合併為 sub-item 時,參考資料會自動合併並去除重複。

## 使用場景

- **網頁連結**: 將相關網頁 URL 附加到任務中,例如「開樂天手機門號」任務可以附加樂天官網連結
- **文字備註**: 添加純文字說明,例如「參考 John 的建議」、「見會議記錄」
- **合併保留**: 當 Task 合併時,所有參考資料會自動保留到新的 Task 中

## 技術實作

### 1. 資料模型

#### Backend (SQLModel)
```python
# backend/app/domain/models.py
class Task(BaseTable, table=True):
    # ...其他欄位
    references: List[Dict[str, Any]] = Field(default=[], sa_column=Column(JSON))
```

#### Frontend (TypeScript)
```typescript
// web/types/index.ts
export interface Reference {
  id: string;
  type: "url" | "note";
  content: string;
  title?: string | null;
  created_at: string;
}

export interface TaskCard {
  // ...其他欄位
  references?: Reference[];
}
```

### 2. Database Schema

#### PostgreSQL (Prisma)
```prisma
model Task {
  // ...其他欄位
  references  Json  @default("[]") @db.Json
}
```

#### Migration
```sql
-- backend/alembic/versions/10f3d93bc551_add_task_references_field.py
ALTER TABLE tasks ADD COLUMN references JSON DEFAULT '[]' NOT NULL;
```

### 3. API 端點

#### 新增 Reference
```
POST /api/tasks/[taskId]/references
Content-Type: application/json

{
  "type": "url" | "note",
  "content": "網址或文字內容",
  "title": "可選的標題"  // 僅 URL 型態適用
}

Response:
{
  "success": true,
  "reference": { ...新增的 reference },
  "total": 3
}
```

#### 刪除 Reference
```
DELETE /api/tasks/[taskId]/references?referenceId=xxx

Response:
{
  "success": true,
  "total": 2
}
```

#### 更新 Reference
```
PATCH /api/tasks/[taskId]/references/[referenceId]
Content-Type: application/json

{
  "content": "更新的內容",
  "title": "更新的標題"
}

Response:
{
  "success": true,
  "reference": { ...更新後的 reference }
}
```

### 4. Task 合併邏輯

當 Task A 合併到 Task B 時:

1. **自動合併 references**: 將 A 的 references 加入 B 的 references
2. **URL 去重**:
   - 對於 `type: "url"` 的參考資料,會檢查 URL 是否重複
   - 使用 `content.toLowerCase().trim()` 進行比對
   - 重複的 URL 會被過濾掉
3. **保留所有 note**:
   - 對於 `type: "note"` 的參考資料,全部保留
   - 因為文字備註可能內容相同但語境不同

實作位置: [/web/app/api/tasks/[taskId]/merge-into/route.ts](../../web/app/api/tasks/[taskId]/merge-into/route.ts#L100-L126)

```typescript
// 合併 references（自動去重）
const sourceReferences = (sourceTask.references as Reference[]) || [];
const targetReferences = (targetTask.references as Reference[]) || [];

const mergedReferences = [...targetReferences];
const existingUrls = new Set(
  targetReferences
    .filter(ref => ref.type === "url")
    .map(ref => ref.content.toLowerCase().trim())
);

for (const ref of sourceReferences) {
  if (ref.type === "url") {
    // URL 型態：檢查是否重複
    const normalizedUrl = ref.content.toLowerCase().trim();
    if (!existingUrls.has(normalizedUrl)) {
      mergedReferences.push(ref);
      existingUrls.add(normalizedUrl);
    }
  } else {
    // note 型態：直接加入（保留所有備註）
    mergedReferences.push(ref);
  }
}
```

### 5. UI 組件

#### Task Card 顯示
位置: [/web/components/kanban/task-card.tsx](../../web/components/kanban/task-card.tsx)

- **ReferencesList 組件**: 顯示所有參考資料
- **URL 型態**: 顯示為可點擊的超連結,附帶外部連結圖示
- **Note 型態**: 顯示為純文字,附帶文件圖示
- **點擊行為**: URL 會在新分頁開啟,不影響當前頁面

## 使用範例

### 1. 新增 URL 參考資料
```bash
curl -X POST http://localhost:3000/api/tasks/task-123/references \
  -H "Content-Type: application/json" \
  -d '{
    "type": "url",
    "content": "https://network.mobile.rakuten.co.jp/",
    "title": "樂天手機官網"
  }'
```

### 2. 新增文字備註
```bash
curl -X POST http://localhost:3000/api/tasks/task-123/references \
  -H "Content-Type: application/json" \
  -d '{
    "type": "note",
    "content": "參考 John 在 2026-01-26 會議中的建議"
  }'
```

### 3. Task 合併範例

**合併前:**
- Task A: "開樂天門號"
  - Reference 1: `https://rakuten.co.jp` (URL)
  - Reference 2: "月租費 1980 円" (Note)
- Task B: "辦理手機相關事務"
  - Reference 3: `https://rakuten.co.jp` (URL, 重複)
  - Reference 4: "需帶身分證" (Note)

**合併後 (Task B):**
- References:
  - `https://rakuten.co.jp` (URL, 去重只保留一個)
  - "需帶身分證" (Note)
  - "月租費 1980 円" (Note, 從 Task A 合併過來)

## 相關檔案

### Backend
- [backend/app/domain/models.py](../../backend/app/domain/models.py#L109-L133) - Task Model 定義
- [backend/app/domain/schemas.py](../../backend/app/domain/schemas.py#L44-L73) - Reference Schemas
- [backend/alembic/versions/10f3d93bc551_add_task_references_field.py](../../backend/alembic/versions/10f3d93bc551_add_task_references_field.py) - Migration

### Frontend
- [web/types/index.ts](../../web/types/index.ts#L66-L74) - TypeScript 型別定義
- [web/components/kanban/task-card.tsx](../../web/components/kanban/task-card.tsx#L30-L62) - UI 組件
- [web/prisma/schema.prisma](../../web/prisma/schema.prisma#L83-L104) - Prisma Schema

### API Routes
- [web/app/api/tasks/[taskId]/references/route.ts](../../web/app/api/tasks/[taskId]/references/route.ts) - 新增/刪除 API
- [web/app/api/tasks/[taskId]/references/[referenceId]/route.ts](../../web/app/api/tasks/[taskId]/references/[referenceId]/route.ts) - 更新 API
- [web/app/api/tasks/[taskId]/merge-into/route.ts](../../web/app/api/tasks/[taskId]/merge-into/route.ts) - 合併邏輯

### 規格文件
- [docs/01_Specification/008_Database_Schema_Spec.md](../01_Specification/008_Database_Schema_Spec.md#L128-L145) - Database Schema 規格

## 後續優化建議

### 1. UI/UX 改進
- [ ] 在 Task 詳情頁面增加「新增參考資料」按鈕
- [ ] 支援拖曳檔案來創建參考資料
- [ ] 支援編輯現有的 reference
- [ ] 顯示 URL 的 favicon 或預覽圖

### 2. AI 整合
- [ ] Brain Dump 時自動識別輸入中的 URL 並提取為 references
- [ ] 自動抓取 URL 的標題和預覽資訊
- [ ] AI 建議相關的參考資料

### 3. 進階功能
- [ ] 支援檔案路徑參考 (type: "file")
- [ ] 支援內部實體連結 (type: "internal", 連結到其他 Task/Product/Area)
- [ ] Reference 的排序和分類
- [ ] Reference 的使用統計 (點擊次數、最後訪問時間)

## 測試檢查清單

- [x] Database Migration 執行成功
- [x] Backend Models 正確定義 references 欄位
- [x] Frontend TypeScript 型別定義完整
- [x] Task Card 可以顯示 references
- [x] POST API 可以新增 reference
- [x] DELETE API 可以刪除 reference
- [x] PATCH API 可以更新 reference
- [x] Task 合併時 references 正確合併
- [x] URL 去重邏輯正確運作
- [ ] 撰寫單元測試 (待實作)
- [ ] 撰寫整合測試 (待實作)

---

**實作日期**: 2026-01-26
**實作者**: Claude Code (Sonnet 4.5)
**版本**: v1.0
