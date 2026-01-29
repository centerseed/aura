# 成就回饋系統計劃

**版本**: 1.2
**目標**: 在不增加 UI 負擔的前提下，提供任務完成的成就感回饋

---

## 一、背景

Dashboard 目前已有多層任務分組，UI 緊湊。用戶需要知道「今天完成了哪些工作」來獲得成就感，但不希望增加視覺負擔。

---

## 二、Phase 1：即時回饋 + 標題區指標（Web 版已完成 ✅）

### 2.1 方案 A：完成時的即時回饋強化

**目標**：在任務完成的當下提供滿足感

**已實作 (Web)**：
- ✅ Toast 回饋：顯示「完成！今天已完成 N 項」
- ✅ 3 秒後自動消失
- ✅ 使用 API 查詢今日完成（根據 updated_at 欄位篩選）

**涉及檔案**：
- `web/app/dashboard/page.tsx`

---

### 2.2 方案 C：標題區的微型成就指標

**目標**：利用現有標題區空間展示成就

**已實作 (Web)**：
- ✅ Header 標題旁加入綠色徽章，顯示今日完成數
- ✅ 點擊徽章可展開 Sheet，顯示今日完成清單
- ✅ 完成清單使用刪除線風格，與 active 任務區分

**涉及檔案**：
- `web/app/dashboard/page.tsx`

---

### 2.3 資料層實作

**Web 版實作方式**（已從 localStorage 改為 API 方式）：
- 使用 `useState` 管理今日完成任務狀態
- `completedTodayTasks`: TaskCard[] - 今日完成的任務清單
- `loadCompletedToday()`: 從 API 載入今日完成任務

**API 修改**：
- `GET /api/tasks?completed_today=true` - 伺服器端篩選今日完成任務
- `GET /api/tasks?status=ARCHIVE` - 篩選特定狀態
- TaskCard 類型新增 `created_at` 和 `updated_at` 欄位

**涉及檔案**：
- `web/app/api/tasks/route.ts` - API 路由
- `web/domain/entities/task.entity.ts` - 類型定義

---

## 三、Phase 2：晚報回顧功能（下一階段）

> 配合 Coach Agent 的晚報機制（21:00）

**預計功能**：
- 晚報時段自動彈出「今日回顧」卡片
- 展示完成項目統計、時間分布
- 連續完成天數（streak）機制
- 與 Coach Agent 整合的心理閉環設計

**暫不實作**，待 Phase 1 穩定後再規劃。

---

## 四、成功指標

- ✅ 用戶完成任務時有明確的視覺回饋
- ✅ 隨時可查看今日完成數量（Header 徽章可見）
- ✅ 點擊可查看完成清單（不佔用主畫面空間）
- ✅ 不增加 Dashboard 的視覺複雜度

---

**文件版本**: 1.1
**建立日期**: 2026-01-28
**更新日期**: 2026-01-28
**狀態**: Phase 1 已完成 (Web)
