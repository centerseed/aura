# Onboarding 功能測試指南

## 測試環境準備

```bash
# 進入 app 目錄
cd app

# 清理並重新安裝依賴
flutter clean
flutter pub get

# 啟動 iOS 模擬器或 Android 模擬器
open -a Simulator  # macOS 啟動 iOS 模擬器
# 或
emulator -avd <your_avd_name>  # 啟動 Android 模擬器

# 執行 app
flutter run
```

## 測試場景

### 場景 1: 新用戶首次登入（完整 Onboarding 流程）

**前置條件**: 清除 app 資料或使用全新帳號

**步驟**:
1. 啟動 app → 進入 Splash 畫面
2. 自動導向登入頁面（SignInScreen）
3. 使用 Google 登入
4. 成功登入後，系統檢測到沒有 Areas → 自動導向 `/onboarding`

**驗證 Onboarding 流程**:

#### Page 1: 身份地圖設定
- [ ] 顯示歡迎訊息「嗨，{使用者名稱}」
- [ ] 顯示 4 個預設身份卡片（事業、個人、人際、財務）- 2x2 網格
- [ ] 點擊卡片可選取/取消選取
- [ ] 選中的卡片顯示：放大效果、漸變背景、勾選圖標
- [ ] 點擊「新增自定義身份」可展開表單
- [ ] 自定義表單可輸入身份名稱和包含內容
- [ ] 底部顯示「已選擇 X 個身份」
- [ ] 未選擇任何身份時，無法滑動到下一頁（進度點變灰）
- [ ] 選擇至少 1 個身份後，可以滑動或點擊「下一步」

#### Page 2: 三層架構介紹
- [ ] 標題顯示「剛剛你定義了『身份地圖』」
- [ ] 顯示三層架構：Area → Product → Topic
- [ ] 使用使用者選擇的身份作為範例
- [ ] 每層有不同顏色和縮排
- [ ] 底部核心訊息框顯示「AI 會自動將你的想法分類...」
- [ ] 可以滑動或點擊「上一步」/「下一步」

#### Page 3: AI 自動排程演示
- [ ] 標題顯示「AI 會自動幫你安排時間」
- [ ] 顯示 3 步驟流程：輸入 → AI 分析 → 結果
- [ ] 每個步驟有圖標、標題和內容
- [ ] 步驟之間有向下箭頭連接
- [ ] 底部核心訊息框顯示「不用手動排程...」
- [ ] 可以滑動或點擊「上一步」/「下一步」

#### Page 4: 準備開始
- [ ] 顯示火箭圖標
- [ ] 標題「準備就緒！」
- [ ] 顯示設定摘要「已設定 X 個身份」
- [ ] 列出所有選中的身份（預設 + 自定義）
- [ ] 大按鈕「開始使用 Zentropy」
- [ ] 點擊按鈕時顯示載入動畫
- [ ] 成功建立 Areas 後自動導向 `/dashboard`

#### 共用功能
- [ ] 每頁底部顯示進度指示器（4 個點）
- [ ] 當前頁面的點顯示為長橢圓 + 漸變色
- [ ] 已完成頁面的點顯示為半透明
- [ ] 未完成頁面的點顯示為灰色
- [ ] 任何時刻可點擊右上角「跳過」按鈕 → 直接進入 dashboard
- [ ] 滑動手勢流暢，動畫時長 300ms

---

### 場景 2: 舊用戶登入（跳過 Onboarding）

**前置條件**: 使用已完成 onboarding 的帳號（已有 Areas）

**步驟**:
1. 啟動 app → 進入 Splash 畫面
2. 自動導向登入頁面（如果未登入）或直接同步
3. 使用 Google 登入（或自動恢復登入狀態）
4. 成功登入後，系統檢測到已有 Areas → **直接導向** `/dashboard`

**驗證**:
- [ ] 不會進入 onboarding 流程
- [ ] 直接顯示 dashboard（HomeScreen）

---

### 場景 3: 錯誤處理

#### 3.1 網路錯誤
**步驟**:
1. 進入 onboarding 最後一頁（Ready Page）
2. 關閉網路連線
3. 點擊「開始使用 Zentropy」

**驗證**:
- [ ] 顯示錯誤 SnackBar：「建立身份失敗：{錯誤訊息}」
- [ ] 按鈕恢復為可點擊狀態（不再顯示 loading）
- [ ] 使用者可以重試

#### 3.2 後端同步失敗
**步驟**:
1. 登入成功後，後端 API 返回錯誤
2. Splash 畫面同步失敗

**驗證**:
- [ ] 自動登出
- [ ] 重新導向登入頁面
- [ ] Console 顯示錯誤訊息

---

### 場景 4: 中途退出恢復

**步驟**:
1. 進入 onboarding 第 2 頁
2. 關閉 app（殺掉進程）
3. 重新啟動 app

**驗證**:
- [ ] 重新進入 Splash 畫面
- [ ] 檢查 Areas 狀態
- [ ] 如果還沒有 Areas，重新進入 onboarding 從第 1 頁開始
- [ ] 之前的選擇不會保留（狀態重置）

---

### 場景 5: UI 適配測試

#### 不同螢幕尺寸
- [ ] iPhone SE (小螢幕) - 375x667
- [ ] iPhone 14 Pro (標準) - 393x852
- [ ] iPhone 14 Pro Max (大螢幕) - 430x932
- [ ] iPad (平板) - 1024x1366

**驗證**:
- [ ] 所有文字清晰可讀
- [ ] 卡片網格正確顯示（2x2）
- [ ] 按鈕大小適中（至少 44pt 點擊區域）
- [ ] 內容不會被截斷
- [ ] 滾動流暢

#### 主題切換
- [ ] 深色模式正確顯示（目前主要支援深色）
- [ ] 淺色模式（如果實作）

---

## 檢查清單

### 程式碼品質
- [x] 所有新檔案已建立
- [x] 路由整合完成
- [x] Splash 導航邏輯更新
- [x] Provider 狀態管理正確
- [ ] Flutter analyze 無錯誤（只有現有的 warnings）
- [ ] 沒有未使用的 imports

### 功能完整性
- [ ] 新用戶可以完整走完 onboarding
- [ ] 舊用戶跳過 onboarding
- [ ] Areas 成功建立到後端
- [ ] 錯誤處理正確顯示
- [ ] 動畫流暢

### 使用者體驗
- [ ] 載入狀態清楚顯示
- [ ] 錯誤訊息友善
- [ ] 按鈕反饋明確（loading、disabled 狀態）
- [ ] 滑動手勢自然
- [ ] 進度指示清楚

---

## 常見問題排查

### 問題: 登入後沒有導向 onboarding
**可能原因**:
1. Splash screen 的 `_syncAndNavigate()` 沒有正確檢查 Areas
2. 路由 redirect 邏輯有誤

**排查**:
```bash
# 查看 console 日誌
flutter run --verbose
# 尋找 "Splash: User has no areas, going to Onboarding"
```

### 問題: 點擊「開始使用」後沒反應
**可能原因**:
1. API 端點不正確
2. Areas 建立失敗

**排查**:
```dart
// 在 ready_page.dart 的 _createAreas 中加入更多 debug 輸出
debugPrint('Creating area: ${preset.name}');
```

### 問題: 無法滑動到下一頁
**可能原因**:
- 第一頁未選擇任何身份

**解決**: 至少選擇 1 個身份

---

## 手動測試命令

```bash
# 清除 app 資料（iOS）
xcrun simctl uninstall booted com.zentropy.app

# 清除 app 資料（Android）
adb shell pm clear com.zentropy.app

# 重新安裝並執行
flutter run

# 查看詳細日誌
flutter logs
```

---

## 自動化測試（未來實作）

建議建立以下測試檔案：

```
app/test/
├── presentation/
│   └── screens/
│       └── onboarding/
│           ├── onboarding_screen_test.dart
│           ├── widgets/
│           │   ├── identity_setup_page_test.dart
│           │   ├── identity_card_test.dart
│           │   └── page_indicator_test.dart
│           └── integration/
│               └── onboarding_flow_test.dart
```

---

## 驗收標準

✅ 所有測試場景通過
✅ 無編譯錯誤
✅ 動畫流暢（60fps）
✅ 錯誤處理完善
✅ 使用者體驗良好
