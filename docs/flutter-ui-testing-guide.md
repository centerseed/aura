# Flutter UI 自動化測試指南（Marionette MCP）

## 概覽

本指南說明如何用 **Marionette MCP** 對 Flutter app 做自動化 UI 測試，適用於任何 Flutter 專案。

---

## 環境需求

| 工具 | 用途 | 備註 |
|------|------|------|
| iOS Simulator | 運行 Flutter app | 優先用最新 iOS runtime |
| Marionette MCP | UI 自動化控制 | Claude Code 內建 |
| `flutter run` | Debug mode 啟動 | 需要 VM service URI |

---

## 快速啟動

```bash
# 1. 確認 Simulator 已開
xcrun simctl list devices available | grep Booted

# 2. 啟動 Flutter app
cd <your-project>/app
flutter run -d <DEVICE_ID> 2>&1 | tee /tmp/flutter-run.log &

# 3. 等待 app 完整啟動（等 API 請求出現，不是只等 ws:// URI）
for i in $(seq 1 120); do
  if grep -aq "200 /api\|Loaded\|Connected" /tmp/flutter-run.log 2>/dev/null; then
    grep -ao 'ws://[^ ]*' /tmp/flutter-run.log | head -1
    break
  fi
  sleep 3
done
```

---

## Marionette 核心工具

| 工具 | 用途 |
|------|------|
| `connect(uri)` | 連接到 Flutter app VM |
| `take_screenshots()` | 截圖看當前畫面 |
| `get_interactive_elements()` | 列出所有可互動元素 |
| `tap(key/text/coordinates)` | 點擊元素 |
| `enter_text(key, input)` | 輸入文字 |
| `scroll_to(key/text)` | 滾動到元素 |
| `hot_reload()` | 熱重載（程式碼修改後用） |
| `get_logs()` | 取得 Flutter log |

**元素定位優先順序**：`key` > `text` > bounds 分析 > `coordinates`

---

## 測試原則（實戰血淚）

### 1. 雙向驗證（最重要）

任何「建立/修改」操作，光看 UI 更新還不夠：

```
❌ 建立新項目 → chip 顯示新名稱 → PASS
✅ 建立新項目 → chip 顯示新名稱 → 重新打開列表 → 確認新項目出現 → PASS
```

### 2. 每個操作後查 log

```bash
tail -10 /tmp/flutter-run.log
```

確認 API 回 200，不是 400/500。「UI 沒動也沒 SnackBar」≠ 成功，可能是靜默失敗。

### 3. 真機 vs Simulator

- **新功能測試用 Simulator**（連本地 API）
- **真機測試前確認 production API 已 deploy**
- Marionette 只能用在 Simulator，不支援真機

### 4. 確認程式碼版本

改了程式碼後，必須 hot reload 或 restart，否則測的是舊版本：

```
mcp__marionette__hot_reload()  # 保留 app 狀態，優先用
```

結構性改動（新 widget、新 route）才需要完整 restart。

### 5. CRUD 測試的完整流程

```
Create → Read（重開列表）→ Select → Re-enter（關掉再開）
```

每一步都要截圖確認，不要跳步。

---

## 在 Widget 中加 Key（讓 Marionette 更好定位）

```dart
// 有 key 的 widget，Marionette 可以精準定位
ElevatedButton(
  key: const ValueKey('submit_button'),
  onPressed: onPressed,
  child: const Text('建立'),
)

// TextField
TextField(
  key: const ValueKey('create_dialog_input'),
  ...
)
```

命名規範：`snake_case`，語意清楚（如 `debug_login`、`create_dialog_input`）。

---

## Debug 登入（讓 AI 可以登入測試帳戶）

在 `kDebugMode` 下加一個 debug 登入按鈕：

```dart
// signin_screen.dart
if (kDebugMode)
  ElevatedButton(
    key: const ValueKey('debug_login'),
    onPressed: _debugLogin,
    child: const Text('Debug 登入'),
  ),
```

API 端需要 `POST /api/auth/debug-token` endpoint，並用環境變數 `DEBUG_AUTH_ENABLED=true` 控制開關。

---

## 常見問題

### `objective_c` FFI crash（iOS Simulator）

**症狀**：`Couldn't resolve native function 'DOBJC_initializeApi'`

**解法**：換用較新的 iOS runtime（如從 iOS 18.5 換到 iOS 26.2）

```bash
# 查可用的 simulator
xcrun simctl list devices available | grep Shutdown

# 開新的 simulator
xcrun simctl boot <DEVICE_ID>
```

### VM service URI 失效

flutter run 重啟後 URI 會換，重新取：

```bash
grep -ao 'ws://[^ ]*' /tmp/flutter-run.log | tail -1
```

### SnackBar 看不到

錯誤訊息被其他 widget（如 bottom sheet）遮住 → 查 Flutter log 確認 API 回傳。

### `scroll_to` 失敗

部分 `ListView` 不支援。備案：用 `get_interactive_elements` 確認元素在 widget tree 中，在報告標「需手動驗證」。

---

## 測試報告格式

```markdown
## UI 測試報告

- **測試日期**: YYYY-MM-DD
- **測試功能**: 簡短描述
- **Simulator**: iPhone 17 Pro / iOS 26.2
- **結果**: PASS / FAIL / PARTIAL

### 測試步驟
| # | 操作 | 預期 | 實際 | 結果 |
|---|------|------|------|------|
| 1 | 點擊「+ 新增」 | 彈出輸入框 | 彈出輸入框 | ✅ |
| 2 | 輸入名稱，建立 | chip 更新 | chip 更新 | ✅ |
| 3 | 重開選單 | 新項目出現 | 新項目出現 | ✅ |

### API Log
- POST /api/xxx → 201 ✅
- GET /api/xxx → 200，含新項目 ✅

### 備註
任何需要人工確認的項目寫在這裡。
```

---

## 本專案設定（Zentropy）

- **測試帳戶 UID**: `HXa5Pnojnqe6z2eL80tGwkNZA5I3`
- **推薦 Simulator**: iPhone 17 Pro `6F959EAC-4244-4C5F-BF2E-1067DDD48662`（iOS 26.2）
- **避免使用**: iPhone 16 Pro `023278CC-188A-4013-8CB0-A386644BC2D8`（iOS 18.5，有 FFI crash）
- **本地 API**: `http://localhost:3002`
- **Flutter log**: `/tmp/flutter-run.log`
