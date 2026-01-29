# Flutter App 補充需求 (User Requirements)

**日期**: 2026-01-27  
**優先級**: 高

---

## 核心需求補充

### 1. 語音輸入功能 ⭐
**需求描述**:  
在 Quick Capture 介面中，用戶可以使用語音輸入，系統自動轉換為文字後進行 Brain Dump 處理。

**技術實現**:
- 使用 `speech_to_text` 套件
- 支援中文/英文自動識別
- 即時顯示語音轉文字結果
- 波形動畫提供視覺反饋

**UI 設計**:
```
Quick Capture 界面
┌─────────────────────────────────────┐
│ 模式切換: [✏️ 文字] [🎙️ 語音]    │
├─────────────────────────────────────┤
│                                     │
│  (語音模式下顯示波形動畫)           │
│  🎙️ [錄音按鈕]                     │
│                                     │
│  轉錄文字: "明天要開會..."          │
│                                     │
└─────────────────────────────────────┘
```

**權限需求**:
- iOS: 在 `Info.plist` 添加麥克風權限
- Android: 在 `AndroidManifest.xml` 添加錄音權限

---

### 2. 快速選擇 Product ⭐
**需求描述**:  
在輸入介面中，提供 Product 快速選擇器，用戶可以手動指定任務歸屬的專案，覆蓋 AI 的自動分類建議。

**功能場景**:
1. **AI 優先**: 系統自動推薦最匹配的 Product
2. **用戶確認**: 用戶可接受建議或手動選擇其他 Product
3. **快速訪問**: 最近使用的 Product 排在前面

**UI 設計**:
```
AI 建議卡片
┌─────────────────────────────────────┐
│ 💡 AI 建議:                         │
│ 📌 檢測到專案: Zentropy Backend     │
│ ⏰ 推測時間: 今天                   │
│ 🏷️ 推薦 Topic: Feature Development │
│                                     │
│ [✓ 接受建議] [✏️ 選擇其他專案]     │
└─────────────────────────────────────┘

手動選擇 (點擊「選擇其他專案」後)
┌─────────────────────────────────────┐
│ 選擇專案                             │
├─────────────────────────────────────┤
│ 🔍 [搜尋專案...]                    │
├─────────────────────────────────────┤
│ 最近使用:                            │
│ • 📦 Zentropy Backend               │
│ • 📦 Client Project A               │
│                                     │
│ Work Area:                          │
│ • 📦 Q2 Marketing                   │
│ • 📦 Internal Tools                 │
│                                     │
│ Personal Area:                      │
│ • 📦 Health & Fitness               │
└─────────────────────────────────────┘
```

**技術實現**:
- 從 `/api/library` 獲取所有 Products
- 按最後使用時間排序（本地記錄）
- 支援模糊搜尋（Product 名稱）
- 選擇後覆蓋 Brain Dump Request 的 Product 參數

---

## 實現計劃調整

### Phase 2 Sprint 4 的任務更新:
**原計劃**: 實現 Quick Capture（僅文字輸入）  
**調整後**:
- [ ] Quick Capture 文字輸入 Tab
- [ ] **語音輸入 Tab** (新增)
  - [ ] 麥克風權限請求
  - [ ] Speech-to-Text 整合
  - [ ] 錄音波形動畫
  - [ ] 語音轉文字顯示
- [ ] **Product 快速選擇器** (新增)
  - [ ] Product 列表 UI (Bottom Sheet)
  - [ ] 最近使用 Product 排序
  - [ ] 搜尋功能
  - [ ] 覆蓋 AI 建議邏輯
- [ ] AI 處理與結果預覽
- [ ] 確認創建流程

**新增預計時間**: +2 天（原 5 天 → 7 天）

---

## 權限配置

### iOS (Info.plist)
```xml
<key>NSMicrophoneUsageDescription</key>
<string>Zentropy 需要麥克風權限來提供語音輸入功能</string>
<key>NSSpeechRecognitionUsageDescription</key>
<string>Zentropy 需要語音識別權限來將您的語音轉換為文字</string>
```

### Android (AndroidManifest.xml)
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO"/>
<uses-permission android:name="android.permission.INTERNET"/>
```

---

**狀態**: 已記錄，將在 Sprint 4 實現  
**相關文檔**: `012_Flutter_App_Spec.md` (待更新)
