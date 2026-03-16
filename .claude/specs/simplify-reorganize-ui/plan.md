# Plan Brief: simplify-reorganize-ui

## Goal
重新設計 Reorganize 結果 UI（Flutter App + Web），只顯示差異（移動的任務、改名/合併的 Topic），隱藏不變的項目，降低使用門檻。

## BDD Spec
→ Behavioral contract: `docs/bdd/simplify-reorganize-ui.feature`
  Scenarios in scope: @ac1, @ac2, @ac3, @ac4, @ac5, @ac6, @ac7

## Metadata
- affected: app, web
- db_migration: false
- deploy_required: false (純前端改動)

## AC → Test Mapping
| AC Tag | Scenario Name | Test Type | Test File | Platform |
|--------|--------------|-----------|-----------|----------|
| @ac1 | 主題重組只顯示有變動的任務 | widget | `app/test/widgets/reorganize_bottom_sheet_test.dart` | app |
| @ac1 | 主題重組只顯示有變動的任務 | component | `web/__tests__/components/reorganize-modal.test.tsx` | web |
| @ac2 | Topic 改名合併 diff 呈現 | widget | (同上) | app |
| @ac3 | 無合併建議不顯示整合 Section | widget | (同上) | app |
| @ac5 | 分別勾選套用 | widget | (同上) | app |
| @ac6 | 空白態 | widget | (同上) | app |

## Implementation Notes

### 核心改動思路

**改動的本質是「過濾」，不是「重構」**：
- API 回傳的 proposal 結構不變
- 前端渲染時過濾掉「沒有變動的任務」
- Section 結構保留（主題重組 + 任務整合），只改內容密度

### 具體改動

#### 1. Cluster 列表：只顯示有移動的任務 (@ac1)

**現狀**：每個 cluster card 列出所有任務（含不動的）
**改為**：
- cluster card 只列出 `isMoved == true` 的任務（排除 `isFromUncategorized`，因為那本來就是歸類）
- 如果一個 cluster 內所有任務都沒移動 → 不渲染該 cluster card
- 在 section header 的 subtitle 加摘要：`"3 個任務移動，7 個任務不動"`

**Flutter** (`reorganize_bottom_sheet.dart`):
- `_buildClusterCard` 只渲染 `task.isMoved` 的項目
- 過濾後 tasks 為空的 cluster 不渲染
- 但「未分類 → 新 Topic」的移動仍要顯示（`isFromUncategorized` 且目標是新 topic 時保留）

**Web** (`reorganize-modal.tsx`):
- `tasksInCluster` 過濾同上
- cluster card 只渲染有 moved tasks 的

#### 2. Topic Operations：已是 diff 呈現，保持不動 (@ac2)

現有實作已正確：`visibleTopicOps` 過濾掉 `action === 'keep'`。無需改動。

#### 3. 任務整合 Section：條件渲染已正確 (@ac3, @ac4)

現有實作已正確：`hasConsolidations` 條件控制顯示。無需改動。

#### 4. Checkbox 行為：已正確 (@ac5)

現有實作已正確。無需改動。

#### 5. 空白態：已正確 (@ac6)

Flutter 和 Web 都有空白態。確認行為一致即可。

#### 6. 視覺邏輯一致性 (@ac7)

確保 Flutter 和 Web 的過濾邏輯完全一致：
- 同樣的 `isMoved` 過濾規則
- 同樣的 cluster card 隱藏規則
- 同樣的摘要文字格式

### Reference Implementation
- Flutter: `app/lib/presentation/screens/home/widgets/reorganize_bottom_sheet.dart` (706 lines)
- Web: `web/components/reorganize-modal.tsx` (449 lines)
- 兩邊已有相似的結構，改動邏輯可以鏡像對應

### Key Patterns
- Flutter: StatefulWidget + `setState` 管理 checkbox 狀態
- Web: React `useState` + `useMemo` 管理 checkbox 和計算
- 兩邊的 `_TopicChange` / `tasksInCluster` 計算邏輯是鏡像的

## Files to Change
- `app/lib/presentation/screens/home/widgets/reorganize_bottom_sheet.dart` — @ac1: cluster card 只渲染 moved tasks，空 cluster 不渲染，加摘要數字
- `web/components/reorganize-modal.tsx` — @ac1: 同上邏輯的 Web 版

## Files That Must NOT Change
- `api/src/lib/reorganize-prompt.ts` — AI prompt 不改
- `api/src/app/api/products/[id]/reorganize-topics/route.ts` — API response 不改
- `api/src/app/api/products/[id]/apply-reorganization/route.ts` — apply 邏輯不改
- `app/lib/domain/entities/reorganize_proposal.dart` — entity 不改
- `app/lib/presentation/providers/reorganize_provider.dart` — state management 不改

## Out of Scope
- API 端 proposal 結構變更
- Reorganize AI prompt 調整
- 新增逐項接受/拒絕功能
- 全域 reorganize endpoint (`/api/reorganize`)
- 測試撰寫（另開 task）

## PAUSE Gates
- [ ] DB migration: no
- [ ] Test data deletion: no
- [ ] Deployment: no — 純前端改動，下次部署自然帶上
