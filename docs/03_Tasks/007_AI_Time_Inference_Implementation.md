# Task 007: AI Time Inference System Implementation

**Status**: In Progress
**Owner**: Antigravity
**Dependencies**:
- `docs/02_Plan/010_AI_Time_Inference_System.md`
- `docs/01_Specification/008_Database_Schema_Spec.md`
- `backend/app/domain/models.py`

## 1. 目標 (Objective)

實作完整的 AI 時間維度智能推斷系統,讓用戶輸入碎片化訊息時能自動推斷任務完成時間,並在 Dashboard 提供時間視圖與 Milestone 管理功能。

## 2. 範圍 (Scope)

### 核心功能
- **多層級 Milestone 系統**: 允許在 Area/Product/Topic 設定多個里程碑
- **AI 時間推斷引擎**: 基於 Milestone 上下文自動推斷 Task due_date
- **Timeline View**: 按時間分組顯示任務 (今天/本週/下週/逾期)
- **Gantt View**: 視覺化時間軸與里程碑關係 (後續 Phase)
- **Milestone 管理 UI**: 建立/編輯/刪除里程碑

### 涉及檔案
- Backend:
  - `backend/app/domain/models.py` - 新增 Milestone model, 擴充 Task
  - `backend/alembic/versions/` - Database migration
  - `backend/app/services/librarian.py` - AI 推斷引擎
  - `backend/app/interface/api/` - 新增 API endpoints
- Frontend:
  - `frontend/main.py` - Timeline View & Milestone UI

## 3. 實作規格 (Implementation Specs)

### Phase 1: 資料模型與 Migration ⏳

#### 1.1 新增 Milestone Model
```python
class MilestoneStatusEnum(str, PyEnum):
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DELAYED = "delayed"
    CANCELLED = "cancelled"

class MilestoneEntityTypeEnum(str, PyEnum):
    AREA = "area"
    PRODUCT = "product"
    TOPIC = "topic"

class Milestone(BaseTable, table=True):
    __tablename__ = "milestones"

    user_id: uuid.UUID = Field(foreign_key="users.id")
    entity_type: MilestoneEntityTypeEnum
    entity_id: uuid.UUID  # Polymorphic reference

    name: str  # 里程碑名稱 (如 "MVP Release")
    target_date: datetime
    status: MilestoneStatusEnum = Field(default=MilestoneStatusEnum.PLANNED)
    priority: int = Field(default=5, ge=1, le=10)  # 優先級權重
    description: Optional[str] = None

    user: User = Relationship(back_populates="milestones")
```

#### 1.2 擴充 Task Model
新增欄位:
```python
due_date: Optional[datetime] = None
inferred_from_milestone_id: Optional[uuid.UUID] = Field(default=None, foreign_key="milestones.id")
time_confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
urgency_level: Optional[str] = None  # CRITICAL / HIGH / MEDIUM / LOW
```

擴充 `ai_analysis` JSON 欄位內容:
- `time_reasoning`: 推斷理由
- `related_milestone_ids`: 關聯的 Milestone ID 列表
- `original_inferred_date`: 原始推斷日期 (用於修正記錄)

#### 1.3 Database Migration
- 建立 Alembic migration script
- 執行 `alembic revision --autogenerate -m "add_milestone_and_task_time_fields"`
- 驗證 migration 成功

---

### Phase 2: AI 時間推斷引擎 🤖

#### 2.1 核心推斷邏輯 (`LibrarianService`)

新增方法: `infer_task_due_dates(tasks: List[Task], user_id: UUID) -> List[Task]`

**推斷策略三階段**:

**階段 A - 強關聯 (Confidence: 0.8-1.0)**
- Task 名稱包含 Milestone 關鍵字
- 規則: due_date = milestone.target_date - 3~7 天

**階段 B - 中關聯 (Confidence: 0.5-0.8)**
- Task 屬於有 Milestone 的 Product/Topic
- 根據任務性質分配時間 (設計 < 開發 < 測試 < 部署)
- 預留 20% 緩衝時間

**階段 C - 弱關聯 (Confidence: 0.2-0.5)**
- 無明確 Milestone, 根據 Drawer 狀態推斷:
  - ACTIVE → 7 天內
  - INBOX → 14 天內
  - MAINTAIN → 30 天內
  - REFERENCE → 不設定 due_date

#### 2.2 Gemini Prompt 設計

載入上下文:
- 用戶所有未來 90 天內的 Milestones
- 現有 Tasks 時間分佈
- 今天日期與當前工作負載

輸出格式 (JSON Schema):
```json
{
  "task_id": "uuid",
  "inferred_due_date": "2026-02-15",
  "related_milestone_ids": ["milestone_uuid_1", "milestone_uuid_2"],
  "reasoning": "此任務需在 OAuth 整合完成前完成,設定為 2/10",
  "confidence": 0.85,
  "urgency_level": "HIGH"
}
```

#### 2.3 時間衝突處理
- 檢測同一天已有多少 tasks
- 自動分散: 5 個 tasks 同一天 → 分配到前後 5 天

---

### Phase 3: Backend API Endpoints 🔌

#### 3.1 Milestone CRUD
- `POST /api/milestones` - 建立里程碑
- `GET /api/milestones?entity_type=product&entity_id={id}` - 查詢實體的所有里程碑
- `PATCH /api/milestones/{id}` - 更新里程碑
- `DELETE /api/milestones/{id}` - 刪除里程碑

#### 3.2 Task API 擴充
- `GET /api/tasks` - 新增 query params: `due_after`, `due_before`, `urgency_level`
- `GET /api/tasks/timeline` - 回傳按時間分組的任務:
  ```json
  {
    "overdue": [...],
    "today": [...],
    "this_week": [...],
    "next_week": [...],
    "later": [...],
    "no_due_date": [...]
  }
  ```

#### 3.3 整合至 brain-dump
- 修改 `/api/brain-dump` 流程:
  1. 原有的 task 識別與分類
  2. **新增**: 載入相關 Milestones
  3. **新增**: 呼叫 `infer_task_due_dates()`
  4. 持久化包含時間資訊的 Tasks

---

### Phase 4: Frontend Timeline View 📅

#### 4.1 視圖切換功能
在 Dashboard 頂部新增 Tab 切換:
- 🌳 **Structure View** (現有的樹狀結構)
- ⏰ **Timeline View** (按時間分組)
- 📊 **Gantt View** (Phase 5 實作)

#### 4.2 Timeline View 佈局
使用 `streamlit_elements` 實作:

```
┌─────────────────────────────────────┐
│  🔴 已逾期 (3)                      │
│  [Task Card] [Task Card] [Task Card]│
├─────────────────────────────────────┤
│  ⏰ 今天 (2)                         │
│  [Task Card] [Task Card]             │
├─────────────────────────────────────┤
│  📅 本週 (5)                         │
│  [Task Card] ...                     │
└─────────────────────────────────────┘
```

#### 4.3 Task Card 時間資訊顯示
擴充現有 Task Card:
- **時間標籤**: 顯示相對時間 (「逾期 2 天」、「明天」、「3 天後」)
- **信心標記**: Confidence < 0.6 顯示 ⚠ 警告圖示
- **Milestone 關聯**: 顯示 「🎯 關聯: MVP Release (3/1)」
- **AI 推斷理由**: Hover 時顯示氣泡提示

#### 4.4 手動調整時間
- 點擊日期標籤可直接編輯 due_date
- 修改後記錄至 `ai_analysis.user_corrections`

---

### Phase 5: Milestone 管理 UI 🎯

#### 5.1 Milestone 列表顯示
在 Product/Topic 詳情頁顯示相關 Milestones:

```
┌──────────────────────────────────────┐
│ 📌 里程碑                             │
├──────────────────────────────────────┤
│ 🔹 OAuth 整合完成                     │
│    2026-03-01 • 進行中 • 3 個任務    │
├──────────────────────────────────────┤
│ 🔹 安全審查通過                       │
│    2026-03-15 • 計劃中 • 1 個任務    │
├──────────────────────────────────────┤
│ + 新增里程碑                          │
└──────────────────────────────────────┘
```

#### 5.2 Milestone 建立/編輯 Modal
- 名稱輸入
- 目標日期選擇器
- 優先級滑桿 (1-10)
- 狀態下拉選單
- 描述 (選填)

#### 5.3 Milestone 進度追蹤
- 顯示關聯 Task 數量與完成率
- 剩餘天數倒數計時
- 延遲警告 (target_date < 今天且未完成)

---

## 4. 驗證計畫 (Verification Plan)

### 4.1 資料模型驗證
```python
# tests/test_models.py
def test_milestone_creation():
    milestone = Milestone(
        user_id=user.id,
        entity_type=MilestoneEntityTypeEnum.PRODUCT,
        entity_id=product.id,
        name="MVP Release",
        target_date=datetime(2026, 3, 1),
        priority=8
    )
    # Assert created successfully

def test_task_time_fields():
    task = Task(
        content="完成 OAuth",
        due_date=datetime(2026, 2, 25),
        time_confidence=0.85,
        urgency_level="HIGH"
    )
    # Assert fields are correctly set
```

### 4.2 AI 推斷引擎驗證
```python
# tests/test_time_inference.py
async def test_strong_association_inference():
    # Given: Milestone "OAuth 整合" (target: 3/1)
    # When: Task "完成 OAuth 登入"
    # Then: inferred_due_date = 2/25, confidence > 0.8

async def test_weak_association_inference():
    # Given: No Milestone, Task in ACTIVE drawer
    # Then: inferred_due_date = today + 7 days, confidence < 0.5

async def test_conflict_resolution():
    # Given: 5 tasks inferred to same date
    # Then: Tasks should be distributed across 5 days
```

### 4.3 API 整合測試
```bash
# 建立 Milestone
curl -X POST http://localhost:8000/api/milestones \
  -d '{"entity_type": "product", "entity_id": "...", "name": "MVP", "target_date": "2026-03-01"}'

# Brain Dump 應自動推斷時間
curl -X POST http://localhost:8000/api/brain-dump \
  -d '{"user_id": "...", "text": "完成 OAuth 登入功能"}'

# 驗證 Timeline API
curl http://localhost:8000/api/tasks/timeline?user_id=...
```

### 4.4 UI 驗證
- [ ] Timeline View 正確顯示分組任務
- [ ] 時間標籤顯示正確 (「今天」、「逾期」等)
- [ ] Confidence < 0.6 顯示警告圖示
- [ ] Milestone 管理 UI 可正常建立/編輯/刪除
- [ ] 手動調整時間後正確記錄至 user_corrections

---

## 5. 實作優先級與時程

| Phase | 內容 | 預估時間 | 狀態 |
|-------|------|---------|------|
| Phase 1 | 資料模型 + Migration | 2-3 小時 | To Do |
| Phase 2 | AI 推斷引擎核心邏輯 | 4-5 小時 | To Do |
| Phase 3 | Backend API endpoints | 3-4 小時 | To Do |
| Phase 4 | Frontend Timeline View | 4-5 小時 | To Do |
| Phase 5 | Milestone 管理 UI | 3-4 小時 | To Do |
| Testing | 整合測試與驗證 | 2-3 小時 | To Do |

**總計**: 約 18-24 小時開發時間

---

## 6. 風險與注意事項

### 6.1 技術風險
- **Gemini API Context Length**: Milestone 過多時可能超過 token 限制
  - 解法: 只載入未來 90 天內且相關的 Milestones

- **時間推斷準確度**: AI 可能推斷不準
  - 解法: 顯示信心分數,允許手動調整,記錄修正資料

- **Polymorphic Foreign Key**: Milestone 的 entity_id 是多態關聯
  - 解法: 使用 entity_type + entity_id 組合,應用層驗證完整性

### 6.2 UX 風險
- **過多自動化導致困惑**: 用戶不理解為何 Task 被分配到某日期
  - 解法: 顯示 AI 推斷理由 (time_reasoning)

- **時間視圖資訊過載**: 太多任務同時顯示
  - 解法: 提供篩選器 (按 Area/Product 過濾)

---

## 7. 成功標準

✅ Milestone 資料表成功建立,可存儲多層級里程碑
✅ Task 擴充欄位 (due_date, time_confidence) 運作正常
✅ AI 推斷引擎在 80% 案例下能給出合理 due_date
✅ Timeline View 正確按時間分組顯示任務
✅ Milestone 管理 UI 可建立/編輯/刪除里程碑
✅ 整合測試通過,無資料完整性問題
✅ 用戶可輕鬆手動調整 AI 推斷的時間

---

*此任務遵循 Naruvia Spec-Driven Development 與 TDD 原則,先實作 Domain Layer,再逐步向外擴展至 Infrastructure 與 Interface 層。*
