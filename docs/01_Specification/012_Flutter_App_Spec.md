# Zentropy Flutter App Specification (移動端應用規格)

**Version 1.0 - 移動優先的智慧治理體驗**

## 1. 產品定位 (Product Positioning)

### 1.1 核心價值主張
Zentropy Flutter App 是 Zentropy 生態系統的**移動端入口**，專注於「高頻、低摩擦」的場景：
- **快速捕捉**：在通勤、會議間隙隨手記錄想法
- **即時查看**：快速掃視今日待辦與進度
- **輕量互動**：完成任務、調整優先級、查看通知

### 1.2 與 Web POC 的差異化定位
| 特性 | Web POC | Flutter App |
|------|---------|-------------|
| **使用場景** | 深度規劃、結構重組 | 快速捕捉、日常執行 |
| **互動模式** | 拖曳編輯、複雜視圖 | 滑動操作、卡片式 |
| **AI 功能** | 完整治理引擎 | 智能輸入、推薦 |
| **視覺重點** | 全局架構視圖 | 今日焦點 + Inbox |

---

## 2. 目標用戶 (Target Users)

### 2.1 主要人物誌 (Primary Persona)
**Tech-savvy Founder / PM**
- **痛點**：
  - 在咖啡廳、通勤途中突然想到的點子容易忘記
  - 手機上的待辦清單 App 太簡陋，無法管理複雜專案
  - 需要在移動場景下快速確認「今天該做什麼」
- **期待**：
  - 說話或打字就能快速記錄，系統自動分類
  - 一眼看到「今日重點」而非冗長清單
  - 與桌面端（Web）數據完全同步

### 2.2 次要人物誌 (Secondary Persona)
**AI-Native Builders**
- 在等編譯時快速查看任務
- 用語音快速捕捉技術靈感
- 需要 Siri/Google Assistant 快捷指令支援

---

## 3. 核心功能模組 (Core Modules)

### 3.1 Onboarding (首次引導)

#### 3.1.1 功能目標
- 5 分鐘內讓用戶理解 Zentropy 的核心概念
- 收集用戶的基本身分架構（Areas）
- 建立第一個 Product 與任務

#### 3.1.2 流程設計
```
步驟 1: 歡迎頁面
- 動畫展示「混亂 → 有序」的視覺隱喻
- CTA: "開始整理我的生活"

步驟 2: Area 設定
- 預設四象限：Personal / Work / Growth / Finance
- 允許用戶自訂名稱（如 "Startup X"）
- 視覺：卡片式選擇 + 編輯界面

步驟 3: 快速捕捉體驗
- 引導輸入第一條混亂筆記（範例：「明天要開會討論 Q2 計畫，還要記得買咖啡豆」）
- 展示 AI 自動拆解為結構化任務
- 視覺：Before/After 動畫效果

步驟 4: 完成
- 展示 Dashboard 預覽
- CTA: "進入我的 Zentropy"
```

#### 3.1.3 設計原則
- **極簡美學**：使用漸層背景 + 玻璃擬態卡片
- **動畫流暢**：每次頁面切換使用 Hero Animation
- **心理安全**：提供「稍後設定」選項，不強制完成所有步驟

---

### 3.2 Dashboard (主控台)

#### 3.2.1 佈局架構
```
┌─────────────────────────────────────┐
│ 頂部導航 (Top Bar)                   │
│ [Avatar] Zentropy [🔔通知] [⚙️設定] │
├─────────────────────────────────────┤
│ 快速狀態卡 (Quick Stats)             │
│ ┌─────┐ ┌─────┐ ┌─────┐             │
│ │Today│ │This │ │Over │             │
│ │  5  │ │Week │ │ due │             │
│ │Tasks│ │ 12  │ │  2  │             │
│ └─────┘ └─────┘ └─────┘             │
├─────────────────────────────────────┤
│ 視圖切換 Tabs                        │
│ [📋 Today] [📂 Structure] [📅 Week] │
├─────────────────────────────────────┤
│                                     │
│ 主視圖區域 (Main View)               │
│ (根據 Tab 切換內容)                 │
│                                     │
│                                     │
└─────────────────────────────────────┘
│ 底部導航 (Bottom Nav)                │
│ [🏠Home] [➕Quick] [📚Library] [👤Me]│
└─────────────────────────────────────┘
```

#### 3.2.2 Today View (今日視圖)
- **設計理念**：減少認知負荷，聚焦「現在該做什麼」
- **內容區塊**：
  1. **優先任務卡片** (Top 3)
     - 大卡片設計
     - 顯示：專案名稱、任務標題、截止時間、Topic 標籤
     - 互動：左滑完成、右滑延期
  2. **其他今日任務** (可摺疊列表)
     - 小卡片設計
     - 分組：按 Area 或 Product
  3. **Inbox 提醒**
     - 浮動徽章：「3 條待整理」
     - 點擊進入 Inbox 處理流程

#### 3.2.3 Structure View (結構視圖)
- **佈局**：摺疊式列表
  ```
  📁 Work
    └ 📦 Zentropy Backend
        ├ ✅ Setup Database Schema (今天)
        └ 🔲 Implement Auth API (本週)
    └ 📦 Client Project A
        └ 🔲 Design Review (明天)
  📁 Personal
    └ 📦 Health
        └ 🔲 Gym Workout (Today)
  ```
- **互動**：
  - 點擊 Area/Product 進入詳細頁
  - 長按任務進入編輯模式
  - 拖曳任務到不同 Product（進階功能，v2.0）

#### 3.2.4 Week View (週視圖)
- **佈局**：橫向滑動日曆 + 任務列表
- **視覺**：每日任務以卡片形式堆疊
- **互動**：點擊日期切換、拖曳任務調整日期

---

### 3.3 Quick Capture (快速捕捉)

#### 3.3.1 入口設計
**多重入口策略**：
1. 底部導航中央的 FAB (Floating Action Button)
2. Dashboard 右下角的懸浮按鈕
3. 系統級 Widget (iOS/Android 主屏幕小組件)
4. Siri/Google Assistant 快捷指令

#### 3.3.2 輸入模式
```
┌─────────────────────────────────────┐
│ 快速捕捉                             │
├─────────────────────────────────────┤
│ 模式切換：                           │
│ [✏️ 文字] [🎙️ 語音] [📸 OCR]      │
├─────────────────────────────────────┤
│                                     │
│ [多行文字輸入框]                     │
│ 輸入任何想法...                      │
│                                     │
├─────────────────────────────────────┤
│ AI 建議 (Auto-suggest)               │
│ 📌 檢測到專案：Zentropy Backend      │
│ ⏰ 推測時間：今天                    │
│ 🏷️ 推薦 Topic：Feature Development │
├─────────────────────────────────────┤
│ [稍後整理] [儲存為草稿] [立即分類]  │
└─────────────────────────────────────┘
```

#### 3.3.3 Brain Dump 流程
1. **輸入階段**
   - 用戶自由輸入混亂文字
   - AI 即時顯示「檢測到 X 個任務」

2. **AI 處理階段**
   - 顯示 Loading 動畫（「AI 正在整理...」）
   - 3 秒內完成結構化

3. **結果預覽階段**
   ```
   ┌─────────────────────────────┐
   │ AI 為你整理了 3 個任務       │
   ├─────────────────────────────┤
   │ ✅ 開會討論 Q2 計畫          │
   │    📂 Work > Q2 Planning    │
   │    ⏰ 明天 10:00            │
   ├─────────────────────────────┤
   │ ✅ 買咖啡豆                  │
   │    📂 Personal > Daily Life │
   │    ⏰ 本週內                │
   ├─────────────────────────────┤
   │ [確認全部] [編輯] [取消]    │
   └─────────────────────────────┘
   ```

4. **確認/調整階段**
   - 支援單個任務編輯
   - 滑動刪除不需要的項目

#### 3.3.4 語音輸入特殊處理
- **技術方案**：整合 Flutter `speech_to_text` 套件
- **UX 優化**：
  - 波形動畫顯示錄音狀態
  - 即時顯示轉錄文字
  - 支援多語言（中文、英文自動識別）

#### 3.3.5 OCR 圖片輸入
- **使用場景**：會議白板、名片、紙質筆記
- **流程**：
  1. 拍照或選擇相簿圖片
  2. 自動 OCR 提取文字
  3. 進入 Brain Dump 流程
- **技術方案**：Google ML Kit 或 Firebase ML

---

### 3.4 Inbox (收件匣)

#### 3.4.1 功能定位
**「未決事項的暫存區」** - 所有尚未完全分類的資訊

#### 3.4.2 視覺設計
```
┌─────────────────────────────────────┐
│ 收件匣 (3 條待處理)                  │
├─────────────────────────────────────┤
│ ⚠️ 超過 24 小時的項目                │
│ ┌─────────────────────────────────┐ │
│ │ 🟡 確認會議時間                  │ │
│ │ 2 天前 · 尚未分類                │ │
│ │ [快速分類] [展開編輯]            │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ 📥 今日新增                          │
│ ┌─────────────────────────────────┐ │
│ │ 🟢 研究競品分析報告               │ │
│ │ 1 小時前                         │ │
│ │ [快速分類]                       │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ 🟢 買生日禮物                     │ │
│ │ 30 分鐘前                        │ │
│ │ [快速分類]                       │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

#### 3.4.3 互動設計
- **左滑**：刪除
- **右滑**：完成（如果是簡單事項）
- **點擊「快速分類」**：
  ```
  ┌───────────────────────────┐
  │ 分類到哪裡？               │
  ├───────────────────────────┤
  │ 📂 Work > Zentropy        │
  │ 📂 Personal > Daily Life  │
  │ ➕ 建立新專案             │
  ├───────────────────────────┤
  │ 💡 AI 建議：Work > Research │
  └───────────────────────────┘
  ```

#### 3.4.4 Inbox Zero 心理學設計
- **目標**：鼓勵用戶每日清空 Inbox
- **獎勵機制**：
  - 清空時顯示慶祝動畫 🎉
  - 記錄「連續 X 天達成 Inbox Zero」
  - 在 Dashboard 顯示成就徽章

---

### 3.5 Library (資料庫視圖)

#### 3.5.1 功能定位
完整的 Area → Product → Task 層級架構瀏覽

#### 3.5.2 視覺設計
```
┌─────────────────────────────────────┐
│ 我的資料庫                           │
├─────────────────────────────────────┤
│ 狀態篩選：                           │
│ [全部] [Active] [Maintain] [Archive]│
├─────────────────────────────────────┤
│ 📁 Work (12 項專案)                  │
│   📦 Zentropy Backend               │
│      ├ Feature Development (5)     │
│      ├ Bug Fix (2)                 │
│      └ Documentation (1)           │
│   📦 Client Project A               │
│      └ Design Phase (3)            │
│                                     │
│ 📁 Personal (3 項專案)               │
│   📦 Health & Fitness               │
│      └ Workout Routine (7)         │
│   📦 Reading List                   │
│      └ Books to Read (15)          │
└─────────────────────────────────────┘
```

#### 3.5.3 互動設計
- **點擊 Area**：展開/收合 Product 列表
- **點擊 Product**：進入 Product 詳細頁
  ```
  ┌─────────────────────────────────────┐
  │ ← Zentropy Backend                   │
  ├─────────────────────────────────────┤
  │ 狀態：Active                         │
  │ 里程碑：Beta Launch (2026/03/01)     │
  ├─────────────────────────────────────┤
  │ 📊 進度：                            │
  │ ▓▓▓▓▓▓▓▓░░ 75% (6/8 完成)          │
  ├─────────────────────────────────────┤
  │ 📋 任務列表 (按 Topic 分組)          │
  │                                     │
  │ Feature Development                 │
  │ ☑️ Setup Database Schema            │
  │ ☑️ Implement Auth API               │
  │ □ Create Task CRUD                  │
  │                                     │
  │ Bug Fix                             │
  │ □ Fix login redirect issue          │
  └─────────────────────────────────────┘
  ```

---

### 3.6 Profile & Settings (個人設定)

#### 3.6.1 功能模組
```
┌─────────────────────────────────────┐
│ 個人資料                             │
├─────────────────────────────────────┤
│ [Avatar]                            │
│ John Doe                            │
│ john@example.com                    │
├─────────────────────────────────────┤
│ ⚙️ 設定                              │
│   🔔 通知設定                        │
│   🎨 主題與外觀                      │
│   🌍 語言（中文/English）            │
│   🔐 隱私與安全                      │
│   💾 數據同步                        │
├─────────────────────────────────────┤
│ 📊 使用統計                          │
│   本週完成任務：28                   │
│   Inbox Zero 連續天數：5             │
│   最活躍的 Area：Work                │
├─────────────────────────────────────┤
│ 💎 訂閱管理                          │
│   當前方案：Fusion (融合)            │
│   [升級至 Nexus]                    │
├─────────────────────────────────────┤
│ ℹ️ 關於與支援                        │
│   版本 1.0.0                        │
│   使用條款、隱私政策                 │
│   聯絡客服                           │
└─────────────────────────────────────┘
```

#### 3.6.2 通知設定詳細
```
┌─────────────────────────────────────┐
│ 通知設定                             │
├─────────────────────────────────────┤
│ 📱 推送通知                          │
│   ☑️ 任務截止提醒                    │
│       提前時間：[1 小時 ▼]          │
│   ☑️ Inbox 積壓警告                  │
│       超過：[3 條 ▼]                │
│   ☑️ 每日摘要                        │
│       時間：[09:00 ▼]               │
├─────────────────────────────────────┤
│ 🔕 勿擾模式                          │
│   ☑️ 啟用勿擾時段                    │
│       22:00 - 08:00                │
└─────────────────────────────────────┘
```

---

## 4. AI 功能整合 (AI Features)

### 4.1 核心 AI 能力

#### 4.1.1 Brain Dump (腦內傾倒)
- **API 端點**：`POST /api/brain-dump`
- **輸入**：自然語言文字（支援中英混合）
- **輸出**：結構化任務陣列
- **關鍵能力**：
  - 單句多任務拆解
  - 時間詞彙識別（今天、明天、下週一、月底）
  - Area/Product 智能匹配

#### 4.1.2 Smart Suggestions (智能建議)
- **場景 1：Area 推薦**
  - 輸入包含「公司」「工作」→ 推薦 Work Area
  - 輸入包含「健身」「跑步」→ 推薦 Personal > Health
- **場景 2：Product 創建建議**
  - 用戶拖曳任務到 Area 時，AI 推薦新 Product 名稱
  - 範例：「這個任務關於什麼專案？」→ 「可能是『Q2 營銷計畫』？」

#### 4.1.3 Time Inference (時間推斷)
- **三階段策略**（與 Web POC 一致）：
  - **Phase A (0.8-1.0)**：用戶明確指定時間
  - **Phase B (0.5-0.8)**：從 Milestone 推斷
  - **Phase C (0.2-0.5)**：從 Drawer 狀態默認推斷
- **UI 顯示**：
  - 高信心度（> 0.8）：直接顯示日期
  - 中信心度（0.5-0.8）：顯示日期 + 「⚠️ AI 推測」
  - 低信心度（< 0.5）：顯示「待設定」

#### 4.1.4 Reorganize Suggestions (重組建議)
- **觸發時機**：
  - 用戶完成 Onboarding 後第 7 天
  - Inbox 清空後詢問「要優化結構嗎？」
- **建議類型**：
  - 合併相似 Product
  - 拆分過大 Product
  - Archive 長期無活動的 Product

---

### 4.2 離線優先策略 (Offline-First)

#### 4.2.1 技術方案
- **本地數據庫**：Hive 或 Isar
- **同步機制**：後台同步 + 衝突解決策略
- **AI 功能降級**：
  - 離線時：使用本地規則引擎進行簡單分類
  - 在線時：使用完整 LLM 能力

#### 4.2.2 離線模式 UX
```
┌─────────────────────────────────────┐
│ ⚠️ 目前離線                          │
│ 新任務將在連線後自動同步             │
├─────────────────────────────────────┤
│ 快速捕捉仍可使用                     │
│ 但 AI 建議功能受限                   │
└─────────────────────────────────────┘
```

---

## 5. UX 設計原則 (UX Design Principles)

### 5.1 視覺設計系統

#### 5.1.1 色彩系統
```dart
// 主色調 (Primary Colors)
const zentropy_gradient = LinearGradient(
  colors: [Color(0xFF667eea), Color(0xFF764ba2)], // 紫藍漸層
);

// 狀態顏色 (Status Colors)
const drawer_colors = {
  'INBOX': Color(0xFFFBBF24),     // 金黃色
  'ACTIVE': Color(0xFF10B981),    // 綠色
  'MAINTAIN': Color(0xFF3B82F6),  // 藍色
  'REFERENCE': Color(0xFF6B7280), // 灰色
  'ARCHIVE': Color(0xFF9CA3AF),   // 淺灰色
};

// 語義顏色 (Semantic Colors)
const success = Color(0xFF10B981);
const warning = Color(0xFFF59E0B);
const danger = Color(0xFFEF4444);
```

#### 5.1.2 字體系統
- **主要字體**：Inter (英文) + Noto Sans TC (繁中)
- **字重**：
  - 標題：700 (Bold)
  - 副標題：600 (Semi-bold)
  - 內文：400 (Regular)
- **字級**：
  - H1: 28sp
  - H2: 22sp
  - Body: 16sp
  - Caption: 14sp

#### 5.1.3 間距系統 (8pt Grid)
```dart
const spacing = {
  'xs': 4.0,
  'sm': 8.0,
  'md': 16.0,
  'lg': 24.0,
  'xl': 32.0,
  'xxl': 48.0,
};
```

#### 5.1.4 卡片設計規範
**玻璃擬態卡片 (Glassmorphism Card)**
```dart
Container(
  decoration: BoxDecoration(
    gradient: LinearGradient(
      colors: [
        Colors.white.withOpacity(0.1),
        Colors.white.withOpacity(0.05),
      ],
    ),
    borderRadius: BorderRadius.circular(16),
    border: Border.all(
      color: Colors.white.withOpacity(0.2),
      width: 1.5,
    ),
    boxShadow: [
      BoxShadow(
        color: Colors.black.withOpacity(0.1),
        blurRadius: 20,
        offset: Offset(0, 10),
      ),
    ],
  ),
  child: BackdropFilter(
    filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
    child: ...,
  ),
);
```

---

### 5.2 動畫與微互動 (Animations & Micro-interactions)

#### 5.2.1 頁面轉場動畫
- **路由動畫**：自訂 PageRouteBuilder
  ```dart
  PageRouteBuilder(
    transitionDuration: Duration(milliseconds: 300),
    pageBuilder: (context, animation, secondaryAnimation) => NewPage(),
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      return SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(1, 0),
          end: Offset.zero,
        ).animate(CurvedAnimation(
          parent: animation,
          curve: Curves.easeInOutCubic,
        )),
        child: child,
      );
    },
  );
  ```

#### 5.2.2 任務完成動畫
**滑動完成時的視覺反饋**
1. 任務卡片縮小並淡出（300ms）
2. 彈出「✅ 完成！」浮動提示（1000ms）
3. 列表重新排列（200ms）

#### 5.2.3 Loading 狀態設計
**AI 處理中動畫**
```
┌─────────────────────────────────────┐
│                                     │
│        [AI Processing Animation]    │
│                                     │
│     🧠 AI 正在整理你的想法...       │
│                                     │
│     [Pulsing gradient orb]          │
│                                     │
└─────────────────────────────────────┘
```

#### 5.2.4 手勢反饋
- **左滑刪除**：紅色背景逐漸顯示 + 🗑️ 圖標
- **右滑完成**：綠色背景逐漸顯示 + ✅ 圖標
- **長按**：觸覺反饋 (HapticFeedback.mediumImpact) + 卡片輕微縮放

---

### 5.3 無障礙設計 (Accessibility)

#### 5.3.1 基本要求
- **顏色對比**：WCAG AA 級標準（對比度 ≥ 4.5:1）
- **文字縮放**：支援系統字體大小設定
- **Screen Reader**：所有互動元素提供語義化標籤
- **鍵盤導航**：支援外接鍵盤操作（iPad 場景）

#### 5.3.2 實現範例
```dart
Semantics(
  label: '完成任務：準備會議簡報',
  button: true,
  onTap: () => completeTask(task.id),
  child: GestureDetector(...),
);
```

---

## 6. 技術架構 (Technical Architecture)

### 6.1 技術棧選擇

#### 6.1.1 核心技術
- **Framework**：Flutter 3.24+ (Dart 3.5+)
- **狀態管理**：Riverpod 2.0
- **路由管理**：go_router
- **本地存儲**：Hive (輕量) / Isar (高性能)
- **網路請求**：Dio + Retrofit
- **依賴注入**：get_it

#### 6.1.2 第三方服務
- **後端 API**：與現有 FastAPI 後端整合
- **認證**：Supabase Auth (與 Web POC 共用)
- **推送通知**：Firebase Cloud Messaging
- **分析**：Firebase Analytics
- **錯誤追蹤**：Sentry

---

### 6.2 架構模式

#### 6.2.1 Clean Architecture 三層架構
```
lib/
├── domain/              # 業務邏輯層
│   ├── entities/        # 實體類別
│   │   ├── task.dart
│   │   ├── product.dart
│   │   └── area.dart
│   ├── repositories/    # Repository 介面
│   └── usecases/        # 用例
│       ├── create_task_usecase.dart
│       └── brain_dump_usecase.dart
│
├── data/                # 數據層
│   ├── models/          # API 響應模型
│   ├── datasources/     # 數據源
│   │   ├── remote/      # API 調用
│   │   └── local/       # 本地數據庫
│   └── repositories/    # Repository 實現
│
└── presentation/        # 表現層
    ├── screens/         # 頁面
    ├── widgets/         # 可重用組件
    └── providers/       # Riverpod Providers
```

#### 6.2.2 關鍵設計模式
1. **Repository Pattern**：統一數據訪問接口
2. **Provider Pattern**：狀態管理與依賴注入
3. **Factory Pattern**：API 響應解析
4. **Observer Pattern**：數據同步與推送通知

---

### 6.3 API 整合

#### 6.3.1 與 FastAPI 後端對接
**主要端點**
```dart
// API Client
class ZentropyApi {
  @POST('/api/brain-dump')
  Future<BrainDumpResponse> brainDump(@Body() BrainDumpRequest request);
  
  @GET('/api/tasks')
  Future<List<Task>> getTasks(@Query('status') String? status);
  
  @POST('/api/tasks')
  Future<Task> createTask(@Body() CreateTaskRequest request);
  
  @PATCH('/api/tasks/{id}')
  Future<Task> updateTask(@Path() String id, @Body() UpdateTaskRequest request);
  
  @GET('/api/library')
  Future<LibraryStructure> getLibrary();
}
```

#### 6.3.2 錯誤處理策略
```dart
try {
  final result = await api.brainDump(request);
  return Right(result);
} on DioException catch (e) {
  if (e.type == DioExceptionType.connectionTimeout) {
    return Left(NetworkFailure('連線逾時，請檢查網路'));
  } else if (e.response?.statusCode == 401) {
    return Left(AuthFailure('請重新登入'));
  } else {
    return Left(ServerFailure('伺服器錯誤'));
  }
}
```

---

### 6.4 數據同步策略

#### 6.4.1 同步時機
1. **App 啟動時**：全量同步
2. **用戶操作後**：即時同步單筆變更
3. **背景同步**：每 15 分鐘檢查更新（可配置）
4. **網路恢復時**：自動重試失敗操作

#### 6.4.2 衝突解決策略
```
Client 修改時間戳 vs Server 修改時間戳

IF client_timestamp > server_timestamp THEN
  保留 Client 版本（用戶最新操作優先）
ELSE
  保留 Server 版本（多設備同步場景）
  
特殊情況：
- 刪除 vs 修改：刪除優先
- 完成 vs 未完成：完成優先
```

---

## 7. 開發里程碑 (Development Roadmap)

### 7.1 Phase 1: MVP (4-6 週)

#### Sprint 1-2: 基礎建設 (2 週)
- [ ] 專案初始化與架構搭建
- [ ] 與 FastAPI 後端 API 對接
- [ ] Supabase 認證整合
- [ ] 本地數據庫封裝 (Hive)

#### Sprint 3-4: 核心功能 (2 週)
- [ ] Dashboard (Today View + Structure View)
- [ ] Quick Capture (文字輸入 + Brain Dump)
- [ ] Task CRUD 操作
- [ ] Inbox 管理

#### Sprint 5-6: 優化與測試 (2 週)
- [ ] UI/UX 精修（動畫、主題）
- [ ] 離線模式基礎支援
- [ ] 單元測試 + Widget 測試
- [ ] Beta 版本測試

---

### 7.2 Phase 2: 進階功能 (4 週)

#### Sprint 7-8: AI 增強 (2 週)
- [ ] 語音輸入 (Speech-to-Text)
- [ ] OCR 圖片輸入
- [ ] Smart Suggestions 優化
- [ ] Reorganize 建議流程

#### Sprint 9-10: 協作與通知 (2 週)
- [ ] Push Notifications (截止提醒、Inbox 警告)
- [ ] 系統級 Widget (iOS/Android)
- [ ] Siri/Google Assistant 快捷指令
- [ ] 數據同步優化（衝突解決）

---

### 7.3 Phase 3: 完整生態 (持續迭代)

#### 未來功能規劃
- [ ] Apple Watch / Wear OS 擴展
- [ ] iPad 適配（Split View、鍵盤快捷鍵）
- [ ] 多人協作（共享 Area/Product）
- [ ] 深色模式自動切換
- [ ] 數據匯出（Markdown、CSV）
- [ ] 整合第三方日曆（Google Calendar、Outlook）

---

## 8. 成功指標 (Success Metrics)

### 8.1 用戶體驗指標
- **快速捕捉完成時間**：< 10 秒（從打開 App 到保存任務）
- **Inbox Zero 達成率**：> 60% 用戶每週至少清空 1 次
- **每日打開頻率**：≥ 3 次/天（Morning / Noon / Evening）

### 8.2 技術性能指標
- **App 啟動時間**：< 2 秒（冷啟動）
- **API 響應時間**：< 500ms (P95)
- **離線功能可用性**：100%（核心操作無網路可執行）

### 8.3 業務指標
- **7 日留存率**：> 40%
- **30 日留存率**：> 20%
- **付費轉換率**：> 5%（免費用戶 → Fusion 方案）

---

## 9. 設計交付物 (Design Deliverables)

### 9.1 必要交付物
1. **Figma 設計稿**
   - 完整 User Flow
   - 高保真 Mockups (Light/Dark Mode)
   - Component Library
   - 圖標集 (SVG 格式)

2. **互動原型**
   - Figma Prototype 或 Adobe XD
   - 關鍵流程演示（Onboarding, Quick Capture, Task Complete）

3. **設計規範文檔**
   - 色彩系統 (HEX/RGB/HSL)
   - 字體規範 (字型、字重、字級)
   - 間距與佈局網格
   - 動畫曲線與時長

---

## 10. 風險與限制 (Risks & Constraints)

### 10.1 技術風險
- **AI 響應延遲**：LLM API 調用可能偶爾超時
  - **緩解策略**：本地規則引擎備援 + 明確的 Loading 狀態
- **多設備同步衝突**：用戶在 Web 和 App 同時編輯同一任務
  - **緩解策略**：WebSocket 實時同步 + 時間戳衝突解決

### 10.2 UX 風險
- **學習曲線**：Area/Product/Topic 三層架構對新用戶可能過於複雜
  - **緩解策略**：簡化 Onboarding + 提供範本（Template）選擇
- **移動端輸入負擔**：手機打字效率低於桌面
  - **緩解策略**：強化語音輸入 + 快速選單（Quick Actions）

### 10.3 資源限制
- **開發時程壓力**：MVP 4-6 週較為緊湊
  - **緩解策略**：優先實現核心流程，延後次要功能至 Phase 2
- **設計資源不足**：若無專職設計師
  - **緩解策略**：使用成熟 UI Kit（如 FlutterFlow UI Library）加速開發

---

## 附錄 A：關鍵用戶旅程 (User Journeys)

### A.1 新用戶首次使用
```
1. 下載 App → 歡迎頁面
2. 註冊/登入 → Area 設定（選擇預設或自訂）
3. 快速導覽 → 第一次 Brain Dump 體驗
4. 看到整理結果 → 進入 Dashboard
5. 完成第一個任務 → 慶祝動畫 🎉
```

### A.2 日常任務管理
```
上午 09:00 - 通勤途中
1. 收到推送通知：「早安！今天有 5 個任務」
2. 打開 App → Today View
3. 查看優先任務卡片
4. 長按任務 → 調整優先級

上午 11:30 - 會議後
1. 打開 Quick Capture
2. 語音輸入：「等下要跟進剛才討論的 API 設計」
3. AI 自動分類到 Work > Zentropy Backend
4. 關閉 App（3 秒完成）

晚上 21:00 - 睡前檢視
1. 打開 App → Today View
2. 左滑完成剩餘 2 個任務
3. 收到「今日達成！」慶祝
4. 查看明天預覽 → 心安入睡
```

---

## 附錄 B：參考設計靈感 (Design Inspiration)

### B.1 移動端任務管理
- **Things 3**：極簡美學、流暢動畫
- **Todoist**：快速輸入、智能日期識別
- **TickTick**：多視圖切換、習慣追蹤

### B.2 AI 驅動輸入
- **Notion AI**：自然語言處理、內容生成
- **Mem**：自動連結、智能標籤

### B.3 視覺設計
- **Linear**：漸層色彩、玻璃擬態
- **Superhuman**：快捷鍵優先、高效操作
- **Arc Browser**：圓角卡片、分組管理

---

## 結語

Zentropy Flutter App 的核心目標是**讓移動端成為最順手的「捕捉工具」**。通過極致簡化的輸入流程、強大的 AI 自動分類能力，以及精美的視覺設計，我們希望用戶能在任何碎片時間快速記錄想法，而無需擔心後續整理的負擔。

**設計哲學**：「捕捉應該像呼吸一樣自然，整理應該像魔法一樣無感。」

---

**文件版本**：1.0  
**最後更新**：2026-01-27  
**負責人**：Product Team  
**狀態**：Draft - 待 Review
