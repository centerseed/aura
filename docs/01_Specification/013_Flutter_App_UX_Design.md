# Zentropy Flutter App UX 設計指南

**版本 1.0 - 移動端使用者體驗設計規範**

---

## 一、設計願景 (Design Vision)

### 1.1 核心設計理念
**「讓混亂變得美麗，讓整理成為享受」**

Zentropy Flutter App 的設計不僅要實現功能，更要透過精緻的視覺設計和流暢的動畫，讓用戶在使用過程中感受到：
- **掌控感**：看到清晰的結構和進度
- **愉悅感**：每次互動都有精心設計的反饋
- **信任感**：AI 的判斷透明且可調整

### 1.2 設計目標
1. **零學習成本**：新用戶在 30 秒內理解核心操作
2. **高效輸入**：從想法到記錄完成 < 10 秒
3. **視覺驚艷**：首次打開就讓用戶感到「這個 App 不一樣」

---

## 二、視覺設計系統 (Visual Design System)

### 2.1 色彩架構

#### 2.1.1 主品牌色 (Primary Palette)
```yaml
品牌漸層:
  起始色: #667eea (紫羅蘭藍)
  結束色: #764ba2 (深紫色)
  
品牌主色:
  primary-500: #667eea
  primary-600: #5568d3
  primary-700: #4453bc
  
強調色:
  accent: #f093fb (粉紫色)
  accent-gradient: 
    - #f093fb
    - #f5576c
```

#### 2.1.2 功能色彩 (Functional Colors)
```yaml
狀態色 (Drawer Status):
  inbox: 
    color: #FBBF24
    name: 金鈴黃
    emotion: 警覺、待處理
  active:
    color: #10B981
    name: 翡翠綠
    emotion: 活力、進行中
  maintain:
    color: #3B82F6
    name: 晴空藍
    emotion: 穩定、持續
  reference:
    color: #6B7280
    name: 石板灰
    emotion: 沉穩、備用
  archive:
    color: #9CA3AF
    name: 霧銀
    emotion: 安靜、已完成

語義色 (Semantic):
  success: #10B981
  warning: #F59E0B
  error: #EF4444
  info: #3B82F6
```

#### 2.1.3 中性色階 (Neutral Scale)
```yaml
背景層級:
  bg-primary: #FFFFFF (亮色模式) / #0F172A (暗色模式)
  bg-secondary: #F9FAFB / #1E293B
  bg-tertiary: #F3F4F6 / #334155

文字層級:
  text-primary: #111827 / #F9FAFB
  text-secondary: #6B7280 / #94A3B8
  text-tertiary: #9CA3AF / #64748B
  text-disabled: #D1D5DB / #475569
```

---

### 2.2 字體系統 (Typography)

#### 2.2.1 字型選擇
```yaml
西文字型:
  family: 'Inter'
  weights: [400, 500, 600, 700]
  source: Google Fonts

中文字型:
  family: 'Noto Sans TC'
  weights: [400, 500, 700]
  source: Google Fonts
  
等寬字型 (代碼/數據):
  family: 'JetBrains Mono'
  weights: [400, 600]
```

#### 2.2.2 字級規範 (Type Scale)
```dart
// Flutter TextTheme 配置
const textTheme = TextTheme(
  // 標題層級
  displayLarge: TextStyle(
    fontSize: 32,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.5,
  ), // 大型展示標題 (Onboarding)
  
  displayMedium: TextStyle(
    fontSize: 28,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.3,
  ), // 頁面主標題
  
  headlineMedium: TextStyle(
    fontSize: 22,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.2,
  ), // 區塊標題 (Area 名稱)
  
  titleLarge: TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w600,
    letterSpacing: 0,
  ), // 卡片標題 (Product 名稱)
  
  titleMedium: TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w600,
  ), // 子標題 (任務標題)
  
  // 內文層級
  bodyLarge: TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.normal,
    height: 1.5,
  ), // 主要內文
  
  bodyMedium: TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.normal,
    height: 1.4,
  ), // 次要內文
  
  bodySmall: TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.normal,
    height: 1.3,
  ), // 輔助說明文字
  
  // 標籤與按鈕
  labelLarge: TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w500,
    letterSpacing: 0.5,
  ), // 按鈕文字
);
```

---

### 2.3 間距與佈局 (Spacing & Layout)

#### 2.3.1 間距系統 (基於 8pt Grid)
```dart
class Spacing {
  static const double xxs = 2.0;   // 極小間距 (分隔線內縮)
  static const double xs = 4.0;    // 微小間距 (圖標與文字)
  static const double sm = 8.0;    // 小間距 (列表項內部)
  static const double md = 16.0;   // 標準間距 (卡片內邊距)
  static const double lg = 24.0;   // 大間距 (區塊間隔)
  static const double xl = 32.0;   // 超大間距 (頁面上下邊距)
  static const double xxl = 48.0;  // 特大間距 (Onboarding 頁面)
}
```

#### 2.3.2 安全區域規範
```dart
class SafeAreaInsets {
  static const double screenPadding = 16.0;  // 螢幕左右邊距
  static const double bottomNavHeight = 72.0; // 底部導航高度
  static const double topBarHeight = 56.0;    // 頂部欄高度
  static const double fabBottomMargin = 88.0; // FAB 離底部距離
}
```

---

### 2.4 圓角與陰影 (Border Radius & Shadows)

#### 2.4.1 圓角系統
```dart
class BorderRadii {
  static const double sm = 8.0;   // 小元素 (Tag 標籤)
  static const double md = 12.0;  // 中型元素 (Button)
  static const double lg = 16.0;  // 卡片
  static const double xl = 24.0;  // 大型卡片/Modal
  static const double full = 999; // 完全圓角 (Avatar)
}
```

#### 2.4.2 陰影層級
```dart
// Material Design 3 Elevation
class Shadows {
  static List<BoxShadow> elevation1 = [
    BoxShadow(
      color: Colors.black.withOpacity(0.05),
      blurRadius: 4,
      offset: Offset(0, 1),
    ),
  ]; // 微浮起 (Tag)
  
  static List<BoxShadow> elevation2 = [
    BoxShadow(
      color: Colors.black.withOpacity(0.08),
      blurRadius: 8,
      offset: Offset(0, 2),
    ),
  ]; // 卡片靜態
  
  static List<BoxShadow> elevation3 = [
    BoxShadow(
      color: Colors.black.withOpacity(0.12),
      blurRadius: 16,
      offset: Offset(0, 4),
    ),
  ]; // 卡片懸停/拖曳中
  
  static List<BoxShadow> elevation4 = [
    BoxShadow(
      color: Colors.black.withOpacity(0.16),
      blurRadius: 24,
      offset: Offset(0, 8),
    ),
  ]; // Modal/Dialog
}
```

---

## 三、組件設計規範 (Component Library)

### 3.1 任務卡片 (Task Card)

#### 3.1.1 大型任務卡片 (Today View 優先任務)
```
┌─────────────────────────────────────────┐
│ 🟢 ACTIVE                    ⏰ 今天 18:00│
├─────────────────────────────────────────┤
│ 完成 API 文件撰寫                        │
│                                         │
│ 📦 Zentropy Backend                     │
│ 🏷️ Documentation                        │
├─────────────────────────────────────────┤
│ 進度: ▓▓▓▓▓░░░░░ 50%                   │
│                                         │
│ [✓ 完成] [⏸️ 延期] [✏️ 編輯]           │
└─────────────────────────────────────────┘

視覺規格:
- 高度: 180px
- 圓角: 16px
- 內邊距: 20px
- 陰影: elevation3
- 背景: 白色 (亮色) / #1E293B (暗色)
- 左側色條: 4px 寬，對應 Drawer 狀態色
```

#### 3.1.2 小型任務卡片 (列表視圖)
```
┌─────────────────────────────────┐
│ □ 準備會議簡報      📦 Work   │
│   🏷️ Meeting    ⏰ 明天 10:00 │
└─────────────────────────────────┘

視覺規格:
- 高度: 72px
- 圓角: 12px
- 內邊距: 12px 16px
- 陰影: elevation1
```

#### 3.1.3 互動狀態
```dart
// 任務卡片的四種狀態
enum TaskCardState {
  default,   // 靜態
  pressed,   // 按下 (縮放 0.98)
  swiping,   // 滑動中 (背景色顯示)
  completed, // 完成動畫 (淡出 + 縮小)
}
```

---

### 3.2 按鈕系統 (Button System)

#### 3.2.1 主要按鈕 (Primary Button)
```dart
ElevatedButton(
  style: ElevatedButton.styleFrom(
    backgroundColor: Color(0xFF667eea),
    foregroundColor: Colors.white,
    padding: EdgeInsets.symmetric(
      horizontal: 24,
      vertical: 14,
    ),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(12),
    ),
    elevation: 0,
  ),
  child: Text('確認'),
);
```

**視覺規格**：
- 最小高度: 48px (符合觸控區域標準)
- 圓角: 12px
- 字重: 500 (Medium)
- Hover: 亮度提升 10%

#### 3.2.2 次要按鈕 (Secondary Button)
```dart
OutlinedButton(
  style: OutlinedButton.styleFrom(
    foregroundColor: Color(0xFF667eea),
    side: BorderSide(
      color: Color(0xFF667eea),
      width: 1.5,
    ),
    padding: EdgeInsets.symmetric(
      horizontal: 24,
      vertical: 14,
    ),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(12),
    ),
  ),
  child: Text('取消'),
);
```

#### 3.2.3 文字按鈕 (Text Button)
```dart
TextButton(
  style: TextButton.styleFrom(
    foregroundColor: Color(0xFF667eea),
    padding: EdgeInsets.symmetric(
      horizontal: 16,
      vertical: 12,
    ),
  ),
  child: Text('稍後再說'),
);
```

---

### 3.3 輸入框 (Input Fields)

#### 3.3.1 多行文字輸入 (Quick Capture)
```dart
TextField(
  maxLines: 5,
  decoration: InputDecoration(
    hintText: '輸入任何想法...',
    hintStyle: TextStyle(
      color: Colors.grey[400],
      fontStyle: FontStyle.italic,
    ),
    filled: true,
    fillColor: Colors.grey[50],
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(16),
      borderSide: BorderSide.none,
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(16),
      borderSide: BorderSide(
        color: Color(0xFF667eea),
        width: 2,
      ),
    ),
    contentPadding: EdgeInsets.all(20),
  ),
);
```

**互動行為**：
- 聚焦時：邊框顏色轉為品牌色 + 微弱光暈
- 輸入時：即時顯示字數統計 (右下角)
- AI 分析時：底部顯示進度條

---

### 3.4 標籤 (Tags)

#### 3.4.1 Topic 標籤
```
┌─────────────────┐
│ 🏷️ Feature Dev │
└─────────────────┘

視覺規格:
- 高度: 28px
- 圓角: 8px
- 內邊距: 6px 12px
- 背景: 半透明品牌色 (opacity 0.1)
- 文字: 品牌色 (500)
- 字級: 12px
```

#### 3.4.2 狀態徽章 (Status Badge)
```
┌──────────┐
│ 🟢 ACTIVE│
└──────────┘

視覺規格:
- 高度: 24px
- 圓角: 6px
- 內邊距: 4px 8px
- 背景: 狀態色 (opacity 0.15)
- 文字: 狀態色 (深色)
- 字級: 11px, 字重: 600
```

---

### 3.5 底部導航 (Bottom Navigation)

```
┌─────────────────────────────────────────┐
│  🏠       ➕         📚         👤      │
│ Home   Quick    Library      Me        │
│  •                                       │
└─────────────────────────────────────────┘

視覺規格:
- 高度: 72px (包含 SafeArea)
- 背景: 玻璃擬態 (Glassmorphism)
  - 白色 80% opacity + 背景模糊 10px
- 圖標大小: 24px
- 選中狀態: 品牌色 + 底部小圓點
- 未選中: 灰色 (#6B7280)
```

**互動動畫**：
- 切換時：圖標縮放 0.9 → 1.1 → 1.0 (彈跳效果)
- 小圓點淡入 (200ms)

---

## 四、動畫設計規範 (Animation Guidelines)

### 4.1 動畫原則

#### 4.1.1 時長標準
```dart
class AnimationDurations {
  static const Duration instant = Duration(milliseconds: 100);
  static const Duration fast = Duration(milliseconds: 200);
  static const Duration normal = Duration(milliseconds: 300);
  static const Duration slow = Duration(milliseconds: 500);
  static const Duration verySlow = Duration(milliseconds: 800);
}
```

#### 4.1.2 緩動曲線 (Easing Curves)
```dart
class AnimationCurves {
  static const Curve easeInOut = Curves.easeInOutCubic;
  static const Curve easeOut = Curves.easeOutCubic;
  static const Curve easeIn = Curves.easeInCubic;
  static const Curve bounce = Curves.elasticOut;
  static const Curve decelerate = Curves.decelerate;
}
```

---

### 4.2 頁面轉場動畫

#### 4.2.1 標準推入 (Push Transition)
```dart
PageRouteBuilder(
  pageBuilder: (context, animation, secondaryAnimation) => NewPage(),
  transitionsBuilder: (context, animation, secondaryAnimation, child) {
    const begin = Offset(1.0, 0.0);
    const end = Offset.zero;
    final tween = Tween(begin: begin, end: end);
    final offsetAnimation = animation.drive(
      tween.chain(CurveTween(curve: Curves.easeInOutCubic)),
    );
    
    return SlideTransition(
      position: offsetAnimation,
      child: child,
    );
  },
  transitionDuration: Duration(milliseconds: 300),
);
```

#### 4.2.2 Modal 彈出 (Bottom Sheet)
```dart
showModalBottomSheet(
  context: context,
  isScrollControlled: true,
  backgroundColor: Colors.transparent,
  builder: (context) => AnimatedContainer(
    duration: Duration(milliseconds: 300),
    curve: Curves.easeOutCubic,
    child: Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: content,
    ),
  ),
);
```

---

### 4.3 微互動動畫 (Micro-interactions)

#### 4.3.1 任務完成動畫
```dart
// 步驟 1: 核取方塊動畫 (100ms)
AnimatedContainer(
  duration: Duration(milliseconds: 100),
  decoration: BoxDecoration(
    color: isCompleted ? Colors.green : Colors.transparent,
    border: Border.all(color: Colors.grey),
    borderRadius: BorderRadius.circular(6),
  ),
  child: isCompleted 
    ? Icon(Icons.check, size: 18, color: Colors.white)
    : null,
);

// 步驟 2: 卡片淡出 + 縮小 (300ms)
AnimatedOpacity(
  opacity: isCompleted ? 0.0 : 1.0,
  duration: Duration(milliseconds: 300),
  child: AnimatedScale(
    scale: isCompleted ? 0.95 : 1.0,
    duration: Duration(milliseconds: 300),
    child: taskCard,
  ),
);

// 步驟 3: 慶祝提示 (1000ms 後消失)
ScaleTransition(
  scale: Tween<double>(begin: 0.0, end: 1.0).animate(
    CurvedAnimation(
      parent: controller,
      curve: Curves.elasticOut,
    ),
  ),
  child: Container(
    child: Text('✅ 完成！'),
  ),
);
```

#### 4.3.2 拖曳反饋動畫
```dart
// 卡片拖曳時放大 + 陰影加深
AnimatedContainer(
  duration: Duration(milliseconds: 150),
  transform: Matrix4.identity()..scale(isDragging ? 1.05 : 1.0),
  decoration: BoxDecoration(
    boxShadow: isDragging ? Shadows.elevation4 : Shadows.elevation2,
  ),
  child: cardContent,
);
```

#### 4.3.3 Loading 動畫
```dart
// 脈動圓球 (Pulsing Orb)
AnimatedBuilder(
  animation: _controller,
  builder: (context, child) {
    return Container(
      width: 60 + (_controller.value * 20),
      height: 60 + (_controller.value * 20),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          colors: [
            Color(0xFF667eea).withOpacity(0.8),
            Color(0xFF764ba2).withOpacity(0.8),
          ],
        ),
      ),
    );
  },
);
```

---

### 4.4 列表變化動畫

#### 4.4.1 新增項目淡入
```dart
AnimatedList(
  key: _listKey,
  initialItemCount: tasks.length,
  itemBuilder: (context, index, animation) {
    return SizeTransition(
      sizeFactor: animation,
      child: FadeTransition(
        opacity: animation,
        child: TaskCard(task: tasks[index]),
      ),
    );
  },
);
```

#### 4.4.2 刪除項目滑出
```dart
_listKey.currentState?.removeItem(
  index,
  (context, animation) {
    return SlideTransition(
      position: Tween<Offset>(
        begin: Offset.zero,
        end: Offset(-1.0, 0.0),
      ).animate(animation),
      child: FadeTransition(
        opacity: Tween<double>(begin: 1.0, end: 0.0).animate(animation),
        child: TaskCard(task: removedTask),
      ),
    );
  },
  duration: Duration(milliseconds: 300),
);
```

---

## 五、手勢互動設計 (Gesture Interactions)

### 5.1 滑動手勢 (Swipe Gestures)

#### 5.1.1 左滑刪除
```
[卡片內容]  ←  左滑
              ↓
[🗑️ 刪除] [卡片內容縮小]
              ↓
          卡片消失
```

**實現規格**：
- 滑動閾值: 螢幕寬度的 30%
- 背景色: 漸層紅色 (#EF4444 → #DC2626)
- 圖標: 🗑️ 白色，淡入動畫
- 觸覺反饋: HapticFeedback.mediumImpact

#### 5.1.2 右滑完成
```
右滑  →  [卡片內容]
  ↓
[✅ 完成] [卡片內容縮小]
  ↓
慶祝動畫
```

**實現規格**：
- 滑動閾值: 螢幕寬度的 30%
- 背景色: 漸層綠色 (#10B981 → #059669)
- 圖標: ✅ 白色
- 觸覺反饋: HapticFeedback.heavyImpact

---

### 5.2 長按手勢 (Long Press)

#### 5.2.1 任務卡片長按
```
長按 (500ms)
  ↓
觸覺反饋 + 卡片微震動
  ↓
底部彈出操作選單
┌─────────────────────────┐
│ ✏️ 編輯                 │
│ 📋 複製                 │
│ 📦 移動到...            │
│ 🗑️ 刪除                │
└─────────────────────────┘
```

---

### 5.3 拖曳手勢 (Drag & Drop)

#### 5.3.1 任務拖曳到不同 Product
```
1. 長按任務卡片 → 卡片浮起 (elevation4 + scale 1.05)
2. 拖曳時：
   - 目標 Product 高亮 (邊框亮起)
   - 非目標區域暗化 (opacity 0.5)
3. 放下時：
   - 卡片飛入動畫 (300ms)
   - 目標 Product 閃爍一次
```

---

## 六、暗色模式設計 (Dark Mode)

### 6.1 色彩調整原則

```yaml
暗色模式配色:
  背景:
    primary: #0F172A
    secondary: #1E293B
    tertiary: #334155
  
  文字:
    primary: #F9FAFB
    secondary: #94A3B8
    tertiary: #64748B
  
  品牌色 (保持不變):
    primary: #667eea
    accent: #f093fb
  
  狀態色 (降低飽和度):
    active: #34D399 (原 #10B981)
    warning: #FBBF24 (原 #F59E0B)
```

### 6.2 視覺調整規範

1. **陰影改為光暈**：
   ```dart
   // 亮色模式
   boxShadow: [
     BoxShadow(color: Colors.black12, blurRadius: 8),
   ]
   
   // 暗色模式
   boxShadow: [
     BoxShadow(color: Colors.white10, blurRadius: 8),
   ]
   ```

2. **玻璃擬態調整**：
   ```dart
   // 暗色模式背景色更深
   color: Colors.white.withOpacity(0.05), // 原 0.1
   ```

---

## 七、語音輸入 UX (Voice Input)

### 7.1 語音輸入界面

```
┌─────────────────────────────────────┐
│                                     │
│        [波形動畫]                   │
│     🎙️ 正在聆聽...                 │
│                                     │
│  "明天要開會討論 Q2 計畫，           │
│   還要記得買咖啡豆"                 │
│                                     │
├─────────────────────────────────────┤
│  [🔴 停止] [✓ 完成]                │
└─────────────────────────────────────┘
```

### 7.2 波形動畫設計

```dart
// 即時音量波形視覺化
CustomPaint(
  painter: WaveformPainter(
    audioLevel: _currentAudioLevel, // 0.0 - 1.0
    color: Color(0xFF667eea),
  ),
  child: Container(height: 100),
);
```

---

## 八、空狀態設計 (Empty States)

### 8.1 首次使用空狀態

```
┌─────────────────────────────────────┐
│                                     │
│         [插圖: 空箱子]              │
│                                     │
│     還沒有任務？                     │
│     點擊下方 ➕ 開始記錄吧！         │
│                                     │
│     [前往新手教學]                  │
│                                     │
└─────────────────────────────────────┘
```

### 8.2 Inbox Zero 狀態

```
┌─────────────────────────────────────┐
│                                     │
│         [動畫: 🎉 慶祝煙火]         │
│                                     │
│     太棒了！                         │
│     收件匣已清空                     │
│                                     │
│     連續 5 天達成 Inbox Zero         │
│                                     │
└─────────────────────────────────────┘
```

### 8.3 無網路狀態

```
┌─────────────────────────────────────┐
│                                     │
│      [插圖: 斷線圖示]               │
│                                     │
│     目前離線                         │
│     部分功能受限                     │
│                                     │
│     可用功能：                       │
│     • 查看已下載的任務               │
│     • 快速捕捉 (連線後同步)         │
│                                     │
│     [重試連線]                      │
│                                     │
└─────────────────────────────────────┘
```

---

## 九、通知設計 (Notifications)

### 9.1 推送通知文案

```yaml
任務截止提醒:
  標題: "⏰ 任務即將到期"
  內容: "「準備會議簡報」將在 1 小時後到期"
  動作: [完成] [延期]

Inbox 警告:
  標題: "📥 收件匣待整理"
  內容: "已有 5 條筆記超過 24 小時，點擊整理"
  動作: [立即整理] [稍後]

每日摘要:
  標題: "☀️ 早安！今天的重點"
  內容: "你有 8 個任務，3 個標記為優先"
  動作: [查看詳情]

慶祝通知:
  標題: "🎉 恭喜！"
  內容: "本週完成 28 個任務，效率超群！"
  動作: [查看成就]
```

### 9.2 應用內通知 (Snackbar)

```dart
ScaffoldMessenger.of(context).showSnackBar(
  SnackBar(
    content: Row(
      children: [
        Icon(Icons.check_circle, color: Colors.white),
        SizedBox(width: 12),
        Text('任務已完成！'),
      ],
    ),
    backgroundColor: Color(0xFF10B981),
    behavior: SnackBarBehavior.floating,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(12),
    ),
    action: SnackBarAction(
      label: '復原',
      textColor: Colors.white,
      onPressed: () => undoComplete(),
    ),
  ),
);
```

---

## 十、無障礙設計 (Accessibility)

### 10.1 VoiceOver / TalkBack 語義化

```dart
Semantics(
  label: '任務：準備會議簡報。專案：工作。截止時間：明天上午十點。',
  button: true,
  enabled: true,
  onTap: () => openTaskDetail(),
  child: TaskCard(...),
);
```

### 10.2 顏色對比檢查

所有文字與背景的對比度必須符合 **WCAG 2.1 AA 級標準**：
- 一般文字: ≥ 4.5:1
- 大型文字 (≥18pt): ≥ 3:1

### 10.3 觸控目標大小

所有可點擊元素最小尺寸：**44×44 pt** (iOS) / **48×48 dp** (Android)

---

## 十一、插畫與圖標系統 (Illustrations & Icons)

### 11.1 圖標庫選擇

**主要圖標集**：Lucide Icons (與 Web POC 統一)
- 風格：簡約線性
- 線條寬度：2px
- 尺寸：24×24 (標準), 20×20 (小), 32×32 (大)

### 11.2 插畫風格

**Onboarding 與空狀態插畫**：
- 風格：扁平化 + 漸層色
- 色彩：品牌色系 (#667eea, #764ba2, #f093fb)
- 尺寸：最大寬度 280px

**建議插畫庫**：
- unDraw (可自訂品牌色)
- Storyset (動畫插畫)

---

## 十二、設計交付清單 (Design Deliverables)

### 12.1 Figma 文件結構

```
Zentropy Flutter App (Figma 主檔)
├── 📄 Cover (封面頁)
├── 🎨 Design System
│   ├── Colors
│   ├── Typography
│   ├── Spacing
│   └── Components
├── 📱 Screens (亮色模式)
│   ├── Onboarding
│   ├── Dashboard
│   ├── Quick Capture
│   ├── Inbox
│   ├── Library
│   └── Profile
├── 🌙 Screens (暗色模式)
├── 🔄 Interactions (互動原型)
└── 📐 Specs (開發標註)
```

### 12.2 開發者移交資產

1. **匯出圖標** (SVG 格式)
2. **插畫資產** (PNG @1x, @2x, @3x)
3. **色彩規範** (JSON 格式)
4. **動畫參數表** (Excel/Notion)
5. **互動原型連結** (Figma Prototype URL)

---

## 結語

本 UX 設計指南的核心目標是**讓 Zentropy Flutter App 成為一個「讓人想每天打開」的應用**。

透過精緻的視覺設計、流暢的動畫、直覺的手勢，我們希望用戶在使用過程中感受到：
- **專業感**：這不是一個粗糙的工具，而是一個精心打磨的產品
- **愉悅感**：每次互動都有精心設計的反饋，使用起來很舒服
- **信賴感**：AI 的判斷透明且可調整，用戶始終掌控全局

**設計不是裝飾，而是體驗的核心。**

---

**文件版本**：1.0  
**最後更新**：2026-01-27  
**負責人**：Design Team  
**狀態**：Draft - 待開發團隊 Review
