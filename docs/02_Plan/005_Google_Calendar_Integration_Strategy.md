# Google Calendar 整合策略設計 (Calendar Integration Strategy)

**⚠️ 重要前提**：本文件基於 Zentropy 的實際架構能力進行設計。

## 0. 架構約束 (Architecture Constraints)

### 0.1 Zentropy 的實際時間能力

**現有資料結構**：
```typescript
// Task Entity
dueDate: Date | null      // 日期級別（2026-02-10），無精確時間
startDate: Date | null    // 日期級別，無精確時間

// SubItem
interface SubItem {
  content: string
  completed: boolean
  // ❌ 無 dueDate, dueTime 欄位
}
```

**關鍵限制**：
- ✅ Zentropy 支援：Milestone 級別的截止日（`dueDate: Date`）
- ❌ Zentropy 不支援：精確到小時分鐘的時間管理（無 `dueTime`）
- ❌ Zentropy 不支援：Sub-item 獨立設定時間
- ❌ Zentropy 不支援：日程安排（Day Planner）功能

### 0.2 產品定位釐清

**Zentropy ≠ 時間管理工具**，而是「營運管理系統」。

| 維度 | Google Calendar | Zentropy |
|------|-----------------|----------|
| **本質** | 時間佔用管理 (Time Blocking) | 營運資產管理 (Asset Management) |
| **時間精度** | 精確到分鐘（14:00-15:30） | 日期級別（2026-02-10） |
| **關注點** | 「今天 14:00 有會議」 | 「X 專案本週到期」 |
| **資料模型** | Event (時間點) | Task (業務實體 + Status × Entity) |
| **用戶行為** | 被動接受邀請 | 主動規劃與執行 |
| **系統職責** | 記錄時間佔用 | 預警 Milestone 衝突 |

---

## 1. 問題定義 (Problem Statement)

### 1.1 核心挑戰
使用者的 Google Calendar 可能包含大量事件（會議、約會、提醒、生日等），如果全部同步到 Zentropy 的任務系統，會導致：

| 問題 | 後果 | 嚴重性 |
|------|------|--------|
| **視圖污染** | Active 抽屜被大量「被動事件」淹沒，無法聚焦真正需要推進的任務 | 🔴 高 |
| **認知過載** | 使用者無法區分「主動營運任務」vs「被動參加會議」 | 🔴 高 |
| **語義混亂** | 違反雙軸模型定義：Calendar Event ≠ Zentropy Task | 🔴 高 |
| **時間精度不匹配** | Calendar 是分鐘級（14:00），Zentropy 是日期級（2026-02-10） | 🟡 中 |

### 1.2 實際可行的整合目標

**基於現有架構，Calendar 整合的實際價值是**：

| 場景 | Zentropy 能力 | Calendar 整合價值 |
|------|--------------|------------------|
| ✅ **Milestone 提醒** | Task 有 `dueDate`（日期級別） | 將 Task Due Date 同步到 Calendar 作為全天事件 |
| ✅ **容量預警** | 統計「今日到期任務數量」 | Coach 分析「今天 3 個任務到期 + 會議 4 小時 = 超載」 |
| ✅ **全局視角** | Active 抽屜只顯示任務 | Optional Timeline 視圖顯示「任務 Milestone + Calendar 事件」 |
| ❌ **精確衝突偵測** | Task 無 `dueTime` | 無法實現「14:00 任務 vs 14:00 會議」級別的衝突 |
| ❌ **日程安排** | 無 Day Planner 功能 | 無法實現「自動排程任務到空檔時間」 |

---

## 2. 整合策略：分層隔離架構 (Layered Isolation)

### 2.1 架構設計 (System Architecture)

```
┌───────────────────────────────────────────────────────────────────┐
│  Frontend Layer: 視圖隔離 (View Isolation)                         │
├───────────────────────────────────────────────────────────────────┤
│  View 1: Active 抽屜 (純任務視圖)                                  │
│  - 只顯示 Zentropy Tasks                                           │
│  - 雙軸模型：Status (Active/Maintain) × Entity (Area/Product)     │
│  - ✅ 絕對不會顯示 Calendar Events                                 │
├───────────────────────────────────────────────────────────────────┤
│  View 2: Timeline 視圖 (時間軸視圖)                                │
│  - Zentropy Tasks (Due Date 標記)                                 │
│  - Calendar Events (灰色背景，作為「時間佔用」參考)                │
│  - ⚠️ Conflict Highlights（由 Coach 標記的衝突預警）               │
└───────────────────┬───────────────────────────────────────────────┘
                    ▼ (Backend Services)
┌───────────────────────────────────────────────────────────────────┐
│  Service Layer: 單向同步 + 背景分析                                │
├───────────────────────────────────────────────────────────────────┤
│  Service 1: Task → Calendar Sync (單向同步)                        │
│  - Zentropy Task 的 Due Date 寫入 Google Calendar                 │
│  - 由 App 端 CalendarRepository 處理（已實作）                     │
│  - ✅ App → Calendar (單向)                                        │
│  - ❌ Calendar → Zentropy (絕對禁止)                               │
├───────────────────────────────────────────────────────────────────┤
│  Service 2: Calendar Event Reader (背景讀取)                       │
│  - Coach Agent 透過 MCP 讀取 Google Calendar Events                │
│  - 只用於「衝突偵測」，不寫入 Zentropy 資料庫                       │
│  - ✅ 分析時間衝突、計算可用時間                                    │
│  - ❌ 不會創建 Zentropy Tasks                                      │
└───────────────────┬───────────────────────────────────────────────┘
                    ▼ (External API)
┌───────────────────────────────────────────────────────────────────┐
│  Google Calendar API (外部真實來源)                                │
│  - 使用者的會議、約會、提醒等事件                                   │
│  - Zentropy 同步過去的 Task Due Dates                              │
└───────────────────────────────────────────────────────────────────┘
```

### 2.2 核心設計原則

| 原則 | 說明 | 強制性 |
|------|------|--------|
| **單向同步** | Task → Calendar，絕不反向 | 🔴 強制 |
| **視圖隔離** | Active 抽屜只顯示 Tasks | 🔴 強制 |
| **背景分析** | Coach 讀取 Calendar 用於衝突偵測，不污染主資料 | 🔴 強制 |
| **選擇性展示** | Timeline 視圖可選擇性顯示 Calendar Events（灰色背景） | 🟢 可選 |

---

## 3. 技術實作規格 (Technical Specifications)

### 3.1 已實作部分 (Existing Implementation)

✅ **App → Calendar Sync** (`docs/03_Tasks/Google_Calendar_Sync_Implementation.md`)

- Flutter App 的 `CalendarRepository`
- 同步 Zentropy Task 的 Due Date 到 Google Calendar
- 儲存 `calendarEventId` 以支援更新/刪除

### 3.2 需新增部分 (New Requirements)

#### 3.2.1 Coach Agent: Calendar Event Reader

**檔案**: `backend/infrastructure/mcp/calendar_mcp_client.py`

**功能**:
```python
class CalendarMCPClient:
    """Coach Agent 用於讀取 Google Calendar 事件的 MCP Client"""

    async def get_events_in_range(
        self,
        user_id: str,
        start_date: datetime,
        end_date: datetime
    ) -> list[CalendarEvent]:
        """
        讀取指定時間範圍內的 Calendar Events

        ⚠️ 注意：此方法只讀取，絕不寫入 Zentropy 資料庫

        用途：
        1. 容量分析：計算每日的會議總時數
        2. 晨報/晚報：提醒今日/明日的會議行程
        3. 週視圖：顯示本週的時間佔用情況
        """
        pass

    async def analyze_daily_capacity(
        self,
        user_id: str,
        date: datetime,
        zentropy_tasks: list[Task]
    ) -> DailyCapacityReport:
        """
        容量分析：Zentropy Task Due Date (日期級別) + Calendar Events (小時級別)

        返回：
        {
          "date": "2026-02-10",
          "tasks_due_count": 3,
          "tasks_due": [
            {
              "id": "uuid",
              "content": "處理 A 專案進度報告",
              "due_date": "2026-02-10"  // ⚠️ 只有日期，無精確時間
            }
          ],
          "calendar_events": [
            {
              "summary": "團隊週會",
              "start": "2026-02-10T10:00:00Z",
              "end": "2026-02-10T11:30:00Z",
              "duration_hours": 1.5
            }
          ],
          "total_meeting_hours": 4.0,
          "capacity_status": "OVERLOAD",  // or "TIGHT", "NORMAL"
          "alert_level": "HIGH",
          "suggestions": [
            "建議延後「B 功能開發」至明日",
            "優先完成「A 專案進度報告」"
          ]
        }
        """
        pass
```

#### 3.2.2 Backend API: Capacity Analysis Endpoint

**路徑**: `POST /api/coach/analyze-capacity`

**請求**:
```json
{
  "user_id": "uuid",
  "date_range": {
    "start": "2026-02-10",
    "end": "2026-02-17"
  }
}
```

**響應**:
```json
{
  "daily_reports": [
    {
      "date": "2026-02-10",
      "tasks_due_count": 3,
      "tasks_due": [
        {
          "id": "task-uuid",
          "content": "處理 A 專案進度報告",
          "due_date": "2026-02-10",  // ⚠️ 只有日期
          "product_name": "Backend System"
        }
      ],
      "calendar_summary": {
        "total_events": 3,
        "total_meeting_hours": 4.0,
        "events": [
          {
            "summary": "團隊週會",
            "start": "2026-02-10T10:00:00Z",
            "end": "2026-02-10T11:30:00Z"
          }
        ]
      },
      "capacity_status": "OVERLOAD",  // OVERLOAD, TIGHT, NORMAL
      "alert_level": "HIGH",          // HIGH, MEDIUM, LOW
      "suggestions": [
        "建議延後「B 功能開發」至明日",
        "優先完成「A 專案進度報告」"
      ]
    }
  ],
  "weekly_summary": {
    "overload_days": 1,
    "tight_days": 2,
    "light_days": 2,
    "milestone_days": ["2026-02-10", "2026-02-13"]
  }
}
```

#### 3.2.3 Frontend: Weekly Overview (Optional)

**檔案**: `web/app/weekly-overview/page.tsx` (新增)

**功能**:
- 週視圖：顯示 7 天的容量狀況
- 每日卡片顯示：
  - ✅ Zentropy Tasks（到期任務數量 + 列表）
  - ✅ Calendar Events（會議總時數 + 重要會議）
  - ✅ 容量狀態（OVERLOAD 🔴 / TIGHT 🟡 / NORMAL 🟢）
- **不是** Timeline（因為 Task 無精確時間）

**視覺設計**:
```
┌─────────────────────────────────────────────────────────┐
│  本週概況（2026-02-10 ~ 2026-02-16）                     │
├─────────────────────────────────────────────────────────┤
│  週一 2/10 🔴 OVERLOAD                                   │
│  ├─ 📋 到期任務（3）                                     │
│  │   • 處理 A 專案進度報告                              │
│  │   • 完成 B 功能開發                                  │
│  │   • 回覆客戶需求                                     │
│  └─ 📅 會議（4 小時）                                    │
│      • 10:00 團隊週會                                   │
│      • 14:00 客戶簡報                                   │
├─────────────────────────────────────────────────────────┤
│  週二 2/11 🟢 NORMAL                                     │
│  ├─ 📋 到期任務（1）                                     │
│  │   • 撰寫技術文件                                     │
│  └─ 📅 會議（1 小時）                                    │
│      • 15:00 Code Review                                │
└─────────────────────────────────────────────────────────┘
```

**重要規則**:
- ✅ 只顯示「日期級別」的資訊（無精確時間軸）
- ❌ 絕對不允許「點擊 Calendar Event 創建 Zentropy Task」的功能
- ✅ Calendar Events 只作為「會議總時數」的參考，不會轉換為任務

---

## 4. 容量預警邏輯 (Capacity Alert Logic)

### 4.1 預警類型定義（日期級別）

**重要**：由於 Zentropy Task 只有 `dueDate`（日期），無法進行「精確到小時」的衝突偵測。只能提供「日期級別的容量預警」。

| 類型 | 定義 | 嚴重性 | 建議 |
|------|------|--------|------|
| `OVERLOAD_DAY` | 單日到期任務 ≥ 3 個 + Calendar 事件 > 4 小時 | 🔴 HIGH | 延後部分任務或重新評估優先級 |
| `TIGHT_DAY` | 單日到期任務 2 個 + Calendar 事件 > 6 小時 | 🟡 MEDIUM | 預警：當日行程緊湊 |
| `MILESTONE_DAY` | 單日有重要專案的 Milestone | 🟡 MEDIUM | 確保留足時間處理 |
| `MEETING_HEAVY` | 單日 Calendar 事件 > 6 小時 | 🟢 LOW | 提醒：會議密集日 |

### 4.2 Coach 晨報整合

**時間**: 每日 08:30

**內容範本**（符合實際能力）:
```
☀️ 早安，今日容量分析：

📋 今日到期任務（3 個）：
  - [Active] 處理 A 專案進度報告
  - [Active] 完成 B 功能開發
  - [Active] 回覆客戶需求

📅 行事曆事件（4 小時）：
  - 10:00-11:30  團隊週會（1.5 小時）
  - 14:00-15:00  客戶簡報（1 小時）
  - 16:30-17:00  1-on-1（0.5 小時）

⚠️ 容量預警：
  🔴 超載風險：今日 3 個任務到期 + 會議 4 小時
     建議：評估是否將「B 功能開發」延後至明日

  🟡 建議：優先完成「A 專案進度報告」（客戶簡報前需完成）

📊 本週概況：
  - 明日：1 個任務到期，行程較輕鬆
  - 週三：Milestone 日（2 個專案截止）
  - 週五：0 個任務到期（可安排緩衝）
```

**關鍵差異**：
- ❌ 不會說「14:00 任務與 14:00 會議衝突」（無法知道任務的精確時間）
- ✅ 會說「今日 3 個任務到期 + 4 小時會議 = 超載」（日期級別的容量分析）
- ✅ 會說「優先完成 X」（基於任務的業務邏輯，而非時間衝突）

---

## 5. 邊界情況處理 (Edge Cases)

### 5.1 Calendar 事件標題模糊

**問題**: Calendar Event 的 `summary` 可能是「Meeting」「Lunch」等模糊描述

**解決**:
- Coach 不嘗試「理解」Calendar 事件內容
- 只關注「時間佔用」這個事實（計算總時數）
- 容量預警格式：「今日 3 個任務到期 + 會議 4 小時」（不解析具體會議內容）

### 5.2 全天事件 (All-Day Events)

**問題**: 「生日」「國定假日」等全天事件不應計入「會議時數」

**解決**:
```python
def calculate_meeting_hours(events: list[CalendarEvent]) -> float:
    """計算實際佔用的會議時數（排除全天事件）"""
    total_hours = 0.0

    for event in events:
        # 全天事件不計入會議時數
        if event.all_day:
            continue

        # 「已拒絕」的會議邀請不計入
        if event.response_status == "declined":
            continue

        # 短於 15 分鐘的事件視為「提醒」，不計入
        if event.duration_minutes < 15:
            continue

        total_hours += event.duration_hours

    return total_hours
```

### 5.3 循環事件 (Recurring Events)

**問題**: 每週一 10:00 的週會，需要展開為具體日期

**解決**:
- 使用 Google Calendar API 的 `singleEvents=true` 參數
- API 會自動展開循環事件為具體實例

---

## 6. 隱私與權限 (Privacy & Permissions)

### 6.1 OAuth Scope 最小化

```dart
// Flutter App
GoogleSignIn(
  scopes: [
    'email',
    'https://www.googleapis.com/auth/calendar.events',  // 讀寫權限
  ],
)
```

### 6.2 Backend MCP Client

```python
# Backend 的 Calendar Reader 只需要「唯讀」權限
CALENDAR_READONLY_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'
```

### 6.3 資料保留策略

| 資料 | 儲存位置 | 保留期限 | 用途 |
|------|----------|----------|------|
| **Calendar Events** | ❌ 不儲存 | N/A | 即時讀取，不持久化 |
| **Conflict Analysis** | Firestore `sessions` | 24 小時 | 晨報/晚報使用後清除 |
| **calendarEventId** | Firestore `tasks` | 永久 | 用於更新/刪除同步事件 |

**重要規則**:
- ✅ Backend 只在「需要時」讀取 Calendar（晨報/晚報觸發）
- ❌ 絕對不會「批量同步」Calendar Events 到 Firestore
- ✅ 分析結果（Conflict）只暫存 24 小時

---

## 7. 實作階段規劃 (Implementation Phases)

### Phase 1: App → Calendar Sync (已完成 ✅)
- [x] Flutter `CalendarRepository`
- [x] 同步 Task Due Date 到 Google Calendar
- [x] 儲存 `calendarEventId`

### Phase 2: Coach Calendar Reader (Backend)
- [ ] **Task 7.1**: 實作 `CalendarMCPClient`（MCP Client for Calendar API）
- [ ] **Task 7.2**: 實作 `ConflictDetectionService`（衝突偵測邏輯）
- [ ] **Task 7.3**: 新增 API Endpoint `/api/coach/detect-conflicts`
- [ ] **Task 7.4**: 整合到晨報 Use Case (`MorningBriefingUseCase`)

### Phase 3: Frontend Timeline View (Optional)
- [ ] **Task 8.1**: 新增 `web/app/timeline/page.tsx`
- [ ] **Task 8.2**: 實作時間軸視圖（Tasks + Calendar Events）
- [ ] **Task 8.3**: 衝突高亮顯示
- [ ] **Task 8.4**: 用戶設定：「是否顯示 Calendar Events」Toggle

### Phase 4: Advanced Features (Future)
- [ ] AI 排程建議：「根據 Calendar 空檔自動建議任務執行時間」
- [ ] 能量管理：「根據會議密度調整任務優先級」
- [ ] 多日曆整合：支援 Outlook、Apple Calendar

---

## 8. 測試策略 (Testing Strategy)

### 8.1 單元測試

**檔案**: `backend/tests/unit/services/test_capacity_analysis.py`

```python
def test_overload_day_detection():
    """測試：3 個任務到期 + 4 小時會議 = OVERLOAD"""
    tasks = [
        Task(due_date="2026-02-10", content="A"),
        Task(due_date="2026-02-10", content="B"),
        Task(due_date="2026-02-10", content="C"),
    ]
    events = [
        CalendarEvent(start="2026-02-10T10:00:00Z", end="2026-02-10T11:30:00Z"),  # 1.5h
        CalendarEvent(start="2026-02-10T14:00:00Z", end="2026-02-10T16:00:00Z"),  # 2h
        CalendarEvent(start="2026-02-10T16:30:00Z", end="2026-02-10T17:00:00Z"),  # 0.5h
    ]

    report = analyze_daily_capacity(date="2026-02-10", tasks=tasks, events=events)

    assert report.tasks_due_count == 3
    assert report.total_meeting_hours == 4.0
    assert report.capacity_status == "OVERLOAD"
    assert report.alert_level == "HIGH"

def test_normal_day():
    """測試：1 個任務到期 + 2 小時會議 = NORMAL"""
    tasks = [Task(due_date="2026-02-10", content="A")]
    events = [CalendarEvent(start="2026-02-10T10:00:00Z", end="2026-02-10T12:00:00Z")]

    report = analyze_daily_capacity(date="2026-02-10", tasks=tasks, events=events)

    assert report.capacity_status == "NORMAL"
    assert report.alert_level == "LOW"
```

### 8.2 整合測試

**檔案**: `backend/tests/integration/test_calendar_mcp_client.py`

```python
async def test_read_calendar_events():
    """測試：透過 MCP 讀取真實 Calendar Events"""
    client = CalendarMCPClient()

    events = await client.get_events_in_range(
        user_id="test-user",
        start_date=datetime(2026, 2, 10),
        end_date=datetime(2026, 2, 17)
    )

    assert len(events) > 0
    assert all(isinstance(e, CalendarEvent) for e in events)
```

---

## 9. 成功指標 (Success Metrics)

| 指標 | 目標 | 測量方式 |
|------|------|----------|
| **視圖純淨度** | Active 抽屜 100% 只顯示 Zentropy Tasks | 前端邏輯審查 |
| **衝突偵測準確率** | > 95% | 用戶回報 + A/B 測試 |
| **晨報實用性** | > 80% 用戶認為「有幫助」 | 用戶問卷 |
| **API 延遲** | Calendar Reader < 500ms | APM 監控 |
| **隱私合規** | 0 次 Calendar Events 持久化 | 資料庫審計 |

---

## 10. 風險與緩解 (Risks & Mitigations)

| 風險 | 嚴重性 | 緩解措施 |
|------|--------|----------|
| **用戶誤解產品定位** | 🔴 高 | Onboarding 明確說明：Zentropy ≠ Calendar App |
| **API 速率限制** | 🟡 中 | 實作 Exponential Backoff + Cache 機制 |
| **OAuth Token 過期** | 🟡 中 | 自動 Refresh Token + 用戶重新授權提示 |
| **隱私爭議** | 🟡 中 | 明確告知「只讀取時間佔用，不讀取事件內容」 |

---

## 11. 未來擴展方向 (Future Enhancements)

### 11.1 如果要支援精確時間管理（需架構調整）

**當前限制**：
- Task 只有 `dueDate: Date`（日期級別）
- Sub-item 無時間欄位

**如果要實現「精確到分鐘的時間管理」，需要**：

#### 資料庫 Schema 調整

```typescript
// Task Entity (擴展)
interface Task {
  // ... 現有欄位
  dueDate: Date | null          // 保留（日期級別）
  dueTime: string | null        // 新增（HH:mm 格式，如 "14:00"）
  estimatedDuration: number | null  // 新增（預估時長，分鐘）
}

// SubItem (擴展)
interface SubItem {
  // ... 現有欄位
  scheduledDate: Date | null    // 新增（排程日期）
  scheduledTime: string | null  // 新增（排程時間）
  estimatedDuration: number | null  // 新增（預估時長）
}
```

#### 需新增的功能模組

1. **Time Block Scheduler（時間塊排程器）**
   - 根據 Task 的 `estimatedDuration` 和 Calendar 空檔自動排程
   - AI 建議：「根據你的會議空檔，建議在 11:30-13:00 完成 A 任務」

2. **Precise Conflict Detection（精確衝突偵測）**
   - 檢測：Task Due Time = Calendar Event Start
   - 預警：Task 預估時長 > 空檔時間

3. **Day Planner View（日程視圖）**
   - 類似 Calendar 的時間軸視圖
   - 顯示：Tasks + Sub-items + Calendar Events 在同一時間軸上

#### 產品定位風險

**需要慎重考慮**：

| 問題 | 風險 |
|------|------|
| **產品定位模糊** | Zentropy 從「營運管理系統」變成「Calendar App 2.0」 |
| **複雜度暴增** | 雙向同步、衝突解決、離線佇列、時區處理 |
| **維護成本** | Calendar API 變更、多平台同步、用戶學習曲線 |
| **競爭對手** | 與 Todoist, TickTick, Sunsama 等專業時間管理工具競爭 |

**建議**：
- ✅ 優先實現「日期級別的容量預警」（符合現有架構）
- ⚠️ 謹慎評估「精確時間管理」的產品價值
- 🟡 如果要做，應作為 **付費功能** 或 **獨立模組**

### 11.2 替代方案：與專業時間管理工具整合

**思路**：Zentropy 專注於「營運管理」，時間管理交給專業工具

| 整合對象 | 方式 | 價值 |
|----------|------|------|
| **Todoist** | API 整合 | 將 Zentropy Task 同步到 Todoist，由 Todoist 處理時間排程 |
| **TickTick** | Calendar Feed | 將 Zentropy Milestones 匯出為 .ics 檔 |
| **Sunsama** | Webhook | 當 Zentropy Task 到期時，觸發 Sunsama 提醒 |

**優點**：
- ✅ 保持 Zentropy 的核心定位（營運管理）
- ✅ 降低開發與維護成本
- ✅ 用戶可選擇自己熟悉的時間管理工具

---

## 12. 參考資料 (References)

- [Google Calendar API v3 Documentation](https://developers.google.com/calendar/api/v3/reference)
- [Flutter googleapis Package](https://pub.dev/packages/googleapis)
- [MCP (Model Context Protocol) Specification](https://modelcontextprotocol.io/)
- Zentropy 相關文件：
  - `docs/01_Specification/002_Functional_Specification.md` - Coach Agent 定義
  - `docs/02_Plan/003_Agent_and_MCP_Orchestration_Design.md` - MCP 架構
  - `docs/03_Tasks/Google_Calendar_Sync_Implementation.md` - App 端同步實作

---

## 13. 決策記錄 (Decision Log)

| 日期 | 決策 | 理由 |
|------|------|------|
| 2026-02-07 | 採用「單向同步 + 背景分析」架構 | 避免視圖污染，保持產品定位清晰 |
| 2026-02-07 | Calendar Events 不持久化到 Firestore | 降低隱私風險，減少資料冗餘 |
| 2026-02-07 | 只實作「日期級別的容量預警」，不實作「精確時間衝突偵測」 | Task 只有 `dueDate`（日期），無 `dueTime`（時間），架構不支援 |
| 2026-02-07 | Weekly Overview（週視圖）而非 Timeline（時間軸） | Zentropy 是營運管理，不是 Day Planner |
| 2026-02-07 | 延後「精確時間管理」功能至未來評估 | 需要重大架構調整 + 產品定位重新評估 |
