# Review Brief: simplify-reorganize-ui

## What Was Built
在 Flutter 和 Web 的 Reorganize UI 中，將 cluster card 從「顯示所有任務」改為「只顯示有移動的任務」。沒有移動任務的 cluster 完全不渲染。Section header subtitle 加入不動任務數量摘要。API 端和 domain entity 完全不動。

## AC Status
- [x] AC1: cluster card 只渲染 `isMoved` 的任務（排除 `isFromUncategorized`，但保留未分類→新 Topic 的情況）。無移動任務的 cluster 不渲染。Section subtitle 加入 `N 個不動` 摘要。
- [x] AC2: 現有實作已正確 — `visibleTopicOps` 過濾 `action !== 'keep'`，無需改動。
- [x] AC3: 現有實作已正確 — `hasConsolidations` 條件控制顯示，無需改動。
- [x] AC4: 現有實作已正確 — consolidation card 顯示合併標題、主/子任務、reasoning。
- [x] AC5: 現有實作已正確 — checkbox 控制 `_applyTopicOps` / `_applyConsolidations`，dimmed opacity。
- [x] AC6: 現有實作已正確 — 空白態顯示「任務已整理好了」。
- [x] AC7: Flutter 和 Web 使用完全相同的過濾邏輯：`isMoved && (!isFromUncategorized || isNew)`。

## Key Decisions
- 過濾規則：`isMoved && (!isFromUncategorized || isNew)` — 未分類任務歸類到既有 Topic 視為自然分類不顯示，但歸類到新 Topic 仍顯示（因為新 Topic 本身就是變動）。
- Cluster header 改為 `N 個任務移動` 取代原本的 `N 個任務`，因為隱藏了不動任務，顯示總數會造成困惑。
- 由於所有可見任務都是移動的，移除了不動任務的灰色樣式邏輯，全部統一用移動樣式（amber/statusInbox）。

## Changed Files
- `app/lib/presentation/screens/home/widgets/reorganize_bottom_sheet.dart` — 加入 `unchangedCount` 計算、subtitle 加不動摘要、cluster 過濾只保留有移動任務的、`_buildClusterCard` 內只渲染移動的任務
- `web/components/reorganize-modal.tsx` — subtitle 加不動摘要、cluster 過濾 `visibleTasks`、無可見任務返回 null、task list 只渲染移動任務

## Known Risks / Reviewer Focus Areas
- 如果一個 proposal 中所有任務都是從未分類歸類到既有 Topic（無 `isMoved && !isFromUncategorized`），主題重組 Section 可能看起來是空的（只有 Topic operations 沒有 cluster cards）。這是預期行為。
- Web 中 `return null` 在 `.map()` 裡會留下 `null` 元素，React 會正確忽略。

## Verification Commands Run
```bash
flutter analyze lib/presentation/screens/home/widgets/reorganize_bottom_sheet.dart  # result: No issues found
npx tsc --noEmit           # result: PASS
npm run build              # result: PASS
```
